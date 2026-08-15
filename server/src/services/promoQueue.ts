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
  failed: number;
  skipped: number;
  remainingToday: number;
  queuedTotal: number;
};

/**
 * Sends the next slice of queued promo emails.
 *
 * Called on a schedule (hourly GitHub Action) rather than inline on "send",
 * because a 350-recipient blast from a domain with no sending history is a
 * textbook spam signal — and because Render's free tier would time out the
 * request anyway. Dripping under a daily cap doubles as domain warm-up.
 */
export async function drainQueue(requestedLimit?: number): Promise<DrainSummary> {
  // Contacts who unsubscribed or bounced after being queued must never be sent
  // to. Clearing them first keeps them out of the batch entirely.
  const skippedResult = await pool.query(`
    UPDATE promo_recipients r
       SET send_status = 'skipped',
           error = 'Contact is ' || c.status
      FROM promo_contacts c
     WHERE c.id = r.contact_id
       AND r.send_status = 'queued'
       AND c.status <> 'active'
    RETURNING r.id
  `);
  const skipped = skippedResult.rowCount ?? 0;

  const { rows: sentTodayRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM promo_recipients
      WHERE sent_at >= date_trunc('day', NOW())`
  );
  const remainingToday = Math.max(0, dailyCap() - sentTodayRows[0].count);

  const { rows: queuedRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM promo_recipients WHERE send_status = 'queued'`
  );
  const queuedTotal = queuedRows[0].count;

  const limit = Math.min(requestedLimit ?? BATCH_LIMIT, BATCH_LIMIT, remainingToday);
  if (limit <= 0 || queuedTotal === 0) {
    await closeFinishedCampaigns();
    return { sent: 0, failed: 0, skipped, remainingToday, queuedTotal };
  }

  const { rows: batch } = await pool.query(
    `SELECT r.id, r.access_token,
            c.email, c.unsub_token,
            camp.id AS campaign_id, camp.slug, camp.title, camp.subject,
            camp.body_intro, camp.artwork_url, camp.release_date, camp.download_enabled
       FROM promo_recipients r
       JOIN promo_contacts c    ON c.id = r.contact_id
       JOIN promo_campaigns camp ON camp.id = r.campaign_id
      WHERE r.send_status = 'queued'
        AND camp.status = 'sending'
        AND c.status = 'active'
      ORDER BY r.id ASC
      LIMIT $1`,
    [limit]
  );

  if (batch.length === 0) {
    await closeFinishedCampaigns();
    return { sent: 0, failed: 0, skipped, remainingToday, queuedTotal };
  }

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
    };
    return {
      to: row.email,
      // Just the title. "Promo" in a subject line is a promotional keyword and
      // pushes Gmail toward the Promotions tab.
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
        `UPDATE promo_recipients
            SET send_status = 'sent', sent_at = NOW(), provider_message_id = $1, error = NULL
          WHERE id = $2`,
        [result.messageId ?? null, batch[i].id]
      );
    } else {
      failed++;
      await pool.query(
        `UPDATE promo_recipients SET send_status = 'failed', error = $1 WHERE id = $2`,
        [result?.error?.slice(0, 500) ?? 'Unknown send error', batch[i].id]
      );
    }
  }

  await closeFinishedCampaigns();

  return { sent, failed, skipped, remainingToday: remainingToday - sent, queuedTotal: queuedTotal - sent };
}

/** Marks a campaign 'sent' once nothing is left queued for it. */
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
