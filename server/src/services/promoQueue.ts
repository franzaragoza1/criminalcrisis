import crypto from 'crypto';
import { pool } from '../db/database.js';
import { sendPromoBatch, type PromoEmail } from './resend.js';
import { renderPromoHtml, renderPromoText, type PromoEmailContent } from './promoEmail.js';

/** Public URL of the React site (where the promo landing lives). */
export const siteUrl = () => (process.env.SITE_URL || 'https://criminalcrisis.com').replace(/\/$/, '');
/** Public URL of this API — unsubscribe must be an API endpoint so one-click POST works. */
export const apiUrl = () => (process.env.PUBLIC_API_URL || 'https://criminalcrisis.onrender.com').replace(/\/$/, '');

export const promoUrlFor = (slug: string, token: string) => `${siteUrl()}/promo/${slug}?k=${token}`;
export const unsubscribeUrlFor = (token: string) => `${apiUrl()}/api/promo/unsubscribe/${token}`;

/** 32 URL-safe random bytes. Long enough that guessing is not a threat model. */
export const newToken = () => crypto.randomBytes(24).toString('base64url');

/**
 * Resend's batch endpoint caps at 100 messages, and the free plan caps at 100
 * per day. Keeping both at 100 means one drain call per day saturates the quota.
 */
const BATCH_LIMIT = 100;

export const dailyCap = () => {
  const parsed = Number(process.env.PROMO_DAILY_CAP);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
};

export type DrainSummary = {
  sent: number;
  reminded: number;
  failed: number;
  skipped: number;
  remainingToday: number;
  queuedTotal: number;
};

/**
 * Sends the next slice of queued promo mail.
 *
 * Called on a schedule (GitHub Action) rather than inline on "send", because a
 * 350-recipient blast from a domain with no sending history is a textbook spam
 * signal — and because Render's free tier would time out the request anyway.
 * Dripping under a daily cap doubles as domain warm-up.
 *
 * Two queues share one budget: first sends (`send_status`) and reminders
 * (`reminder_status`). First sends always go first — someone who has never
 * received anything is worth more than a second attempt at someone who has.
 */
export async function drainQueue(requestedLimit?: number): Promise<DrainSummary> {
  const skipped = await skipUnreachable();

  // Reminders and first sends both count against the same daily quota, because
  // Resend counts messages, not intentions.
  const { rows: [usage] } = await pool.query(`
    SELECT (SELECT COUNT(*)::int FROM promo_recipients WHERE sent_at          >= date_trunc('day', NOW()))
         + (SELECT COUNT(*)::int FROM promo_recipients WHERE reminder_sent_at >= date_trunc('day', NOW())) AS used
  `);
  let budget = Math.max(0, dailyCap() - usage.used);
  if (requestedLimit !== undefined) budget = Math.min(budget, requestedLimit);
  budget = Math.min(budget, BATCH_LIMIT);

  const { rows: [counts] } = await pool.query(`
    SELECT (SELECT COUNT(*)::int FROM promo_recipients WHERE send_status     = 'queued') AS first_sends,
           (SELECT COUNT(*)::int FROM promo_recipients WHERE reminder_status = 'queued') AS reminders
  `);
  const queuedTotal = counts.first_sends + counts.reminders;

  let sent = 0;
  let reminded = 0;
  let failed = 0;

  if (budget > 0 && counts.first_sends > 0) {
    const pass = await sendPass(false, budget);
    sent = pass.sent;
    failed += pass.failed;
    budget -= pass.sent;
  }

  if (budget > 0 && counts.reminders > 0) {
    const pass = await sendPass(true, budget);
    reminded = pass.sent;
    failed += pass.failed;
    budget -= pass.sent;
  }

  await closeFinishedCampaigns();

  return {
    sent,
    reminded,
    failed,
    skipped,
    remainingToday: budget,
    queuedTotal: queuedTotal - sent - reminded,
  };
}

/**
 * Clears everyone who must not be mailed before a batch is built.
 *
 * Contacts who unsubscribed or bounced after being queued must never be sent
 * to. Reminders additionally drop anyone who has visited since the reminder was
 * queued — the whole point is that they never turned up, and nudging someone
 * who did is the one way to make this feature annoying.
 */
async function skipUnreachable(): Promise<number> {
  const inactive = await pool.query(`
    UPDATE promo_recipients r
       SET send_status     = CASE WHEN r.send_status     = 'queued' THEN 'skipped' ELSE r.send_status END,
           reminder_status = CASE WHEN r.reminder_status = 'queued' THEN 'skipped' ELSE r.reminder_status END,
           error = 'Contact is ' || c.status
      FROM promo_contacts c
     WHERE c.id = r.contact_id
       AND c.status <> 'active'
       AND (r.send_status = 'queued' OR r.reminder_status = 'queued')
    RETURNING r.id
  `);

  const turnedUp = await pool.query(`
    UPDATE promo_recipients
       SET reminder_status = 'skipped'
     WHERE reminder_status = 'queued'
       AND first_visit_at IS NOT NULL
    RETURNING id
  `);

  return (inactive.rowCount ?? 0) + (turnedUp.rowCount ?? 0);
}

