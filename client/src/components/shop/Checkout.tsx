import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from './CheckoutForm';

// Obtenemos la clave de Stripe de forma segura desde las variables de entorno
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

// Si falta la clave o tiene el placeholder, forzaremos un error visible para el dev
let stripePromise: Promise<Stripe | null> | null = null;
if (stripePublicKey && stripePublicKey !== 'pk_test_tu_clave_publica_aqui') {
  stripePromise = loadStripe(stripePublicKey);
}

interface CartItem {
  id: string;
  sync_variant_id: number;
  quantity: number;
}

interface CheckoutProps {
  items: CartItem[];
}

export const Checkout: React.FC<CheckoutProps> = ({ items }) => {
  const [clientSecret, setClientSecret] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    // Intentamos hacer fetch pasándolo por el proxy o directamente al puerto del servidor si fallara
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/payment/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setClientSecret(data.clientSecret))
      .catch((error) => {
        console.error("Error al obtener el clientSecret de Stripe:", error);
        setErrorMsg(`Error conectando con el servidor de pagos: ${error.message}`);
      });
  }, [items]);

  // Usamos el tema 'night' nativo de Stripe.
  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#ffffff',
      colorBackground: '#1a1a1a', // Mismo color de tu recuadro de la web
      colorText: '#ffffff',
    }
  };
  
  const options = {
    clientSecret,
    appearance,
  };

  // 1. Validación estricta de la clave de Stripe
  if (!stripePromise) {
    return (
      <div className="bg-red-900/50 p-6 border-l-4 border-red-500 rounded-r text-red-200 mt-4">
        <h4 className="font-black text-xl mb-2 text-white">⚠️ FALTA CLAVE DE STRIPE</h4>
        <p className="mb-2">El formulario seguro no puede cargar porque falta tu clave pública de Stripe.</p>
        <p className="text-sm opacity-80">Por favor, abre el archivo <code>client/.env</code> y añade tu clave real en <code>VITE_STRIPE_PUBLIC_KEY</code>. Luego reinicia el servidor frontend.</p>
      </div>
    );
  }

  // 2. Renderizado normal del Checkout
  return (
    <div className="Checkout">
      {errorMsg ? (
        <div className="bg-red-900/50 p-4 border-l-4 border-red-500 rounded-r text-red-200">
          <p className="font-bold text-white mb-1">Error de Servidor</p>
          <p>{errorMsg}</p>
        </div>
      ) : clientSecret ? (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-[#888]">
          <div className="w-10 h-10 border-4 border-t-[#fff] border-[#333] rounded-full animate-spin mb-6"></div>
          <p className="font-semibold uppercase tracking-widest text-sm">Conectando pasarela segura...</p>
          <p className="text-xs opacity-50 mt-2">Cifrado de extremo a extremo</p>
        </div>
      )}
    </div>
  );
};