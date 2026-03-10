import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken({ id: user.id, username: user.username });
  res.json({ token, username: user.username });
});

export default router;
