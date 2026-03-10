import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { uploadToCloudinary } from '../services/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM artists ORDER BY name ASC');
    res.json(result.rows.map(a => ({ ...a, social_links: JSON.parse(a.social_links || '{}') })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const artistResult = await pool.query('SELECT * FROM artists WHERE slug = $1', [req.params.slug]);
    if (artistResult.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const artist = artistResult.rows[0];

    const releasesResult = await pool.query(`
      SELECT r.* FROM releases r
      JOIN release_artists ra ON ra.release_id = r.id
      WHERE ra.artist_id = $1
      ORDER BY r.release_date DESC
    `, [artist.id]);

    res.json({
      ...artist,
      social_links: JSON.parse(artist.social_links || '{}'),
      releases: releasesResult.rows.map(r => ({ ...r, links: JSON.parse(r.links || '{}'), tracklist: JSON.parse(r.tracklist || '[]') })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin
router.post('/', authMiddleware, upload.single('photo'), async (req, res) => {
  const { name, bio, social_links } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const photo_url = req.file ? await uploadToCloudinary(req.file.buffer, 'artists') : null;
  try {
    const result = await pool.query(
      'INSERT INTO artists (name, slug, bio, photo_url, social_links) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, slug, bio || null, photo_url, social_links || '{}']
    );
    res.json({ id: result.rows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM artists WHERE id = $1', [req.params.id]);
    if (existingResult.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const existing = existingResult.rows[0];
    const { name, bio, social_links } = req.body;
    const photo_url = req.file ? await uploadToCloudinary(req.file.buffer, 'artists') : existing.photo_url;
    const slug = name ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : existing.slug;
    await pool.query(
      'UPDATE artists SET name=$1, slug=$2, bio=$3, photo_url=$4, social_links=$5 WHERE id=$6',
      [name || existing.name, slug, bio ?? existing.bio, photo_url, social_links || existing.social_links, req.params.id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM artists WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
