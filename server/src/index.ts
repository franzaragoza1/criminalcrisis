import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool } from './db/database.js';
import authRoutes from './routes/auth.js';
import artistRoutes from './routes/artists.js';
import releaseRoutes from './routes/releases.js';
import eventRoutes from './routes/events.js';
import heroRoutes from './routes/hero.js';
import linkPageRoutes from './routes/linkPage.js';
import contactRoutes from './routes/contact.js';
import promoRoutes, { handleResendWebhook } from './routes/promo.js';
import { createPaymentIntent, handleStripeWebhook } from './controllers/paymentController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.startsWith('http://localhost:') ||
      origin.endsWith('.criminalcrisis.com') ||
      origin === 'https://criminalcrisis.com' ||
      origin.endsWith('.vercel.app') ||
      origin === process.env.CLIENT_URL
    ) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  }
}));
// 1. WEBHOOKS: Deben ir ANTES de express.json() para mantener el buffer 'raw',
// necesario para verificar la firma (Stripe y Svix firman el cuerpo sin parsear)
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.post('/api/promo/webhook/resend', express.raw({ type: 'application/json' }), handleResendWebhook);

// MIDDLEWARE para parsear JSON en el resto de peticiones
app.use(express.json());

// 2. RESTO DE PAGOS: Pueden usar el JSON parseado
app.post('/api/payment/create-payment-intent', createPaymentIntent);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/**
 * Refuses DB-backed traffic until the schema check has actually passed, rather
 * than letting every route fail one query at a time with whatever message the
 * provider happens to return. 503 is the honest answer: the service exists, it
 * cannot serve this yet, and the client should come back.
 */
let dbReady = false;

const requireDb: express.RequestHandler = (_req, res, next) => {
  if (dbReady) { next(); return; }
  res.status(503).json({ error: 'Database unavailable, retrying' });
};

app.use('/api/auth', requireDb, authRoutes);
app.use('/api/artists', requireDb, artistRoutes);
app.use('/api/releases', requireDb, releaseRoutes);
app.use('/api/events', requireDb, eventRoutes);
app.use('/api/hero', requireDb, heroRoutes);
app.use('/api/link-page', requireDb, linkPageRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/promo', requireDb, promoRoutes);

/**
 * Keep-alive target as well as a health check. It deliberately does NOT touch
 * the database.
 *
 * Two things hibernate independently here: Render's web service sleeps after
 * ~15 minutes idle, and Neon suspends its compute after ~5. Making the ping
 * wake both looks like a free win and is the opposite: a ping frequent enough
 * to keep Render awake is frequent enough that Neon's compute never suspends,
 * which is ~720 compute-hours a month against a free allowance of a couple of
 * hundred. That is how this project exhausted its quota in three weeks with
 * almost no visitors, and every DB-backed endpoint answered 500 until the
 * billing cycle rolled over.
 *
 * So the ping wakes Express only. Letting the database suspend costs the first
 * visitor after an idle spell about a second while Neon resumes — measured at
 * 2.35s falling to 0.64s as the connection warms. Keeping it awake costs the
 * whole site, for days.
 *
 * `?db=1` runs the connectivity check on demand, for when you actually want to
 * know. Keep it off the pinger's URL. It answers 200 even when the query
 * fails, on purpose: an uptime pinger that sees repeated non-2xx disables the
 * job, and a disabled pinger is how the service ends up asleep for good. The
 * `db` field carries the bad news instead.
 */
app.get('/api/health', async (req, res) => {
  if (req.query.db === undefined) {
    // Reports what the process already knows, which costs no query at all.
    res.json({ ok: true, db: dbReady ? 'ready' : 'initialising' });
    return;
  }

  const started = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', ms: Date.now() - started });
  } catch (e: any) {
    console.error('[health] database unreachable:', e.message);
    res.json({ ok: true, db: 'down', ms: Date.now() - started });
  }
});

/**
 * The server listens first and initialises the database afterwards, retrying in
 * the background until it succeeds.
 *
 * It used to be the other way round: `initDb()` first, `process.exit(1)` if it
 * threw. That turns any database outage into an undeployable service, which is
 * how the quota incident of 2026-09-23 nearly trapped us — the fix that stops
 * the database being hammered could not ship, because shipping required the
 * database to be up. It also took down routes that need no database at all,
 * including the health check a pinger uses to decide the service is alive.
 *
 * Booting anyway costs nothing: `requireDb` answers 503 on the data routes
 * until the schema check passes, so the failure is visible and honest instead
 * of silent.
 */
async function initDbWithRetry() {
  // Caps at ~2 minutes. Long enough not to hammer a database that is down,
  // short enough that a service which boots mid-outage recovers on its own.
  let delayMs = 2_000;
  for (;;) {
    try {
      await initDb();
      dbReady = true;
      console.log('Database ready.');
      return;
    } catch (err: any) {
      console.error(`[db] init failed (${err.message}); retrying in ${delayMs / 1000}s`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 120_000);
    }
  }
}

app.listen(PORT, () => {
  console.log(`Criminal Crisis API running on http://localhost:${PORT}`);
});

initDbWithRetry();
