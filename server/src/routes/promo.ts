import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import { parseCsvRecords, toCsv } from '../lib/csv.js';
import { verifySvixSignature } from '../lib/svix.js';
import {
  uploadToCloudinary,
  uploadAudioToCloudinary,
  signedAudioStreamUrl,
  signedAudioAttachmentUrl,
  deleteAudioFromCloudinary,
  LOSSLESS_FORMATS,
} from '../services/cloudinary.js';
import {
  drainQueue,
  newToken,
  promoUrlFor,
  unsubscribeUrlFor,
  siteUrl,
  dailyCap,
} from '../services/promoQueue.js';
import { createDomain, listDomains, getDomain, verifyDomain, sendPromoEmail } from '../services/resend.js';
import { renderPromoHtml, renderPromoText, type PromoEmailContent } from '../services/promoEmail.js';
import { cleanAddress, addressProblem, isEmail } from '../lib/email.js';

const router = Router();

/**
 * Cloudinary's free plan rejects any single file over 100MB — chunked uploading
 * raises the request limit but not the plan cap. Matching the limit here means
 * an oversized master fails immediately with a useful message instead of after
 * a long upload that ends in a raw "413" from Cloudinary.
 */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;

const TOO_BIG_MESSAGE =
  `That file is over the ${mb(MAX_UPLOAD_BYTES)} limit on Cloudinary's free plan. ` +
  `Export the master as FLAC — it's still lossless but roughly half the size of WAV, ` +
  `and Rekordbox, Serato and Traktor all read it. A 16-bit/44.1kHz WAV also fits ` +
  `for anything under about 9 minutes.`;

/** Turns multer's size rejection into a 413 the admin UI can actually show. */
function handleUpload(middleware: ReturnType<typeof upload.fields>): typeof middleware {
  return ((req: any, res: any, next: any) =>
    middleware(req, res, (err: any) => {
      if (!err) return next();
      if (err?.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: TOO_BIG_MESSAGE });
        return;
      }
      res.status(400).json({ error: err.message || 'Upload failed' });
    })) as typeof middleware;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 80);

/**
 * Single-segment admin routes are registered before the public `/:slug` handler,
 * so a campaign slugged "campaigns" would be unreachable. Suffix those instead.
 */
const RESERVED_SLUGS = new Set(['contacts', 'campaigns', 'domains', 'queue', 'webhook', 'unsubscribe', 'signup', 'tracks', 'share', 'join']);


const parseTags = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
};

// ===========================================================================
// ADMIN — contacts
// Registered before the public `/:slug` routes so those don't shadow them.
// ===========================================================================

