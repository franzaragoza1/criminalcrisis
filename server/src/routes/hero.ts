import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';

const router = Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/', async (req, res) => {
  try {
    const heroResult = await pool.query('SELECT * FROM hero_content WHERE id = 1');
    if (heroResult.rows.length === 0) { res.json({}); return; }
    const hero = heroResult.rows[0];

    let featured_release = null;
    if (hero.featured_release_id) {
      const releaseResult = await pool.query('SELECT * FROM releases WHERE id = $1', [hero.featured_release_id]);
      featured_release = releaseResult.rows[0] || null;
    }
    res.json({ ...hero, featured_release });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM hero_content WHERE id = 1');
    const existing = existingResult.rows[0];
    const { tagline, featured_release_id } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : existing?.image_url;
    await pool.query(
      'INSERT INTO hero_content (id, image_url, tagline, featured_release_id) VALUES (1, $1, $2, $3) ON CONFLICT (id) DO UPDATE SET image_url=$1, tagline=$2, featured_release_id=$3',
      [image_url, tagline || existing?.tagline, featured_release_id || existing?.featured_release_id || null]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
