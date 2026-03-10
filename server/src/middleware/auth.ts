import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const SECRET = process.env.JWT_SECRET || 'criminal-crisis-secret-2024';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, SECRET);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}