router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const { status, role, q } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];

    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (role) { params.push(role); where.push(`role = $${params.length}`); }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(COALESCE(name,'')) LIKE $${params.length} OR LOWER(COALESCE(company,'')) LIKE $${params.length})`);
    }

    const result = await pool.query(
      `SELECT id, email, name, role, country, company, tags, status, source, notes, created_at
         FROM promo_contacts
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/contacts/stats', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*)::int AS count FROM promo_contacts GROUP BY status
    `);
    const byRole = await pool.query(`
      SELECT role, COUNT(*)::int AS count FROM promo_contacts WHERE status = 'active' GROUP BY role
    `);
    res.json({
      byStatus: Object.fromEntries(rows.map(r => [r.status, r.count])),
      byRole: Object.fromEntries(byRole.rows.map(r => [r.role || 'unknown', r.count])),
      total: rows.reduce((sum, r) => sum + r.count, 0),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** CSV backup. The contact list is the most valuable asset here — keep copies. */
router.get('/contacts/export.csv', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT email, name, role, country, company, tags, status, source, notes, created_at
         FROM promo_contacts ORDER BY created_at ASC`
    );
    const csv = toCsv(
      ['email', 'name', 'role', 'country', 'company', 'tags', 'status', 'source', 'notes', 'created_at'],
      rows.map(r => [
        r.email, r.name, r.role, r.country, r.company,
        JSON.parse(r.tags || '[]').join('|'),
        r.status, r.source, r.notes, r.created_at?.toISOString?.() ?? r.created_at,
      ])
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="criminalcrisis-contacts-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Bulk import. Accepts a file upload (field `file`) or a raw `csv` string.
 * Header names are matched loosely so a list exported from any distro imports
 * without hand-editing the file first.
 */
router.post('/contacts/import', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const raw = req.file ? req.file.buffer.toString('utf8') : (req.body?.csv as string | undefined);
    if (!raw?.trim()) { res.status(400).json({ error: 'No CSV provided' }); return; }

    const records = parseCsvRecords(raw);
    if (records.length === 0) { res.status(400).json({ error: 'CSV has no data rows' }); return; }

    const pick = (rec: Record<string, string>, keys: string[]) => {
      for (const k of keys) if (rec[k]) return rec[k];
      return '';
    };

    const defaultRole = (req.body?.default_role as string) || 'dj';
    const extraTags = parseTags(req.body?.tags);

    let imported = 0;
    let updated = 0;
    const invalid: string[] = [];

    for (const rec of records) {
      const email = cleanAddress(pick(rec, ['email', 'e-mail', 'mail', 'correo', 'email address']));
      if (!isEmail(email)) { if (email) invalid.push(email); continue; }

      const name = pick(rec, ['name', 'nombre', 'full name', 'contact', 'contact name', 'first name']);
      const role = pick(rec, ['role', 'type', 'tipo', 'category']) || defaultRole;
      const country = pick(rec, ['country', 'pais', 'país', 'location']);
      const company = pick(rec, ['company', 'empresa', 'station', 'radio', 'outlet', 'magazine', 'organisation', 'organization']);
      const tags = [...new Set([...parseTags(pick(rec, ['tags', 'etiquetas', 'groups'])), ...extraTags])];

      const result = await pool.query(
        `INSERT INTO promo_contacts (email, name, role, country, company, tags, source, unsub_token)
              VALUES ($1, $2, $3, $4, $5, $6, 'import', $7)
         ON CONFLICT (email) DO UPDATE
                SET name    = COALESCE(NULLIF(EXCLUDED.name, ''), promo_contacts.name),
                    role    = COALESCE(NULLIF(EXCLUDED.role, ''), promo_contacts.role),
                    country = COALESCE(NULLIF(EXCLUDED.country, ''), promo_contacts.country),
                    company = COALESCE(NULLIF(EXCLUDED.company, ''), promo_contacts.company),
                    updated_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
        [email, name || null, role.toLowerCase(), country || null, company || null, JSON.stringify(tags), newToken()]
      );
      if (result.rows[0].inserted) imported++;
      else updated++;
    }

    res.json({ imported, updated, invalid, total: records.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/contacts', authMiddleware, async (req, res) => {
  try {
    const { email, name, role, country, company, tags, notes } = req.body;
    const address = cleanAddress(email);
    const problem = addressProblem(address);
    if (problem) { res.status(400).json({ error: `That address ${problem}.` }); return; }
    const result = await pool.query(
      `INSERT INTO promo_contacts (email, name, role, country, company, tags, notes, source, unsub_token)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',$8)
       ON CONFLICT (email) DO NOTHING
         RETURNING id`,
      [address, name || null, (role || 'dj').toLowerCase(), country || null,
       company || null, JSON.stringify(parseTags(tags)), notes || null, newToken()]
    );
    if (result.rows.length === 0) { res.status(409).json({ error: 'That email is already on the list' }); return; }
    res.json({ id: result.rows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/contacts/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM promo_contacts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const prev = existing.rows[0];
    const { email, name, role, country, company, tags, status, notes } = req.body;
    await pool.query(
      `UPDATE promo_contacts
          SET email=$1, name=$2, role=$3, country=$4, company=$5, tags=$6, status=$7, notes=$8, updated_at=NOW()
        WHERE id=$9`,
      [
        email ? cleanAddress(email) : prev.email,
        name ?? prev.name,
        role ?? prev.role,
        country ?? prev.country,
        company ?? prev.company,
        tags !== undefined ? JSON.stringify(parseTags(tags)) : prev.tags,
        status ?? prev.status,
        notes ?? prev.notes,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/contacts/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM promo_contacts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// ADMIN — campaigns
// ===========================================================================

router.get('/campaigns', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
             (SELECT COUNT(*)::int FROM promo_tracks t WHERE t.campaign_id = c.id) AS track_count,
             (SELECT COUNT(*)::int FROM promo_recipients r WHERE r.campaign_id = c.id) AS recipient_count,
             (SELECT COUNT(*)::int FROM promo_recipients r WHERE r.campaign_id = c.id AND r.send_status = 'queued') AS queued_count
        FROM promo_campaigns c
       ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/campaigns', authMiddleware, upload.single('artwork'), async (req, res) => {
  try {
    const { title, subject, body_intro, release_date, release_id, download_enabled, require_feedback } = req.body;
    if (!title) { res.status(400).json({ error: 'Title required' }); return; }

    let slug = slugify(title) || 'promo';
    if (RESERVED_SLUGS.has(slug)) slug = `${slug}-promo`;
    const clash = await pool.query('SELECT 1 FROM promo_campaigns WHERE slug = $1', [slug]);
    if (clash.rows.length > 0) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const artwork_url = req.file ? await uploadToCloudinary(req.file.buffer, 'promo-artwork') : null;

    const off = (v: unknown) => v === '0' || v === false || v === 'false';
    const { rows } = await pool.query(
      `INSERT INTO promo_campaigns (title, slug, subject, body_intro, artwork_url, release_id, release_date, download_enabled, require_feedback)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, slug`,
      [title, slug, subject || null, body_intro || null, artwork_url,
       release_id ? Number(release_id) : null, release_date || null,
       off(download_enabled) ? 0 : 1, off(require_feedback) ? 0 : 1]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/campaigns/:id', authMiddleware, upload.single('artwork'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM promo_campaigns WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const prev = existing.rows[0];
    const { title, subject, body_intro, release_date, release_id, download_enabled, require_feedback } = req.body;
    const artwork_url = req.file
      ? await uploadToCloudinary(req.file.buffer, 'promo-artwork')
      : prev.artwork_url;
    const off = (v: unknown) => v === '0' || v === false || v === 'false';

    await pool.query(
      `UPDATE promo_campaigns
          SET title=$1, subject=$2, body_intro=$3, artwork_url=$4, release_id=$5,
              release_date=$6, download_enabled=$7, require_feedback=$8
        WHERE id=$9`,
      [
        title || prev.title,
        subject ?? prev.subject,
        body_intro ?? prev.body_intro,
        artwork_url,
        release_id !== undefined && release_id !== '' ? Number(release_id) : prev.release_id,
        release_date ?? prev.release_date,
        download_enabled === undefined ? prev.download_enabled : (off(download_enabled) ? 0 : 1),
        require_feedback === undefined ? prev.require_feedback : (off(require_feedback) ? 0 : 1),
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/campaigns/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT stream_public_id, download_public_id, mp3_public_id FROM promo_tracks WHERE campaign_id = $1',
      [req.params.id]
    );
    // Best-effort cleanup so unreleased masters don't linger in Cloudinary.
    for (const t of rows) {
      for (const id of new Set([t.stream_public_id, t.download_public_id, t.mp3_public_id].filter(Boolean))) {
        await deleteAudioFromCloudinary(id as string).catch(() => {});
      }
    }
    await pool.query('DELETE FROM promo_campaigns WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Uploads one track. `audio` becomes the 128k stream; `master` the download. */
/**
 * Uploads one track.
 *
 * `master` is the high-quality file (WAV/AIFF, or a 320 if that's all there is).
 * Everything else is derived from it: the 128kbps stream, and the 320 MP3 unless
 * an explicit `mp3` is supplied for people who'd rather control the encode.
 */
router.post(
  '/campaigns/:id/tracks',
  authMiddleware,
  handleUpload(upload.fields([{ name: 'master', maxCount: 1 }, { name: 'mp3', maxCount: 1 }])),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const master = files?.master?.[0];
      const mp3 = files?.mp3?.[0];
      if (!master) { res.status(400).json({ error: 'A master audio file is required' }); return; }

      const { title, artist_name } = req.body;

      // Append to the end. Relying on a client-supplied position meant every
      // track landed at 0 and the list fell back to insertion order.
      const { rows: last } = await pool.query(
        `SELECT COALESCE(MAX(position) + 1, 0) AS next FROM promo_tracks WHERE campaign_id = $1`,
        [req.params.id]
      );

      // The eager 128k transcode happens here so the first listener isn't the
      // one waiting for it.
      const uploaded = await uploadAudioToCloudinary(master.buffer, 'promo-masters', { transcodeTo128: true });
      const explicitMp3 = mp3 ? await uploadAudioToCloudinary(mp3.buffer, 'promo-mp3') : null;

      const { rows } = await pool.query(
        `INSERT INTO promo_tracks (campaign_id, position, title, artist_name, stream_public_id, download_public_id, download_format, mp3_public_id, duration_seconds)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          req.params.id,
          last[0].next,
          title || master.originalname.replace(/\.[^.]+$/, ''),
          artist_name || null,
          uploaded.publicId,
          uploaded.publicId,
          uploaded.format,
          explicitMp3?.publicId ?? null,
          uploaded.durationSeconds,
        ]
      );
      res.json({ id: rows[0].id, format: uploaded.format });
    } catch (e: any) {
      // Cloudinary reports the plan cap as a bare "413" with no explanation.
      const raw = String(e?.message || e?.error?.message || '');
      if (raw.includes('413') || /file size too large|too large/i.test(raw)) {
        res.status(413).json({ error: TOO_BIG_MESSAGE });
        return;
      }
      res.status(400).json({ error: raw || 'Upload failed' });
    }
  }
);

