import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';

const router = Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Public
router.get('/', (req, res) => {
  const artists = db.prepare('SELECT * FROM artists ORDER BY name ASC').all();
  res.json(artists.map(a => ({ ...(a as any), social_links: JSON.parse((a as any).social_links || '{}') })));
});

router.get('/:slug', (req, res) => {
  const artist = db.prepare('SELECT * FROM artists WHERE slug = ?').get(req.params.slug) as any;
  if (!artist) { res.status(404).json({ error: 'Not found' }); return; }

  const releases = db.prepare(`
    SELECT r.* FROM releases r
    JOIN release_artists ra ON ra.release_id = r.id
    WHERE ra.artist_id = ?
    ORDER BY r.release_date DESC
  `).all(artist.id);

  res.json({
    ...artist,
    social_links: JSON.parse(artist.social_links || '{}'),
    releases: releases.map((r: any) => ({ ...r, links: JSON.parse(r.links || '{}'), tracklist: JSON.parse(r.tracklist || '[]') })),
  });
});

// Admin
router.post('/', authMiddleware, upload.single('photo'), (req, res) => {
  const { name, bio, social_links } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const result = db.prepare(
      'INSERT INTO artists (name, slug, bio, photo_url, social_links) VALUES (?, ?, ?, ?, ?)'
    ).run(name, slug, bio || null, photo_url, social_links || '{}');
    res.json({ id: result.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authMiddleware, upload.single('photo'), (req, res) => {
  const { name, bio, social_links } = req.body;
  const existing = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const photo_url = req.file ? `/uploads/${req.file.filename}` : existing.photo_url;
  const slug = name ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : existing.slug;
  db.prepare('UPDATE artists SET name=?, slug=?, bio=?, photo_url=?, social_links=? WHERE id=?')
    .run(name || existing.name, slug, bio ?? existing.bio, photo_url, social_links || existing.social_links, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM artists WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
