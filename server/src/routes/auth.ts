import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/database.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  try {
    const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = signToken({ id: user.id, username: user.username });
    res.json({ token, username: user.username });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
