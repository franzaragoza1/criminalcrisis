import { Router } from 'express';
import { pool } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import { toCsv } from '../lib/csv.js';
import { cleanAddress, addressProblem } from '../lib/email.js';
import { sendTransactionalEmail } from '../services/resend.js';
import { siteUrl } from '../services/promoQueue.js';
import {
  merchConfirmationSubject,
  renderMerchConfirmationHtml,
  renderMerchConfirmationText,
} from '../services/merchEmail.js';

const router = Router();

/**
 * What can be reserved, and in which sizes. Kept here rather than trusted from
 * the client so a crafted request cannot invent a product or a size that then
 * shows up in the stock totals. Name, price and image feed the confirmation
 * email; keep them in step with ShopSection.tsx.
 */
type Product = { name: string; price: number; image: string; sizes: string[] };

const PRODUCTS: Record<string, Product> = {
  'unpaid-collab-tee': {
    name: 'Unpaid Collab Tee',
    price: 20,
    image: '/img/merch/unpaid-collab-tee.jpg',
    sizes: ['S', 'M', 'L', 'XL'],
  },
};

const SIZES = Object.fromEntries(Object.entries(PRODUCTS).map(([id, p]) => [id, p.sizes]));

const STATUSES = new Set(['reserved', 'contacted']);

// ===========================================================================
// PUBLIC — pre-save form
// ===========================================================================

/**
 * Reserving the same size twice is a no-op rather than an error: the fan sees
 * the same confirmation, and the totals are not inflated by a double click.
 *
 * The confirmation email goes out only for a new reservation. Resending on a
 * repeat would let anyone use this form to mail an arbitrary address on loop.
 * It is sent after answering, and a failure only logs: the reservation is what
 * matters, and the fan already saw it succeed.
 */
router.post('/reserve', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'merch-reserve' }), async (req, res) => {
  try {
    const { product, size, name, email } = req.body;
    const item = PRODUCTS[product];
    if (!item) { res.status(400).json({ error: 'Unknown product' }); return; }
    if (!item.sizes.includes(size)) { res.status(400).json({ error: 'Choose a size' }); return; }

    const address = cleanAddress(email);
    if (addressProblem(address)) { res.status(400).json({ error: 'Valid email required' }); return; }

    const cleanName = name ? String(name).trim().slice(0, 200) : null;
    // xmax = 0 only on a freshly inserted row, which tells a new reservation
    // from a repeat without a second query.
    const { rows } = await pool.query(
      `INSERT INTO merch_reservations (product, size, name, email)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (product, email, size) DO UPDATE
              SET name = COALESCE(NULLIF(EXCLUDED.name, ''), merch_reservations.name),
                  updated_at = NOW()
       RETURNING id, (xmax = 0) AS inserted`,
      [product, size, cleanName, address]
    );
    res.json({ ok: true });

    if (!rows[0].inserted) return;
    const confirmation = {
      reservationId: rows[0].id,
      name: cleanName,
      productName: item.name,
      productImage: `${siteUrl()}${item.image}`,
      size,
      price: item.price,
    };
    sendTransactionalEmail({
      to: address,
      subject: merchConfirmationSubject(confirmation),
      html: renderMerchConfirmationHtml(confirmation),
      text: renderMerchConfirmationText(confirmation),
    })
      .then(r => { if (!r.ok) console.error(`[merch] confirmation to ${address} failed: ${r.error}`); })
      .catch(e => console.error(`[merch] confirmation to ${address} failed: ${e.message}`));
  } catch (e: any) {
    if (res.headersSent) { console.error('[merch] reserve:', e.message); return; }
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// ADMIN
// ===========================================================================

router.get('/reservations', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, product, size, name, email, status, created_at
         FROM merch_reservations ORDER BY created_at DESC`
    );
    res.json({ reservations: rows, sizes: SIZES });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reservations/export.csv', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT product, size, name, email, status, created_at
         FROM merch_reservations ORDER BY created_at ASC`
    );
    const csv = toCsv(
      ['product', 'size', 'name', 'email', 'status', 'created_at'],
      rows.map(r => [r.product, r.size, r.name, r.email, r.status, r.created_at?.toISOString?.() ?? r.created_at])
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="criminalcrisis-presaves-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/reservations/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.has(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
    await pool.query(
      'UPDATE merch_reservations SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/reservations/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM merch_reservations WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
