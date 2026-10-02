import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Check } from 'lucide-react';
import { api } from '../../api';

// Pre-save: there is no stock yet, so this collects reservations instead of
// payments. The label writes to each person when the shirts arrive. The Stripe
// checkout in ../shop stays in place for when a product ships straight away.
const PRODUCT = {
  id: 'unpaid-collab-tee',
  name: 'Unpaid Collab Tee',
  price: 20,
  description:
    'Camiseta blanca con el logo de Criminal Crisis al pecho. This is an unpaid collaboration. ' +
    'Todavía no tenemos stock: resérvala ahora sin pagar nada y te escribimos en cuanto lleguen para cerrar tu pedido.',
  image: '/img/merch/unpaid-collab-tee.jpg',
  sizes: ['S', 'M', 'L', 'XL'],
};

/** The API answers errors as JSON; show the sentence inside, not the braces. */
function readError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    return JSON.parse(raw).error || raw;
  } catch {
    return raw || 'No se pudo guardar la reserva';
  }
}

const INPUT =
  'w-full bg-[#1a1a1a] border border-[#333] px-4 py-3 text-white placeholder:text-[#555] focus:outline-none focus:border-white transition-colors';

export default function ShopSection() {
  const [size, setSize] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reserved, setReserved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!size) { setError('Elige una talla'); return; }
    setSending(true);
    setError('');
    try {
      await api.reserveMerch({ product: PRODUCT.id, size, name, email });
      setReserved(true);
    } catch (err) {
      setError(readError(err));
    } finally {
      setSending(false);
    }
  };

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
          className="bg-[#111] border border-[#222] overflow-hidden shadow-2xl"
        >
          <div className="flex flex-col md:flex-row">

            {/* Columna Izquierda: Imagen */}
            <div className="md:w-1/2 bg-[#C9C7C5] flex items-center justify-center relative">
              <div className="absolute top-4 left-4 bg-[#C8302B] text-white text-xs font-black uppercase px-3 py-1 tracking-wider">
                Pre-Save
              </div>
              <img
                src={PRODUCT.image}
                alt={`${PRODUCT.name}: camiseta blanca con el logo de Criminal Crisis`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Columna Derecha: Info y Reserva */}
            <div className="md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center text-white">
              <h3 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tight">{PRODUCT.name}</h3>
              <p className="text-2xl text-[#888] font-light mb-8">{PRODUCT.price} €</p>

              <p className="text-[#aaa] leading-relaxed mb-10 text-lg">
                {PRODUCT.description}
              </p>

              {reserved ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-[#333] bg-[#1a1a1a] p-6"
                >
                  <p className="flex items-center gap-2 font-black uppercase tracking-wider mb-2">
                    <Check size={18} /> Reserva guardada
                  </p>
                  <p className="text-[#aaa]">
                    Talla {size}. Te hemos enviado la confirmación a <span className="text-white">{email}</span> y
                    te escribiremos ahí en cuanto tengamos las camisetas.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div>
                    <p className="text-sm font-bold text-[#666] uppercase tracking-wider mb-4">
                      Talla: <span className="text-white ml-2">{size || '—'}</span>
                    </p>
                    <div className="flex gap-3">
                      {PRODUCT.sizes.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setSize(s); setError(''); }}
                          aria-pressed={size === s}
                          className={`w-14 h-12 border-2 font-black transition-colors ${
                            size === s
                              ? 'border-white bg-white text-black'
                              : 'border-[#333] text-white hover:border-[#666]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Nombre"
                      autoComplete="name"
                      className={INPUT}
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email"
                      autoComplete="email"
                      className={INPUT}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full bg-white text-black font-black uppercase tracking-widest py-5 px-6 rounded-none hover:bg-gray-200 disabled:bg-[#333] disabled:text-[#666] transition-colors flex items-center justify-center gap-3 text-lg"
                    >
                      <Bookmark size={20} />
                      {sending ? 'Guardando...' : 'Pre-Save'}
                    </button>
                    <p className="text-xs text-[#666] mt-3 text-center">
                      No se cobra nada ahora. Solo te avisamos cuando haya stock.
                    </p>
                  </div>

                  {error && <p className="text-sm text-[#C8302B]">{error}</p>}
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
