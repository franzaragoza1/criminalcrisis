import 'dotenv/config';

async function getStoreId() {
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) {
    console.error('No se encontró PRINTFUL_API_KEY en el archivo .env');
    return;
  }

  try {
    const response = await fetch('https://api.printful.com/stores', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    
    const data = await response.json();
    console.log('Tiendas encontradas:', JSON.stringify(data, null, 2));

    if (data.result && data.result.length > 0) {
      const storeId = data.result[0].id;
      console.log(`Usando Store ID: ${storeId}`);

      const productsResponse = await fetch('https://api.printful.com/store/products', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-PF-Store-Id': storeId.toString()
        },
      });
      const productsData = await productsResponse.json();
      console.log('\nProductos en la tienda:', JSON.stringify(productsData, null, 2));

      if (productsData.result && productsData.result.length > 0) {
        const productId = productsData.result[0].id;
        const detailsResponse = await fetch(`https://api.printful.com/store/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-PF-Store-Id': storeId.toString()
          },
        });
        const detailsData = await detailsResponse.json();
        console.log('\nDetalles del producto (variantes):', JSON.stringify(detailsData, null, 2));
      }
    }
  } catch (error) {
    console.error('Error al contactar con la API de Printful:', error);
  }
}

getStoreId();