/** Builds, sends and records one batch from either queue. */
async function sendPass(isReminder: boolean, limit: number): Promise<{ sent: number; failed: number }> {
  const queueFilter = isReminder
    ? `r.reminder_status = 'queued' AND r.first_visit_at IS NULL`
    : `r.send_status = 'queued'`;

  const { rows: batch } = await pool.query(
    `SELECT r.id, r.access_token,
            c.email, c.unsub_token,
            camp.id AS campaign_id, camp.slug, camp.title, camp.subject,
            camp.body_intro, camp.release_date, camp.download_enabled
       FROM promo_recipients r
       JOIN promo_contacts c    ON c.id = r.contact_id
       JOIN promo_campaigns camp ON camp.id = r.campaign_id
      WHERE ${queueFilter}
        ${isReminder ? '' : `AND camp.status = 'sending'`}
        AND c.status = 'active'
      ORDER BY r.id ASC
      LIMIT $1`,
    [limit]
  );

  if (batch.length === 0) return { sent: 0, failed: 0 };

  // Track titles are per-campaign, so fetch once per campaign rather than per row.
  const campaignIds = [...new Set(batch.map(b => b.campaign_id))];
  const { rows: trackRows } = await pool.query(
    `SELECT campaign_id, title FROM promo_tracks
      WHERE campaign_id = ANY($1::int[]) ORDER BY position ASC, id ASC`,
    [campaignIds]
  );
  const titlesByCampaign = new Map<number, string[]>();
  for (const t of trackRows) {
    if (!titlesByCampaign.has(t.campaign_id)) titlesByCampaign.set(t.campaign_id, []);
    titlesByCampaign.get(t.campaign_id)!.push(t.title);
  }

  const emails: PromoEmail[] = batch.map(row => {
    const content: PromoEmailContent = {
      campaignTitle: row.title,
      bodyIntro: row.body_intro,
      releaseDate: row.release_date,
      trackTitles: titlesByCampaign.get(row.campaign_id) || [],
      promoUrl: promoUrlFor(row.slug, row.access_token),
      unsubscribeUrl: unsubscribeUrlFor(row.unsub_token),
      downloadEnabled: row.download_enabled === 1,
      isReminder,
    };
    return {
      to: row.email,
      // Just the title. "Promo" in a subject line is a promotional keyword and
      // pushes Gmail toward the Promotions tab. The reminder deliberately reuses
      // the campaign's subject rather than inventing one, so editing it in the
      // admin before firing the reminder is all it takes to change it.
      subject: row.subject || row.title,
      html: renderPromoHtml(content),
      text: renderPromoText(content),
      unsubscribeUrl: content.unsubscribeUrl,
    };
  });

  const results = await sendPromoBatch(emails);

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i++) {
    const result = results[i];
    if (result?.ok) {
      sent++;
      await pool.query(
        isReminder
          ? `UPDATE promo_recipients
                SET reminder_status = 'sent', reminder_sent_at = NOW(), reminder_message_id = $1
              WHERE id = $2`
          : `UPDATE promo_recipients
                SET send_status = 'sent', sent_at = NOW(), provider_message_id = $1, error = NULL
              WHERE id = $2`,
        [result.messageId ?? null, batch[i].id]
      );
    } else {
      failed++;
      await pool.query(
        isReminder
          ? `UPDATE promo_recipients SET reminder_status = 'failed', error = $1 WHERE id = $2`
          : `UPDATE promo_recipients SET send_status = 'failed', error = $1 WHERE id = $2`,
        [result?.error?.slice(0, 500) ?? 'Unknown send error', batch[i].id]
      );
    }
  }

  return { sent, failed };
}

/**
 * Marks a campaign 'sent' once nothing is left queued for the first send.
 *
 * Reminders are deliberately outside the campaign status machine. A reminder
 * goes out long after a campaign reads 'sent', and coupling the two would mean
 * queueing one had to flip the campaign back to 'sending' — which on a paused
 * campaign would also release every first send that was paused on purpose.
 * Reminders start and stop through their own endpoints instead.
 */
async function closeFinishedCampaigns(): Promise<void> {
  await pool.query(`
    UPDATE promo_campaigns
       SET status = 'sent'
     WHERE status = 'sending'
       AND NOT EXISTS (
         SELECT 1 FROM promo_recipients
          WHERE campaign_id = promo_campaigns.id AND send_status = 'queued'
       )
  `);
}
