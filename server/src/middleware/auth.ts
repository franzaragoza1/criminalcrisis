import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * This used to fall back to a hardcoded literal, which meant anyone reading the
 * repo could mint valid admin tokens. That was survivable when the database held
 * only public discography data; it is not now that it holds a private contact
 * list. Production must supply a real secret.
 */
function resolveSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    if (fromEnv.length < 32) {
      console.warn('[auth] JWT_SECRET is shorter than 32 characters — consider regenerating it.');
    }
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production. Refusing to start with a default secret.');
  }

  // Dev convenience: a random per-process secret keeps things working locally
  // without ever shipping a guessable one. Admin sessions reset on restart.
  console.warn('[auth] JWT_SECRET not set — using a random secret for this process only.');
  return crypto.randomBytes(48).toString('base64url');
}

const SECRET = resolveSecret();

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
