import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { uploadToCloudinary } from '../services/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function enrichRelease(r: any) {
  const artistsResult = await pool.query(`
    SELECT a.* FROM artists a
    JOIN release_artists ra ON ra.artist_id = a.id
    WHERE ra.release_id = $1
  `, [r.id]);
  return {
    ...r,
    links: JSON.parse(r.links || '{}'),
    tracklist: JSON.parse(r.tracklist || '[]'),
    artists: artistsResult.rows.map(a => ({ ...a, social_links: JSON.parse(a.social_links || '{}') })),
  };
}

// Public
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM releases ORDER BY release_date DESC');
    const releases = await Promise.all(result.rows.map(enrichRelease));
    res.json(releases);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM releases WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(await enrichRelease(result.rows[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin
router.post('/', authMiddleware, upload.single('artwork'), async (req, res) => {
  const { title, release_date, bandcamp_embed, links, tracklist, artist_ids } = req.body;
  const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const artwork_url = req.file ? await uploadToCloudinary(req.file.buffer, 'releases') : null;
  try {
    const result = await pool.query(
      'INSERT INTO releases (title, slug, release_date, artwork_url, bandcamp_embed, links, tracklist) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [title, slug, release_date || null, artwork_url, bandcamp_embed || null, links || '{}', tracklist || '[]']
    );
    const releaseId = result.rows[0].id;
    if (artist_ids) {
      const ids = JSON.parse(artist_ids);
      for (const aid of ids) {
        await pool.query(
          'INSERT INTO release_artists (release_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [releaseId, aid]
        );
      }
    }
    res.json({ id: releaseId });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authMiddleware, upload.single('artwork'), async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM releases WHERE id = $1', [req.params.id]);
    if (existingResult.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const existing = existingResult.rows[0];
    const { title, release_date, bandcamp_embed, links, tracklist, artist_ids } = req.body;
    const artwork_url = req.file ? await uploadToCloudinary(req.file.buffer, 'releases') : existing.artwork_url;
    const slug = title ? title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : existing.slug;
    await pool.query(
      'UPDATE releases SET title=$1, slug=$2, release_date=$3, artwork_url=$4, bandcamp_embed=$5, links=$6, tracklist=$7 WHERE id=$8',
      [title || existing.title, slug, release_date ?? existing.release_date, artwork_url, bandcamp_embed ?? existing.bandcamp_embed, links || existing.links, tracklist || existing.tracklist, req.params.id]
    );
    if (artist_ids) {
      await pool.query('DELETE FROM release_artists WHERE release_id = $1', [req.params.id]);
      const ids = JSON.parse(artist_ids);
      for (const aid of ids) {
        await pool.query(
          'INSERT INTO release_artists (release_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, aid]
        );
      }
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM releases WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
