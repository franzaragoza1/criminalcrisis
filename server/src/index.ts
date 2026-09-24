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

app.use('/api/auth', authRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/link-page', linkPageRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/promo', promoRoutes);

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
    res.json({ ok: true, db: 'unchecked' });
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

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Criminal Crisis API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal: could not initialize database, server not started.', err);
    process.exit(1);
  }
})();
