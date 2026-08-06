import type { Request, Response, NextFunction } from 'express';

/**
 * In-memory fixed-window rate limiter.
 *
 * The API runs as a single instance, so a shared store would be overkill. The
 * point here is to stop someone brute-forcing promo access tokens or hammering
 * the public signup form, not to survive a distributed attack.
 */
type Bucket = { count: number; resetAt: number };

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, keyPrefix = '' } = options;

  // Evict expired buckets periodically so the map cannot grow unbounded.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs);
  sweeper.unref?.();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many requests, slow down.' });
      return;
    }

    next();
  };
}
