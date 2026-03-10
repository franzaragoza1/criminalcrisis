import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/database.js';
import authRoutes from './routes/auth.js';
import artistRoutes from './routes/artists.js';
import releaseRoutes from './routes/releases.js';
import eventRoutes from './routes/events.js';
import heroRoutes from './routes/hero.js';
import contactRoutes from './routes/contact.js';
import { createPaymentIntent, handleStripeWebhook } from './controllers/paymentController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initDb();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ 
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176'
    ];
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  } 
}));
// 1. WEBHOOK: Debe ir ANTES de express.json() para mantener el buffer 'raw' para Stripe
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

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

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Criminal Crisis API running on http://localhost:${PORT}`);
});
