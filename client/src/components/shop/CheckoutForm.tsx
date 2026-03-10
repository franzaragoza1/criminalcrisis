import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement, AddressElement } from '@stripe/react-stripe-js';

export const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js no se ha cargado aún.
      return;
    }

    setIsLoading(true);

    // Stripe Elements Address Component o campos de envío manuales son necesarios 
    // para que paymentIntent.shipping no sea null (Printful necesita la dirección).
    // Usamos elements directamente.

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Redirigir a esta URL tras el pago
        // Puedes cambiarlo a una página de success si prefieres un flujo con redirección
        // Si no quieres redirigir y manejar el estado en el cliente (solo en algunos casos),
        // consulta la doc de Stripe para redirect: "if_required".
        return_url: `${window.location.origin}/checkout-success`,
      },
      redirect: "if_required"
    });

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setErrorMessage(error.message || 'Ha ocurrido un error con su tarjeta.');
      } else {
        setErrorMessage('Ha ocurrido un error inesperado.');
      }
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setPaymentSucceeded(true);
      // Aquí también podrías limpiar el carrito de compras en el estado global
    }

    setIsLoading(false);
  };

  if (paymentSucceeded) {
    return (
      <div>
        <h2>¡Pago exitoso!</h2>
        <p>Tu pedido está siendo procesado y te lo enviaremos pronto.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      
      <div className="w-full">
        <h3 className="font-bold mb-4 uppercase tracking-wide text-sm text-[#888]">1. Datos de Envío</h3>
        <AddressElement options={{mode: 'shipping', fields: {phone: 'always'}, validation: { phone: { required: 'always' }}}} />
      </div>
      
      <div className="w-full mt-8">
        <h3 className="font-bold mb-4 uppercase tracking-wide text-sm text-[#888]">2. Datos de Pago</h3>
        <PaymentElement 
          id="payment-element" 
          options={{ 
            layout: 'tabs',
            wallets: {
              applePay: 'never',
              googlePay: 'never'
            }
          }} 
        />
      </div>
      
      <button 
        disabled={isLoading || !stripe || !elements} 
        id="submit"
        className="w-full mt-8 bg-white text-black font-black uppercase py-4 rounded hover:bg-gray-200 disabled:bg-[#333] disabled:text-[#666] transition-colors"
      >
        <span id="button-text">
          {isLoading ? "Procesando pago seguro..." : "Pagar $18.00"}
        </span>
      </button>

      {errorMessage && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {errorMessage}
        </div>
      )}
    </form>
  );
};
