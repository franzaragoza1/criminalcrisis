import Stripe from 'stripe';

export const createPrintfulOrder = async (paymentIntent: Stripe.PaymentIntent) => {
  const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

  if (!PRINTFUL_API_KEY) {
    throw new Error('PRINTFUL_API_KEY is not defined in environment variables');
  }

  // Extraer información del shipping del payment intent
  // Nota: Al usar PaymentElement, asegúrate de recoger el shipping details en el frontend
  // o utilizar un elemento de dirección de Stripe
  const shipping = paymentIntent.shipping;

  if (!shipping) {
    throw new Error('No shipping information available in payment intent');
  }

  const itemsMetadata = paymentIntent.metadata?.cartInfo;
  let items = [];
  try {
    items = itemsMetadata ? JSON.parse(itemsMetadata) : [];
  } catch (e) {
    console.warn('Could not parse items from metadata, using default item.');
  }

  // Si no hay items mapeados correctamente o no envían sync_variant_id
  if (!items || items.length === 0 || !items[0].sync_variant_id) {
    console.warn("No items or sync_variant_id mapped properly. Defaulting to Black CCap.");
    items = [
      {
        sync_variant_id: 5227517429, // ID de la variante de "CCap / Black"
        quantity: 1,
      },
    ];
  } else {
    // Si viene del frontend correctamente, mapeamos para Printful
    // Printful usa `sync_variant_id`
    items = items.map((item: any) => ({
      sync_variant_id: item.sync_variant_id,
      quantity: item.quantity || 1
    }));
  }

  // Construir la carga útil de la solicitud a Printful según sus docs
  const orderPayload = {
    recipient: {
      name: shipping.name,
      address1: shipping.address?.line1,
      address2: shipping.address?.line2 || '',
      city: shipping.address?.city,
      state_code: shipping.address?.state,
      country_code: shipping.address?.country,
      zip: shipping.address?.postal_code,
    },
    items: items,
  };

  try {
    const response = await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        'X-PF-Store-Id': '17834354' // ID de la tienda "Criminal Crisis"
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Printful API Error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Successfully created Printful order:', data.result?.id);
    return data.result;
  } catch (error) {
    // Si la llamada falla, lanzamos el error para que sea capturado en el controlador
    throw error;
  }
};