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
app.use('/api/contact', contactRoutes);
app.use('/api/promo', promoRoutes);

/**
 * Keep-alive target as well as a health check, which is why it touches the
 * database.
 *
 * Two things hibernate independently here: Render's web service sleeps after
 * ~15 minutes idle, and Neon suspends its compute after ~5. A ping that only
 * proves Express is listening wakes the first and never the second, so the
 * first real page load still pays for waking the database.
 *
 * It answers 200 even when the query fails, on purpose. An uptime pinger that
 * sees repeated non-2xx responses disables the job, and a disabled pinger is
 * how the server ends up asleep for good — exactly the failure this endpoint
 * exists to prevent. The `db` field carries the bad news instead.
 */
app.get('/api/health', async (_, res) => {
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
