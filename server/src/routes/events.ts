import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { uploadToCloudinary, uploadVideoToCloudinary } from '../services/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

function getFiles(req: any) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return {
    imageFile: files?.['image']?.[0] ?? null,
    videoFile: files?.['video']?.[0] ?? null,
  };
}

// Public
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY event_date ASC');
    res.json(result.rows.map(e => ({ ...e, lineup: JSON.parse(e.lineup || '[]') })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin
router.post('/', authMiddleware, uploadFields, async (req, res) => {
  const { name, event_date, venue, city, lineup, ticket_url, is_past, video_url } = req.body;
  const { imageFile, videoFile } = getFiles(req);
  const image_url = imageFile ? await uploadToCloudinary(imageFile.buffer, 'events') : null;
  // Video file takes priority over typed URL
  const final_video_url = videoFile
    ? await uploadVideoToCloudinary(videoFile.buffer, 'event-videos')
    : (video_url || null);
  try {
    const result = await pool.query(
      'INSERT INTO events (name, event_date, venue, city, lineup, ticket_url, image_url, is_past, video_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [name, event_date, venue || null, city || null, lineup || '[]', ticket_url || null, image_url, is_past === '1' ? 1 : 0, final_video_url]
    );
    res.json({ id: result.rows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authMiddleware, uploadFields, async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (existingResult.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const existing = existingResult.rows[0];
    const { name, event_date, venue, city, lineup, ticket_url, is_past, video_url } = req.body;
    const { imageFile, videoFile } = getFiles(req);
    const image_url = imageFile ? await uploadToCloudinary(imageFile.buffer, 'events') : existing.image_url;
    // Video file takes priority over typed URL; if neither provided, keep existing
    const final_video_url = videoFile
      ? await uploadVideoToCloudinary(videoFile.buffer, 'event-videos')
      : video_url !== undefined ? (video_url || null) : existing.video_url;
    await pool.query(
      'UPDATE events SET name=$1, event_date=$2, venue=$3, city=$4, lineup=$5, ticket_url=$6, image_url=$7, is_past=$8, video_url=$9 WHERE id=$10',
      [name || existing.name, event_date || existing.event_date, venue ?? existing.venue, city ?? existing.city, lineup || existing.lineup, ticket_url ?? existing.ticket_url, image_url, is_past !== undefined ? (is_past === '1' ? 1 : 0) : existing.is_past, final_video_url, req.params.id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
