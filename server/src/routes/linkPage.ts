import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { uploadToCloudinary } from '../services/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Not a product limit — a guard. How many links belong on the page is the
 * editor's call, but an unbounded array would let one bad paste put a megabyte
 * of JSON in a TEXT column and into every render of the page.
 */
const MAX_BUTTONS = 50;
const MAX_FOOTER_LINKS = 20;

/**
 * The serverless renderer writes these URLs straight into an href, so an
 * unsafe scheme would be a stored XSS vector. Only an authenticated admin can
 * reach the write path, but the check costs nothing and the blast radius of
 * getting it wrong is the whole page.
 */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/**
 * How a link is presented, following the two shapes Linktree settled on plus
 * the inline player:
 *   classic  — compact text button
 *   featured — expanded card with a preview image
 *   embed    — the provider's own player, playable without leaving the page
 */
const LAYOUTS = ['classic', 'featured', 'embed'] as const;
type Layout = (typeof LAYOUTS)[number];

export type LinkItem = {
  label: string;
  url: string;
  note?: string;
  layout?: Layout;
  image?: string;
  embed?: string;
};

/**
 * Turns whatever the editor pasted into a player URL we are willing to render.
 *
 * People paste what the provider's share dialog hands them, which is usually a
 * whole <iframe> tag, sometimes a page URL, occasionally just a Bandcamp id.
 * All three are accepted and normalised to a URL here, so the database only
 * ever holds something the renderer can put in a src.
 *
 * Anything outside this list is rejected rather than passed through: an iframe
 * src is a script-execution context, and "whatever the admin typed" is not an
 * acceptable source for one.
 */
export function resolveEmbed(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;

  // Share dialogs hand out a full embed snippet; take the src out of it.
  const fromIframe = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (fromIframe) value = fromIframe[1].trim();
  if (value.startsWith('//')) value = 'https:' + value;

  // Bandcamp: the numeric id is not in the page URL, so an id on its own is the
  // one thing an editor can realistically copy for it.
  const bareBandcampId = value.match(/^(album|track)=(\d+)$/i);
  if (bareBandcampId) {
    return `https://bandcamp.com/EmbeddedPlayer/${bareBandcampId[1].toLowerCase()}=${bareBandcampId[2]}/size=large/bgcol=ffffff/linkcol=333333/artwork=small/transparent=true/`;
  }
  if (/^https:\/\/bandcamp\.com\/EmbeddedPlayer\//i.test(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`No entiendo ese reproductor: ${raw.slice(0, 80)}`);
  }
  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'soundcloud.com' || host === 'm.soundcloud.com') {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
      'https://soundcloud.com' + parsed.pathname
    )}&color=%23111111&hide_related=true&show_comments=false&show_teaser=false`;
  }
  if (host === 'w.soundcloud.com') return value;

  const spotify = parsed.pathname.match(
    /^\/(?:embed\/)?(artist|album|track|playlist|episode|show)\/([A-Za-z0-9]+)/
  );
  if (host === 'open.spotify.com' && spotify) {
    return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`;
  }

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/embed\/([\w-]+)/)?.[1];
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
  }

  throw new Error(
    `Reproductor no soportado: ${host}. Se admiten Bandcamp, SoundCloud, Spotify y YouTube.`
  );
}

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
    const rawLayout = String(item.layout ?? 'classic').trim() as Layout;
    const layout: Layout = (LAYOUTS as readonly string[]).includes(rawLayout) ? rawLayout : 'classic';

    const image = String(item.image ?? '').trim();
    if (image && !/^https?:\/\//i.test(image)) {
      throw new Error(`La imagen de "${label}" debe ser una URL http(s)`);
    }

    // With no player pasted, fall back to the button's own link — for
    // SoundCloud, Spotify and YouTube that is all the information needed, so
    // the common case costs the editor nothing but ticking a box.
    let embed: string | null = null;
    if (layout === 'embed') {
      embed = resolveEmbed(String(item.embed ?? '').trim() || url);
    }

    const entryOut: LinkItem = { label, url };
    if (note) entryOut.note = note;
    if (layout !== 'classic') entryOut.layout = layout;
    if (image) entryOut.image = image;
    if (embed) entryOut.embed = embed;
    out.push(entryOut);
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
    schema_type: row.schema_type,
    photo_url: row.photo_url,
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
router.put(
  '/:slug',
  authMiddleware,
  // Two independent images: the portrait on the page, and the card other apps
  // render when the link is shared. Either, both or neither may be replaced.
  upload.fields([
    { name: 'og_image', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  async (req, res) => {
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

    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const ogFile = files.og_image?.[0];
    const photoFile = files.photo?.[0];

    const ogImage = ogFile
      ? await uploadToCloudinary(ogFile.buffer, 'link-pages')
      : existing.og_image_url;
    const photo = photoFile
      ? await uploadToCloudinary(photoFile.buffer, 'link-pages')
      : existing.photo_url;

    // `??` and not `||`: clearing the city field must actually clear it, and an
    // empty string is a legitimate value here.
    const pick = (v: unknown, fallback: unknown) => (v === undefined ? fallback : String(v).trim());

    await pool.query(
      `UPDATE link_pages SET
         display_name = $1, tagline = $2, city = $3, alternate_name = $4,
         seo_title = $5, seo_description = $6, og_image_url = $7, photo_url = $8,
         buttons = $9, footer_links = $10, updated_at = NOW()
       WHERE slug = $11`,
      [
        pick(b.display_name, existing.display_name) || existing.display_name,
        pick(b.tagline, existing.tagline),
        pick(b.city, existing.city),
        pick(b.alternate_name, existing.alternate_name),
        pick(b.seo_title, existing.seo_title),
        pick(b.seo_description, existing.seo_description),
        ogImage,
        photo,
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
  }
);

export default router;
