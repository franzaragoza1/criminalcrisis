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

function enrichEvent(e: any) {
  return { ...e, lineup: JSON.parse(e.lineup || '[]') };
}

// Public
router.get('/', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY event_date ASC').all();
  res.json(events.map(enrichEvent));
});

// Admin
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  const { name, event_date, venue, city, lineup, ticket_url, is_past } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const result = db.prepare(
      'INSERT INTO events (name, event_date, venue, city, lineup, ticket_url, image_url, is_past) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, event_date, venue || null, city || null, lineup || '[]', ticket_url || null, image_url, is_past ? 1 : 0);
    res.json({ id: result.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, event_date, venue, city, lineup, ticket_url, is_past } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : existing.image_url;
  db.prepare('UPDATE events SET name=?, event_date=?, venue=?, city=?, lineup=?, ticket_url=?, image_url=?, is_past=? WHERE id=?')
    .run(name || existing.name, event_date || existing.event_date, venue ?? existing.venue, city ?? existing.city, lineup || existing.lineup, ticket_url ?? existing.ticket_url, image_url, is_past !== undefined ? (is_past ? 1 : 0) : existing.is_past, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
