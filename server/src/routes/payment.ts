import express from 'express';
import { createPaymentIntent, handleStripeWebhook } from '../controllers/paymentController.js';

const router = express.Router();

// Parse raw body for Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
router.post('/create-payment-intent', createPaymentIntent);

export default router;