/**
 * Reorders a campaign's tracks. Takes the full list of ids in the order they
 * should appear and rewrites every position, rather than swapping pairs — that
 * way a list that somehow drifted out of sync gets normalised on any change.
 */
router.put('/campaigns/:id/tracks/order', authMiddleware, async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some(id => !Number.isInteger(Number(id)))) {
    res.status(400).json({ error: 'ids must be an array of track ids' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE promo_tracks SET position = $1 WHERE id = $2 AND campaign_id = $3`,
        [i, Number(ids[i]), req.params.id]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/tracks/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT stream_public_id, download_public_id, mp3_public_id FROM promo_tracks WHERE id = $1',
      [req.params.id]
    );
    if (rows[0]) {
      for (const id of new Set([rows[0].stream_public_id, rows[0].download_public_id, rows[0].mp3_public_id].filter(Boolean))) {
        await deleteAudioFromCloudinary(id as string).catch(() => {});
      }
    }
    await pool.query('DELETE FROM promo_tracks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Adds recipients. Filter by role/tags, or pass explicit contact_ids. */
router.post('/campaigns/:id/recipients', authMiddleware, async (req, res) => {
  try {
    const { contact_ids, roles, tags } = req.body as {
      contact_ids?: number[]; roles?: string[]; tags?: string[];
    };

    // Test contacts are created by the "send test" button; they must never be
    // swept into a real send.
    const where: string[] = [`status = 'active'`, `COALESCE(source, '') <> 'test'`];
    const params: unknown[] = [];

    if (Array.isArray(contact_ids) && contact_ids.length) {
      params.push(contact_ids);
      where.push(`id = ANY($${params.length}::int[])`);
    }
    if (Array.isArray(roles) && roles.length) {
      params.push(roles);
      where.push(`role = ANY($${params.length}::text[])`);
    }
    if (Array.isArray(tags) && tags.length) {
      // tags is a JSON text column; match if any requested tag appears in it.
      params.push(tags);
      where.push(`EXISTS (SELECT 1 FROM json_array_elements_text(tags::json) AS t WHERE t = ANY($${params.length}::text[]))`);
    }

    const { rows: contacts } = await pool.query(
      `SELECT id FROM promo_contacts WHERE ${where.join(' AND ')}`, params
    );

    let added = 0;
    for (const c of contacts) {
      const result = await pool.query(
        `INSERT INTO promo_recipients (campaign_id, contact_id, access_token)
              VALUES ($1,$2,$3) ON CONFLICT (campaign_id, contact_id) DO NOTHING RETURNING id`,
        [req.params.id, c.id, newToken()]
      );
      if (result.rows.length) added++;
    }

    res.json({ added, matched: contacts.length });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Drops a recipient from a campaign before it reaches them.
 *
 * Only while queued: once an email is out, deleting the row would throw away the
 * record of what that person did with it, and the mail is gone regardless.
 */
router.delete('/campaigns/:id/recipients/:recipientId', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM promo_recipients
        WHERE id = $1 AND campaign_id = $2 AND send_status = 'queued'`,
      [req.params.recipientId, req.params.id]
    );
    if (rowCount === 0) {
      res.status(409).json({ error: 'Already sent — it can only be removed while queued.' });
      return;
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Flips the campaign to 'sending'; the drip worker takes it from there. */
router.post('/campaigns/:id/send', authMiddleware, async (req, res) => {
  try {
    const { rows: tracks } = await pool.query('SELECT COUNT(*)::int AS n FROM promo_tracks WHERE campaign_id = $1', [req.params.id]);
    if (tracks[0].n === 0) { res.status(400).json({ error: 'Add at least one track before sending' }); return; }

    const { rows: queued } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM promo_recipients WHERE campaign_id = $1 AND send_status = 'queued'`,
      [req.params.id]
    );
    if (queued[0].n === 0) { res.status(400).json({ error: 'No queued recipients — add recipients first' }); return; }

    await pool.query(`UPDATE promo_campaigns SET status = 'sending' WHERE id = $1`, [req.params.id]);

    // Send the first slice immediately so the admin gets instant feedback that
    // it works; the hourly worker handles the rest under the daily cap.
    const summary = await drainQueue();
    res.json({ queued: queued[0].n, dailyCap: dailyCap(), ...summary });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Pause / resume a send in progress.
 *
 * The drip worker only picks up campaigns with status 'sending', so parking a
 * campaign on 'paused' stops it dead without touching the queue — every
 * remaining recipient keeps its token and position. Worth having when a send
 * looks like it's going wrong halfway through: the unsent half is the part you
 * can still save.
 */
router.post('/campaigns/:id/pause', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE promo_campaigns SET status = 'paused' WHERE id = $1 AND status = 'sending'`,
      [req.params.id]
    );
    if (rowCount === 0) { res.status(409).json({ error: 'Only a campaign that is currently sending can be paused.' }); return; }
    res.json({ ok: true, status: 'paused' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/campaigns/:id/resume', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE promo_campaigns SET status = 'sending' WHERE id = $1 AND status = 'paused'`,
      [req.params.id]
    );
    if (rowCount === 0) { res.status(409).json({ error: 'That campaign is not paused.' }); return; }
    const summary = await drainQueue();
    res.json({ ok: true, status: 'sending', ...summary });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Who a reminder may go to: got the first mail, never turned up, not reminded
 * yet, still mailable, not one of the sender's own test rows.
 *
 * `first_visit_at IS NULL` is the whole point. Every other promo tool reminds
 * "people who didn't open", which rests on a tracking pixel that Apple Mail
 * Privacy Protection has been faking since 2021. A visit is a real person
 * fetching a real page with their own token, so this list is not a guess.
 *
 * Shared by the count and the queue-up so the number on the button and the
 * number actually mailed can never drift apart.
 */
const REMINDABLE = `
      r.send_status IN ('sent', 'delivered')
  AND r.first_visit_at IS NULL
  AND r.reminder_status IS NULL
  AND c.status = 'active'
  AND COALESCE(c.source, '') <> 'test'`;

/**
 * Queues a reminder to everyone who never opened their link.
 *
 * Independent of campaign status on purpose: a campaign reads 'sent' by the
 * time a reminder makes sense, and a paused campaign must stay paused — this
 * must never become a back door that releases first sends someone stopped
 * deliberately.
 */
router.post('/campaigns/:id/reminder', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE promo_recipients r
          SET reminder_status = 'queued'
         FROM promo_contacts c
        WHERE c.id = r.contact_id
          AND r.campaign_id = $1
          AND ${REMINDABLE}
      RETURNING r.id`,
      [req.params.id]
    );

    if (rows.length === 0) {
      res.status(409).json({ error: 'Nobody to remind — everyone has either visited already or been reminded.' });
      return;
    }

    // Send the first slice now so the admin sees it working; the cron drips the
    // rest under the same daily cap the first send used.
    const summary = await drainQueue();
    res.json({ queued: rows.length, dailyCap: dailyCap(), ...summary });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Un-queues a reminder that hasn't gone out yet. Sent ones cannot be recalled. */
router.post('/campaigns/:id/reminder/cancel', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE promo_recipients SET reminder_status = NULL
        WHERE campaign_id = $1 AND reminder_status = 'queued'`,
      [req.params.id]
    );
    res.json({ ok: true, cancelled: rowCount ?? 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Sends the campaign to one arbitrary address for a pre-flight check. */
router.post('/campaigns/:id/test', authMiddleware, async (req, res) => {
  try {
    const to = cleanAddress(req.body?.email);
    const toProblem = addressProblem(to);
    if (toProblem) { res.status(400).json({ error: `That address ${toProblem}.` }); return; }

    const { rows } = await pool.query('SELECT * FROM promo_campaigns WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const campaign = rows[0];

    const { rows: tracks } = await pool.query(
      'SELECT title FROM promo_tracks WHERE campaign_id = $1 ORDER BY position ASC, id ASC', [req.params.id]
    );

    // Give the test address a real contact and recipient row. Borrowing another
    // contact's token would work, but every play and download from the test
    // would then be logged against that person's stats.
    const contact = await pool.query(
      `INSERT INTO promo_contacts (email, name, role, source, unsub_token)
            VALUES ($1, 'Test', 'test', 'test', $2)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING id, name, unsub_token`,
      [to, newToken()]
    );
    const { id: contactId, unsub_token } = contact.rows[0];

    const recipient = await pool.query(
      `INSERT INTO promo_recipients (campaign_id, contact_id, access_token, send_status, sent_at)
            VALUES ($1, $2, $3, 'sent', NOW())
       ON CONFLICT (campaign_id, contact_id)
       DO UPDATE SET send_status = 'sent', sent_at = NOW(), delivered_at = NULL
         RETURNING id, access_token`,
      [req.params.id, contactId, newToken()]
    );

    const content: PromoEmailContent = {
      campaignTitle: campaign.title,
      bodyIntro: campaign.body_intro,
      releaseDate: campaign.release_date,
      trackTitles: tracks.map(t => t.title),
      promoUrl: promoUrlFor(campaign.slug, recipient.rows[0].access_token),
      unsubscribeUrl: unsubscribeUrlFor(unsub_token),
      downloadEnabled: campaign.download_enabled === 1,
    };

    const result = await sendPromoEmail({
      to,
      subject: `[TEST] ${campaign.subject || campaign.title}`,
      html: renderPromoHtml(content),
      text: renderPromoText(content),
      unsubscribeUrl: content.unsubscribeUrl,
    });

    if (!result.ok) { res.status(502).json({ error: result.error }); return; }

    // The webhook matches deliveries by provider_message_id. Without storing it
    // here, a test send could never confirm that the whole Resend -> webhook ->
    // suppression chain actually works, which is the one thing worth proving
    // before a real campaign goes out.
    await pool.query(
      `UPDATE promo_recipients SET provider_message_id = $1 WHERE id = $2`,
      [result.messageId ?? null, recipient.rows[0].id]
    );

    res.json({ ok: true, messageId: result.messageId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * A working link to the landing page for the admin's own eyes.
 *
 * The page is unviewable without a recipient token by design, so previewing
 * needs a real recipient. It hangs off a fixed contact on the `.invalid` TLD —
 * reserved by RFC 2606 and guaranteed never to resolve, so it can't be mailed
 * even by accident — and carries source='test', which keeps it out of every
 * recipient selection.
 */
router.get('/campaigns/:id/preview', authMiddleware, async (req, res) => {
  try {
    const { rows: campaignRows } = await pool.query(
      'SELECT slug FROM promo_campaigns WHERE id = $1', [req.params.id]
    );
    if (campaignRows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }

    const contact = await pool.query(
      `INSERT INTO promo_contacts (email, name, role, status, source, unsub_token)
            VALUES ('preview@promo.invalid', 'Preview', 'test', 'rejected', 'test', $1)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
      [newToken()]
    );

    const recipient = await pool.query(
      `INSERT INTO promo_recipients (campaign_id, contact_id, access_token, send_status)
            VALUES ($1, $2, $3, 'skipped')
       ON CONFLICT (campaign_id, contact_id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id
         RETURNING access_token`,
      [req.params.id, contact.rows[0].id, newToken()]
    );

    res.json({ url: promoUrlFor(campaignRows[0].slug, recipient.rows[0].access_token) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** The dashboard the distro never gave you: per-contact engagement. */
router.get('/campaigns/:id/stats', authMiddleware, async (req, res) => {
  try {
    const { rows: campaignRows } = await pool.query('SELECT * FROM promo_campaigns WHERE id = $1', [req.params.id]);
    if (campaignRows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }

    const { rows: recipients } = await pool.query(
      `SELECT r.id, r.send_status, r.sent_at, r.delivered_at, r.opened_at, r.first_visit_at, r.error,
              r.reminder_status, r.reminder_sent_at,
              c.email, c.name, c.role, c.company, c.country, c.source,
              (SELECT COUNT(*)::int FROM promo_events e WHERE e.recipient_id = r.id AND e.type = 'play')     AS plays,
              (SELECT COUNT(*)::int FROM promo_events e WHERE e.recipient_id = r.id AND e.type = 'download') AS downloads,
              (SELECT COUNT(*)::int FROM promo_feedback f WHERE f.recipient_id = r.id)                       AS feedback_count
         FROM promo_recipients r
         JOIN promo_contacts c ON c.id = r.contact_id
        WHERE r.campaign_id = $1
          AND COALESCE(c.source, '') <> 'test'
        ORDER BY (r.first_visit_at IS NULL), r.first_visit_at DESC, c.email ASC`,
      [req.params.id]
    );

    const { rows: feedback } = await pool.query(
      `SELECT f.rating, f.comment, f.created_at,
              c.name, c.email, c.company, c.country, c.role, c.source,
              t.title AS track_title, fav.title AS favourite_track_title
         FROM promo_feedback f
         JOIN promo_recipients r ON r.id = f.recipient_id
         JOIN promo_contacts c   ON c.id = r.contact_id
    LEFT JOIN promo_tracks t     ON t.id = f.track_id
    LEFT JOIN promo_tracks fav   ON fav.id = f.favourite_track_id
        WHERE r.campaign_id = $1
          AND COALESCE(c.source, '') <> 'test'
        ORDER BY f.created_at DESC`,
      [req.params.id]
    );

    // Which track people picked as their favourite — the single most useful
    // number for deciding the lead single.
    const { rows: favourites } = await pool.query(
      `SELECT t.id, t.title, COUNT(f.id)::int AS votes
         FROM promo_tracks t
    LEFT JOIN promo_feedback f ON f.favourite_track_id = t.id
         AND EXISTS (SELECT 1 FROM promo_recipients r JOIN promo_contacts c ON c.id = r.contact_id
                      WHERE r.id = f.recipient_id AND COALESCE(c.source,'') <> 'test')
        WHERE t.campaign_id = $1
     GROUP BY t.id, t.title
     ORDER BY votes DESC, t.position ASC`,
      [req.params.id]
    );

    const { rows: perTrack } = await pool.query(
      `WITH real_recipients AS (
         SELECT r.id FROM promo_recipients r JOIN promo_contacts c ON c.id = r.contact_id
          WHERE COALESCE(c.source,'') <> 'test'
       )
       SELECT t.id, t.title,
              (SELECT COUNT(*)::int FROM promo_events e WHERE e.track_id = t.id AND e.type = 'play'
                 AND e.recipient_id IN (SELECT id FROM real_recipients))     AS plays,
              (SELECT COUNT(*)::int FROM promo_events e WHERE e.track_id = t.id AND e.type = 'complete'
                 AND e.recipient_id IN (SELECT id FROM real_recipients))     AS completes,
              (SELECT COUNT(*)::int FROM promo_events e WHERE e.track_id = t.id AND e.type = 'download'
                 AND e.recipient_id IN (SELECT id FROM real_recipients))     AS downloads,
              (SELECT ROUND(AVG(f.rating)::numeric, 2) FROM promo_feedback f WHERE f.track_id = t.id
                 AND f.recipient_id IN (SELECT id FROM real_recipients))     AS avg_rating
         FROM promo_tracks t
        WHERE t.campaign_id = $1
        ORDER BY t.position ASC, t.id ASC`,
      [req.params.id]
    );

    // Counted in SQL with the same predicate the reminder endpoint uses, rather
    // than re-derived from `recipients` here — two copies of that rule would
    // eventually disagree, and the one on the button is the one people trust.
    const { rows: [remindable] } = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM promo_recipients r
         JOIN promo_contacts c ON c.id = r.contact_id
        WHERE r.campaign_id = $1 AND ${REMINDABLE}`,
      [req.params.id]
    );

    // Two populations that must not be added together: people who were mailed,
    // and people who walked in through the public link and were never mailed at
    // all. Mixing them makes "Recipients" grow every time someone opens a shared
    // link, and quietly changes the denominator of every rate below it.
    const mailed = recipients.filter(r => r.source !== 'share');
    const walkedIn = recipients.filter(r => r.source === 'share');

    const totals = {
      recipients: mailed.length,
      remindable: remindable.n,
      reminderQueued: mailed.filter(r => r.reminder_status === 'queued').length,
      reminderSent: mailed.filter(r => r.reminder_status === 'sent').length,
      queued: mailed.filter(r => r.send_status === 'queued').length,
      // A bounce is a message that went out and came back, so it was sent. Only
      // 'failed' never left. Excluding bounces made Sent read lower than the
      // number of emails actually handed to Resend.
      sent: mailed.filter(r => ['sent', 'delivered', 'bounced'].includes(r.send_status)).length,
      delivered: mailed.filter(r => r.delivered_at).length,
      bounced: mailed.filter(r => r.send_status === 'bounced').length,
      failed: mailed.filter(r => r.send_status === 'failed').length,
      skipped: mailed.filter(r => r.send_status === 'skipped').length,
      visited: mailed.filter(r => r.first_visit_at).length,
      played: mailed.filter(r => r.plays > 0).length,
      downloaded: mailed.filter(r => r.downloads > 0).length,
      // People, not rows: someone who rates the release and a track separately
      // is one opinion, not two.
      feedback: new Set(feedback.filter(f => f.source !== 'share').map(f => f.email)).size,
      shareArrived: walkedIn.length,
      sharePlayed: walkedIn.filter(r => r.plays > 0).length,
      shareFeedback: new Set(feedback.filter(f => f.source === 'share').map(f => f.email)).size,
    };

    res.json({ campaign: campaignRows[0], totals, recipients, feedback, perTrack, favourites });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// ADMIN — email domain health
// ===========================================================================

router.get('/domains', authMiddleware, async (_req, res) => {
  try { res.json(await listDomains()); }
  catch (e: any) { res.status(502).json({ error: e.message }); }
});

router.post('/domains', authMiddleware, async (req, res) => {
  try { res.json(await createDomain(String(req.body?.name || 'criminalcrisis.com'))); }
  catch (e: any) { res.status(502).json({ error: e.message }); }
});

router.get('/domains/:id', authMiddleware, async (req, res) => {
  try { res.json(await getDomain(String(req.params.id))); }
  catch (e: any) { res.status(502).json({ error: e.message }); }
});

router.post('/domains/:id/verify', authMiddleware, async (req, res) => {
  try { res.json(await verifyDomain(String(req.params.id))); }
  catch (e: any) { res.status(502).json({ error: e.message }); }
});

// ===========================================================================
// QUEUE WORKER — called by the hourly GitHub Action
// ===========================================================================

router.post('/queue/drain', async (req, res) => {
  const secret = process.env.PROMO_CRON_SECRET;
  const provided = req.headers['x-cron-secret'];

  if (!secret) { res.status(503).json({ error: 'PROMO_CRON_SECRET not configured' }); return; }
  const a = Buffer.from(String(provided ?? ''));
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    res.json(await drainQueue(req.body?.limit ? Number(req.body.limit) : undefined));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// WEBHOOK — Resend delivery events (Svix-signed)
// ===========================================================================

export async function handleResendWebhook(req: any, res: any) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) { res.status(503).json({ error: 'RESEND_WEBHOOK_SECRET not configured' }); return; }

  if (!verifySvixSignature(req.body as Buffer, req.headers, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let event: any;
  try {
    event = JSON.parse((req.body as Buffer).toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const type: string = event?.type || '';
  const messageId: string | undefined = event?.data?.email_id;
  const to: string | undefined = Array.isArray(event?.data?.to) ? event.data.to[0] : event?.data?.to;

  try {
    if (type === 'email.delivered' && messageId) {
      await pool.query(
        `UPDATE promo_recipients SET send_status = 'delivered', delivered_at = NOW() WHERE provider_message_id = $1`,
        [messageId]
      );
    } else if (type === 'email.opened' && messageId) {
      // Kept for completeness only. Apple Mail Privacy Protection pre-fetches
      // images, so opens are noisy — visits and plays are the real signal.
      await pool.query(
        `UPDATE promo_recipients SET opened_at = COALESCE(opened_at, NOW()) WHERE provider_message_id = $1`,
        [messageId]
      );
    } else if (type === 'email.bounced' || type === 'email.complained') {
      const status = type === 'email.bounced' ? 'bounced' : 'complained';
      if (messageId) {
        await pool.query(
          `UPDATE promo_recipients SET send_status = 'bounced', error = $1 WHERE provider_message_id = $2`,
          [type, messageId]
        );
        // A reminder carries its own message id, so the same event has to be
        // matched against that column too. Recorded on the reminder's own
        // status, never on send_status, so a bounced reminder cannot rewrite
        // the record of a first send that went through fine.
        await pool.query(
          `UPDATE promo_recipients SET reminder_status = 'bounced', error = $1 WHERE reminder_message_id = $2`,
          [type, messageId]
        );
      }
      // Suppress the contact so no future campaign can reach them. Continuing to
      // mail bounces and complaints is the fastest way to wreck a sending domain.
      if (to) {
        await pool.query(
          `UPDATE promo_contacts SET status = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2)`,
          [status, to]
        );
      }
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[promo webhook]', e.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// ===========================================================================
// PUBLIC — unsubscribe & signup
// ===========================================================================

/** GET = human clicked the footer link. POST = RFC 8058 one-click from Gmail. */
async function unsubscribe(token: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE promo_contacts SET status = 'unsubscribed', updated_at = NOW()
      WHERE unsub_token = $1 AND status <> 'unsubscribed'`,
    [token]
  );
  return (rowCount ?? 0) > 0;
}

router.post('/unsubscribe/:token', async (req, res) => {
  await unsubscribe(req.params.token);
  // Always 200 — mail clients retry on errors and the outcome is idempotent.
  res.json({ ok: true });
});

router.get('/unsubscribe/:token', async (req, res) => {
  const found = await pool.query('SELECT email FROM promo_contacts WHERE unsub_token = $1', [req.params.token]);
  await unsubscribe(req.params.token);
  const email = found.rows[0]?.email;
  res.redirect(302, `${siteUrl()}/unsubscribe/${req.params.token}${email ? `?e=${encodeURIComponent(email)}` : ''}`);
});

/**
 * Public "request to join the promo pool" form.
 *
 * Requests land as `pending`, never `active` — the recipient query only ever
 * picks up active contacts, so nothing reaches a send until it's approved by
 * hand. That's the point: the list stays curated rather than open.
 */
router.post('/signup', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'promo-signup' }), async (req, res) => {
  try {
    const { email, name, role, country, company, notes } = req.body;
    const address = cleanAddress(email);
    if (addressProblem(address)) { res.status(400).json({ error: 'Valid email required' }); return; }

    await pool.query(
      `INSERT INTO promo_contacts (email, name, role, country, company, notes, status, source, unsub_token)
            VALUES ($1,$2,$3,$4,$5,$6,'pending','request',$7)
       ON CONFLICT (email) DO UPDATE
              SET name    = COALESCE(NULLIF(EXCLUDED.name, ''), promo_contacts.name),
                  company = COALESCE(NULLIF(EXCLUDED.company, ''), promo_contacts.company),
                  country = COALESCE(NULLIF(EXCLUDED.country, ''), promo_contacts.country),
                  notes   = COALESCE(NULLIF(EXCLUDED.notes, ''), promo_contacts.notes),
                  updated_at = NOW()`,
      // status is deliberately absent from the DO UPDATE: someone already on the
      // list who fills the form again must not be knocked back to pending.
      [address, name || null, (role || 'dj').toLowerCase(),
       country || null, company || null, notes ? String(notes).slice(0, 1000) : null, newToken()]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// PUBLIC — the promo landing itself (token-gated, no login)
// Registered last so `/:slug` cannot shadow the routes above.
// ===========================================================================

const promoLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 300, keyPrefix: 'promo-public' });

type ResolvedRecipient = {
  recipientId: number;
  campaign: any;
  contactName: string | null;
};

async function resolveRecipient(slug: unknown, token: unknown): Promise<ResolvedRecipient | null> {
  if (typeof slug !== 'string' || !slug) return null;
  if (typeof token !== 'string' || token.length < 10) return null;
  const { rows } = await pool.query(
    `SELECT r.id AS recipient_id, c.name AS contact_name, camp.*
       FROM promo_recipients r
       JOIN promo_campaigns camp ON camp.id = r.campaign_id
       JOIN promo_contacts c     ON c.id = r.contact_id
      WHERE camp.slug = $1 AND r.access_token = $2`,
    [slug, token]
  );
  if (rows.length === 0) return null;
  const { recipient_id, contact_name, ...campaign } = rows[0];
  return { recipientId: recipient_id, campaign, contactName: contact_name };
}

const isExpired = (campaign: any) =>
  campaign.expires_at && new Date(campaign.expires_at).getTime() < Date.now();

/**
 * Downloads can be gated on leaving feedback: both a star rating and a written
 * comment on the overall row. Favourite track stays optional.
 *
 * A blank or whitespace-only comment must not count, or the gate is decorative.
 */
/** True when this recipient's contact still has no name — a share-link arrival. */
async function isNameless(recipientId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM promo_recipients r JOIN promo_contacts c ON c.id = r.contact_id
      WHERE r.id = $1 AND COALESCE(c.name, '') = ''`,
    [recipientId]
  );
  return rows.length > 0;
}

async function hasGivenFeedback(recipientId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM promo_feedback
      WHERE recipient_id = $1
        AND track_id IS NULL
        AND rating IS NOT NULL AND rating > 0
        -- Not TRIM(): Postgres only strips spaces, so a comment of newlines or
        -- tabs would slip through. This requires one real character.
        AND comment ~ '[^[:space:]]'
      LIMIT 1`,
    [recipientId]
  );
  return rows.length > 0;
}

/** Which download formats a track can actually offer. */
function downloadFormatsFor(track: any): Array<{ id: string; label: string }> {
  const formats: Array<{ id: string; label: string }> = [];
  const masterFormat = String(track.download_format || '').toLowerCase();

  if (track.mp3_public_id || masterFormat === 'mp3' || track.download_public_id) {
    formats.push({ id: 'mp3', label: 'MP3 320' });
  }
  if (track.download_public_id && LOSSLESS_FORMATS.has(masterFormat)) {
    formats.push({ id: 'wav', label: masterFormat.toUpperCase() });
  }
  return formats;
}

// ===========================================================================
// PUBLIC — share link
//
// A campaign-level link with no personal token in it, for handing to people who
// were never on the list. Opening it costs the visitor nothing: the server mints
// them an anonymous recipient row and redirects straight to the player. No form,
// no gate, music first.
//
// The name is asked later, inside the feedback form they were already filling in
// to unlock the download. Asking up front would put a step in front of the one
// thing that has to be effortless — pressing play.
//
// The reason they get their own row rather than a shared one: the overall
// feedback row is unique per recipient, so several people behind one identity
// would silently overwrite each other's comments.
// ===========================================================================

/** Mints the share link, or returns the existing one. Idempotent on purpose:
 *  regenerating would silently kill a link already sent to people. */
router.post('/campaigns/:id/share', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE promo_campaigns SET share_token = COALESCE(share_token, $2)
        WHERE id = $1 RETURNING share_token`,
      [req.params.id, newToken()]
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ url: `${siteUrl()}/promo/join/${rows[0].share_token}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Revokes the link. People who already opened it keep their own tokens. */
router.delete('/campaigns/:id/share', authMiddleware, async (req, res) => {
  try {
    await pool.query(`UPDATE promo_campaigns SET share_token = NULL WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Turns a share link into a personal one. The only thing standing between the
 * visitor and the music, and it asks them for nothing.
 */
router.post('/share/:shareToken/enter', rateLimit({ windowMs: 60 * 60 * 1000, max: 40, keyPrefix: 'promo-share' }), async (req, res) => {
  try {
    const { rows: campaigns } = await pool.query(
      `SELECT id, slug, expires_at FROM promo_campaigns WHERE share_token = $1`,
      [String(req.params.shareToken)]
    );
    if (campaigns.length === 0 || isExpired(campaigns[0])) {
      res.status(404).json({ error: 'This link is no longer active.' });
      return;
    }
    const campaign = campaigns[0];

    // Unmailable by construction: .invalid can never resolve (RFC 2606) and
    // 'rejected' keeps the row out of every send query regardless. Named later,
    // if and when they leave feedback.
    const { rows: contacts } = await pool.query(
      `INSERT INTO promo_contacts (email, role, status, source, unsub_token)
            VALUES ($1, 'dj', 'rejected', 'share', $2)
         RETURNING id`,
      [`share-${crypto.randomBytes(8).toString('hex')}@promo.invalid`, newToken()]
    );

    const { rows: recipients } = await pool.query(
      `INSERT INTO promo_recipients (campaign_id, contact_id, access_token, send_status)
            VALUES ($1, $2, $3, 'skipped')
         RETURNING access_token`,
      [campaign.id, contacts[0].id, newToken()]
    );

    res.json({ url: promoUrlFor(campaign.slug, recipients[0].access_token) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:slug', promoLimiter, async (req, res) => {
  try {
    const resolved = await resolveRecipient(req.params.slug, req.query.k);
    if (!resolved) { res.status(404).json({ error: 'This promo link is not valid.' }); return; }
    if (isExpired(resolved.campaign)) { res.status(410).json({ error: 'This promo link has expired.' }); return; }

    const { rows: tracks } = await pool.query(
      `SELECT id, position, title, artist_name, stream_public_id, duration_seconds,
              download_public_id, download_format, mp3_public_id
         FROM promo_tracks WHERE campaign_id = $1 ORDER BY position ASC, id ASC`,
      [resolved.campaign.id]
    );

    const { rows: feedback } = await pool.query(
      `SELECT track_id, rating, will_play, comment, favourite_track_id
         FROM promo_feedback WHERE recipient_id = $1`,
      [resolved.recipientId]
    );

    const requiresFeedback = resolved.campaign.require_feedback === 1;
    const downloadsUnlocked = !requiresFeedback || (await hasGivenFeedback(resolved.recipientId));

    await pool.query(
      `UPDATE promo_recipients SET first_visit_at = COALESCE(first_visit_at, NOW()) WHERE id = $1`,
      [resolved.recipientId]
    );
    await pool.query(
      `INSERT INTO promo_events (recipient_id, type, meta) VALUES ($1, 'visit', $2)`,
      [resolved.recipientId, JSON.stringify({ ua: String(req.headers['user-agent'] || '').slice(0, 200) })]
    );

    res.json({
      campaign: {
        title: resolved.campaign.title,
        slug: resolved.campaign.slug,
        body_intro: resolved.campaign.body_intro,
        artwork_url: resolved.campaign.artwork_url,
        release_date: resolved.campaign.release_date,
        download_enabled: resolved.campaign.download_enabled === 1,
        require_feedback: requiresFeedback,
      },
      contactName: resolved.contactName,
      downloadsUnlocked,
      tracks: tracks.map(t => ({
        id: t.id,
        title: t.title,
        artist_name: t.artist_name,
        duration_seconds: t.duration_seconds,
        // Signed per request — never store a playable URL anywhere.
        stream_url: t.stream_public_id ? signedAudioStreamUrl(t.stream_public_id) : null,
        download_formats: downloadFormatsFor(t),
      })),
      feedback,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:slug/event', promoLimiter, async (req, res) => {
  try {
    const resolved = await resolveRecipient(req.params.slug, req.body?.k);
    if (!resolved) { res.status(404).json({ error: 'Invalid link' }); return; }

    const allowed = ['play', 'play_75', 'complete', 'click'];
    const type = String(req.body?.type || '');
    if (!allowed.includes(type)) { res.status(400).json({ error: 'Unknown event type' }); return; }

    await pool.query(
      `INSERT INTO promo_events (recipient_id, track_id, type) VALUES ($1, $2, $3)`,
      [resolved.recipientId, req.body?.track_id ? Number(req.body.track_id) : null, type]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:slug/download/:trackId', promoLimiter, async (req, res) => {
  try {
    const resolved = await resolveRecipient(req.params.slug, req.query.k);
    if (!resolved) { res.status(404).json({ error: 'Invalid link' }); return; }
    if (isExpired(resolved.campaign)) { res.status(410).json({ error: 'This promo link has expired.' }); return; }
    if (resolved.campaign.download_enabled !== 1) { res.status(403).json({ error: 'Downloads are disabled for this promo.' }); return; }

    // Enforced here, not just in the UI — otherwise the URL is a way around it.
    if (resolved.campaign.require_feedback === 1 && !(await hasGivenFeedback(resolved.recipientId))) {
      res.status(403).json({ error: 'Please leave a star rating and a comment before downloading.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT title, artist_name, download_public_id, download_format, mp3_public_id
         FROM promo_tracks WHERE id = $1 AND campaign_id = $2`,
      [req.params.trackId, resolved.campaign.id]
    );
    if (rows.length === 0 || !rows[0].download_public_id) { res.status(404).json({ error: 'Track not found' }); return; }

    const track = rows[0];
    const masterFormat = String(track.download_format || '').toLowerCase();
    const wants = req.query.format === 'wav' ? 'wav' : 'mp3';

    if (wants === 'wav' && !LOSSLESS_FORMATS.has(masterFormat)) {
      res.status(404).json({ error: 'No lossless file available for this track.' });
      return;
    }

    await pool.query(
      `INSERT INTO promo_events (recipient_id, track_id, type, meta) VALUES ($1, $2, 'download', $3)`,
      [resolved.recipientId, req.params.trackId, JSON.stringify({ format: wants })]
    );

    // "Artist - Title", so a DJ's downloads folder stays readable.
    const filename = [track.artist_name, track.title].filter(Boolean).join(' - ') || track.title;

    // Lossless goes out untouched; the 320 is transcoded from the master unless
    // one was uploaded by hand.
    if (wants === 'wav') {
      res.redirect(302, signedAudioAttachmentUrl(track.download_public_id, { format: masterFormat, filename }));
      return;
    }
    if (track.mp3_public_id) {
      res.redirect(302, signedAudioAttachmentUrl(track.mp3_public_id, { format: 'mp3', filename }));
      return;
    }
    if (masterFormat === 'mp3') {
      res.redirect(302, signedAudioAttachmentUrl(track.download_public_id, { format: 'mp3', filename }));
      return;
    }
    res.redirect(302, signedAudioAttachmentUrl(track.download_public_id, { format: 'mp3', bitRate: '320k', filename }));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:slug/feedback', promoLimiter, async (req, res) => {
  try {
    const resolved = await resolveRecipient(req.params.slug, req.body?.k);
    if (!resolved) { res.status(404).json({ error: 'Invalid link' }); return; }

    // Share-link visitors arrive nameless, and this is the only place they are
    // asked. Required, because anonymous feedback tells the label nothing — but
    // only ever written when the contact has no name yet, so editing a comment
    // can never rename someone who was already on the list.
    const nameless = await isNameless(resolved.recipientId);
    const givenName = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (nameless && givenName.length < 2) {
      res.status(400).json({ error: 'Please put your name in so I know whose feedback this is.' });
      return;
    }
    if (nameless) {
      await pool.query(
        `UPDATE promo_contacts c SET name = $1, updated_at = NOW()
           FROM promo_recipients r
          WHERE r.id = $2 AND c.id = r.contact_id AND COALESCE(c.name, '') = ''`,
        [givenName, resolved.recipientId]
      );
    }

    const trackId = req.body?.track_id ? Number(req.body.track_id) : null;
    // 0 means "no rating"; it must survive rather than be clamped up to 1.
    const rating = req.body?.rating != null ? Math.max(0, Math.min(5, Number(req.body.rating))) : null;
    const willPlay = ['yes', 'maybe', 'no'].includes(req.body?.will_play) ? req.body.will_play : null;
    const comment = req.body?.comment ? String(req.body.comment).slice(0, 2000) : null;
    const favourite = req.body?.favourite_track_id ? Number(req.body.favourite_track_id) : null;

    // Two partial unique indexes back this table (track-level and overall), so
    // the conflict target has to be spelled out per case.
    if (trackId === null) {
      await pool.query(
        `INSERT INTO promo_feedback (recipient_id, track_id, rating, will_play, comment, favourite_track_id)
              VALUES ($1, NULL, $2, $3, $4, $5)
         ON CONFLICT (recipient_id) WHERE track_id IS NULL
         DO UPDATE SET rating = EXCLUDED.rating, will_play = EXCLUDED.will_play,
                       comment = EXCLUDED.comment, favourite_track_id = EXCLUDED.favourite_track_id,
                       updated_at = NOW()`,
        [resolved.recipientId, rating, willPlay, comment, favourite]
      );
    } else {
      await pool.query(
        `INSERT INTO promo_feedback (recipient_id, track_id, rating, will_play, comment)
              VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (recipient_id, track_id) WHERE track_id IS NOT NULL
         DO UPDATE SET rating = EXCLUDED.rating, will_play = EXCLUDED.will_play,
                       comment = EXCLUDED.comment, updated_at = NOW()`,
        [resolved.recipientId, trackId, rating, willPlay, comment]
      );
    }

    // Tells the page whether downloads just unlocked, without a reload.
    res.json({ ok: true, downloadsUnlocked: await hasGivenFeedback(resolved.recipientId) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
