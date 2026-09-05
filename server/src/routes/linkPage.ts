import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { uploadToCloudinary } from '../services/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * A link page is deliberately capped. The point of /frankydrama is that someone
 * arriving from Instagram understands who this is and where to listen within a
 * few seconds; a twenty-link wall defeats that, so the limit is enforced here
 * and not only in the admin form.
 */
const MAX_BUTTONS = 7;
const MAX_FOOTER_LINKS = 6;

/**
 * The serverless renderer writes these URLs straight into an href, so an
 * unsafe scheme would be a stored XSS vector. Only an authenticated admin can
 * reach the write path, but the check costs nothing and the blast radius of
 * getting it wrong is the whole page.
 */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export type LinkItem = { label: string; url: string; note?: string };

function parseItems(raw: unknown, max: number): LinkItem[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      throw new Error('Malformed link list');
    }
  }
  if (!Array.isArray(list)) return [];

  const out: LinkItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const label = String(item.label ?? '').trim();
    const url = String(item.url ?? '').trim();
    // A row the editor added but never filled in is dropped rather than saved
    // as an empty button.
    if (!label || !url) continue;
    if (!SAFE_URL.test(url)) throw new Error(`Unsupported link: ${url}`);
    const note = String(item.note ?? '').trim();
    out.push(note ? { label, url, note } : { label, url });
    if (out.length >= max) break;
  }
  return out;
}

function serialize(row: Record<string, any>) {
  return {
    slug: row.slug,
    display_name: row.display_name,
    tagline: row.tagline,
    city: row.city,
    alternate_name: row.alternate_name,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    og_image_url: row.og_image_url,
    buttons: parseItems(row.buttons, MAX_BUTTONS),
    footer_links: parseItems(row.footer_links, MAX_FOOTER_LINKS),
    updated_at: row.updated_at,
  };
}

// Public. Read by the /frankydrama renderer on every cache revalidation.
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM link_pages WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(serialize(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin. One save covers the whole page: text, buttons, footer and SEO.
router.put('/:slug', authMiddleware, upload.single('og_image'), async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM link_pages WHERE slug = $1', [req.params.slug]);
    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const existing = existingResult.rows[0];
    const b = req.body ?? {};

    const buttons = b.buttons === undefined
      ? existing.buttons
      : JSON.stringify(parseItems(b.buttons, MAX_BUTTONS));
    const footerLinks = b.footer_links === undefined
      ? existing.footer_links
      : JSON.stringify(parseItems(b.footer_links, MAX_FOOTER_LINKS));

    const ogImage = req.file
      ? await uploadToCloudinary(req.file.buffer, 'link-pages')
      : existing.og_image_url;

    // `??` and not `||`: clearing the city field must actually clear it, and an
    // empty string is a legitimate value here.
    const pick = (v: unknown, fallback: unknown) => (v === undefined ? fallback : String(v).trim());

    await pool.query(
      `UPDATE link_pages SET
         display_name = $1, tagline = $2, city = $3, alternate_name = $4,
         seo_title = $5, seo_description = $6, og_image_url = $7,
         buttons = $8, footer_links = $9, updated_at = NOW()
       WHERE slug = $10`,
      [
        pick(b.display_name, existing.display_name) || existing.display_name,
        pick(b.tagline, existing.tagline),
        pick(b.city, existing.city),
        pick(b.alternate_name, existing.alternate_name),
        pick(b.seo_title, existing.seo_title),
        pick(b.seo_description, existing.seo_description),
        ogImage,
        buttons,
        footerLinks,
        req.params.slug,
      ]
    );

    const updated = await pool.query('SELECT * FROM link_pages WHERE slug = $1', [req.params.slug]);
    res.json(serialize(updated.rows[0]));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
