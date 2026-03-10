import Stripe from 'stripe';
import { Request, Response } from 'express';
import { createPrintfulOrder } from '../services/printfulService.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    // En un sistema real esto se calcularía en backend mirando la DB. 
    // Por simplicidad, sabemos que la gorra cuesta $18.00 (1800 centavos)
    const amount = 1800;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        // Podrías guardar info del carrito aquí para usarla luego
        cartInfo: JSON.stringify(items),
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    res.status(400).send({ error: { message: error.message } });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    // Usamos el cuerpo sin parsear (Buffer) proveído por express.raw()
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log('PaymentIntent was successful!');
      
      try {
        // En una app real, el shipping vendría en el paymentIntent si lo recoges con Stripe Elements
        // Aquí pasamos el intent para extraer datos
        await createPrintfulOrder(paymentIntent);
      } catch (printfulError) {
        console.error('Failed to create Printful order:', printfulError);
        // Aun así devolvemos 200 a Stripe para que no reintente
      }
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.send();
};