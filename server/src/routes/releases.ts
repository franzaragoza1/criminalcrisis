import { Router } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';

const router = Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

function enrichRelease(r: any) {
  const artists = db.prepare(`
    SELECT a.* FROM artists a
    JOIN release_artists ra ON ra.artist_id = a.id
    WHERE ra.release_id = ?
  `).all(r.id);
  return {
    ...r,
    links: JSON.parse(r.links || '{}'),
    tracklist: JSON.parse(r.tracklist || '[]'),
    artists: artists.map((a: any) => ({ ...a, social_links: JSON.parse(a.social_links || '{}') })),
  };
}

// Public
router.get('/', (req, res) => {
  const releases = db.prepare('SELECT * FROM releases ORDER BY release_date DESC').all();
  res.json(releases.map(enrichRelease));
});

router.get('/:slug', (req, res) => {
  const release = db.prepare('SELECT * FROM releases WHERE slug = ?').get(req.params.slug) as any;
  if (!release) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(enrichRelease(release));
});

// Admin
router.post('/', authMiddleware, upload.single('artwork'), (req, res) => {
  const { title, release_date, bandcamp_embed, links, tracklist, artist_ids } = req.body;
  const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const artwork_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const result = db.prepare(
      'INSERT INTO releases (title, slug, release_date, artwork_url, bandcamp_embed, links, tracklist) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(title, slug, release_date || null, artwork_url, bandcamp_embed || null, links || '{}', tracklist || '[]');
    const releaseId = result.lastInsertRowid;
    if (artist_ids) {
      const ids = JSON.parse(artist_ids);
      for (const aid of ids) {
        db.prepare('INSERT OR IGNORE INTO release_artists (release_id, artist_id) VALUES (?, ?)').run(releaseId, aid);
      }
    }
    res.json({ id: releaseId });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authMiddleware, upload.single('artwork'), (req, res) => {
  const existing = db.prepare('SELECT * FROM releases WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { title, release_date, bandcamp_embed, links, tracklist, artist_ids } = req.body;
  const artwork_url = req.file ? `/uploads/${req.file.filename}` : existing.artwork_url;
  const slug = title ? title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : existing.slug;
  db.prepare('UPDATE releases SET title=?, slug=?, release_date=?, artwork_url=?, bandcamp_embed=?, links=?, tracklist=? WHERE id=?')
    .run(title || existing.title, slug, release_date ?? existing.release_date, artwork_url, bandcamp_embed ?? existing.bandcamp_embed, links || existing.links, tracklist || existing.tracklist, req.params.id);
  if (artist_ids) {
    db.prepare('DELETE FROM release_artists WHERE release_id = ?').run(req.params.id);
    const ids = JSON.parse(artist_ids);
    for (const aid of ids) {
      db.prepare('INSERT OR IGNORE INTO release_artists (release_id, artist_id) VALUES (?, ?)').run(req.params.id, aid);
    }
  }
  res.json({ ok: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM releases WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
