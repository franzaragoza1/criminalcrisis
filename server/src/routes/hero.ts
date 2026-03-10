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

router.get('/', (req, res) => {
  const hero = db.prepare('SELECT * FROM hero_content WHERE id = 1').get() as any;
  if (!hero) { res.json({}); return; }

  let featured_release = null;
  if (hero.featured_release_id) {
    featured_release = db.prepare('SELECT * FROM releases WHERE id = ?').get(hero.featured_release_id);
  }
  res.json({ ...hero, featured_release });
});

router.put('/', authMiddleware, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM hero_content WHERE id = 1').get() as any;
  const { tagline, featured_release_id } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : existing?.image_url;
  db.prepare('INSERT OR REPLACE INTO hero_content (id, image_url, tagline, featured_release_id) VALUES (1, ?, ?, ?)')
    .run(image_url, tagline || existing?.tagline, featured_release_id || existing?.featured_release_id || null);
  res.json({ ok: true });
});

export default router;
