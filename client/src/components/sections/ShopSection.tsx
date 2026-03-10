import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Checkout } from '../shop/Checkout';

// Datos de las variantes de la gorra "CCap" sacados de tu Printful
const PRODUCT = {
  name: "CCAP",
  price: 18.00,
  description: "Protege tu cabeza del sistema. Gorra exclusiva de 6 paneles estilo 'Dad Hat'. Bordado frontal con el logo oficial de Criminal Crisis. Talla única, ajustada para la calle. Disponible en 3 colores.",
  variants: [
    {
      id: "5227517429",
      color: "Black",
      image: "https://files.cdn.printful.com/files/8c9/8c902501915614630815f09a0dc1425f_preview.png",
      hex: "#111111"
    },
    {
      id: "5227517430",
      color: "Stone",
      image: "https://files.cdn.printful.com/files/bb6/bb69c00ff19fc704c23e386a2159c108_preview.png",
      hex: "#C0BABC"
    },
    {
      id: "5227517431",
      color: "White",
      image: "https://files.cdn.printful.com/files/19b/19bddcff5ac6b7e348a94fc01ba719a0_preview.png",
      hex: "#FFFFFF"
    }
  ]
};

export default function ShopSection() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(PRODUCT.variants[0].id);

  const selectedVariant = useMemo(() => {
    return PRODUCT.variants.find(v => v.id === selectedVariantId) || PRODUCT.variants[0];
  }, [selectedVariantId]);

  return (
    <section id="shop" className="py-24 px-6 bg-[#0a0a0a] min-h-screen">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center md:text-left"
        >
          <p className="text-xs font-bold tracking-[0.4em] uppercase text-[#666] mb-3">Merchandise</p>
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter">Shop</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl"
        >
          <div className="flex flex-col md:flex-row">
            
            {/* Columna Izquierda: Imagen */}
            <div className="md:w-1/2 bg-[#1a1a1a] flex items-center justify-center p-8 md:p-16 relative">
              <div className="absolute top-4 left-4 bg-white text-black text-xs font-black uppercase px-3 py-1 tracking-wider">
                Nuevo
              </div>
              <motion.img 
                key={selectedVariant.image}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                src={selectedVariant.image} 
                alt={`${PRODUCT.name} en color ${selectedVariant.color}`}
                className="w-full max-w-md object-contain drop-shadow-2xl"
              />
            </div>

            {/* Columna Derecha: Info y Pago */}
            <div className="md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center text-white">
              
              {!showCheckout ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h3 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tight">{PRODUCT.name}</h3>
                  <p className="text-2xl text-[#888] font-light mb-8">${PRODUCT.price.toFixed(2)}</p>
                  
                  <p className="text-[#aaa] leading-relaxed mb-10 text-lg">
                    {PRODUCT.description}
                  </p>

                  <div className="mb-10">
                    <p className="text-sm font-bold text-[#666] uppercase tracking-wider mb-4">
                      Color: <span className="text-white ml-2">{selectedVariant.color}</span>
                    </p>
                    <div className="flex gap-4">
                      {PRODUCT.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariantId(variant.id)}
                          className={`w-10 h-10 rounded-full border-2 transition-all ${
                            selectedVariantId === variant.id 
                              ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                              : 'border-transparent hover:border-[#666]'
                          }`}
                          style={{ backgroundColor: variant.hex }}
                          aria-label={`Seleccionar color ${variant.color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-white text-black font-black uppercase tracking-widest py-5 px-6 rounded-none hover:bg-gray-200 transition-colors flex items-center justify-center gap-3 text-lg"
                  >
                    <ShoppingCart size={20} />
                    Proceder al Pago
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#1a1a1a] p-6 md:p-8 rounded-xl border border-[#333]"
                >
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#333]">
                    <div>
                      <h4 className="font-bold text-lg uppercase tracking-wider text-white">Completar Pedido</h4>
                      <p className="text-[#888] text-sm">{PRODUCT.name} - {selectedVariant.color}</p>
                    </div>
                    <button 
                      onClick={() => setShowCheckout(false)}
                      className="text-xs uppercase font-bold text-[#666] hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <Checkout items={[{ id: 'ccap', sync_variant_id: parseInt(selectedVariantId), quantity: 1 }]} />
                  </div>
                </motion.div>
              )}

            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}