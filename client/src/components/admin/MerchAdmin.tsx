import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { api } from '../../api';
import type { MerchReservation } from '../../types';
import { BTN_SECONDARY } from './adminStyles';

/**
 * Pre-save reservations from the shop. Nobody has paid: when stock arrives,
 * each person is written to by hand, and "Contactado" marks who already was.
 * The per-size totals are what to order from the printer.
 */
export default function MerchAdmin() {
  const [reservations, setReservations] = useState<MerchReservation[]>([]);
  const [sizes, setSizes] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.getMerchReservations();
      setReservations(data.reservations);
      setSizes(data.sizes);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleContacted = async (r: MerchReservation) => {
    await api.updateMerchReservation(r.id, r.status === 'contacted' ? 'reserved' : 'contacted');
    load();
  };

  const remove = async (r: MerchReservation) => {
    if (!confirm(`¿Borrar la reserva de ${r.email} (talla ${r.size})?`)) return;
    await api.deleteMerchReservation(r.id);
    load();
  };

  const handleExport = async () => {
    try {
      const res = await fetch(api.exportMerchReservationsUrl(), {
        headers: { Authorization: `Bearer ${localStorage.getItem('cc_token')}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `criminalcrisis-presaves-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const products = Object.keys(sizes);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-[#111]">Merch · Pre-saves</h2>
        <button onClick={handleExport} className={`${BTN_SECONDARY} flex items-center gap-2`} disabled={!reservations.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {error && <p className="text-sm text-[#C8302B] mb-4">{error}</p>}
      {loading && <p className="text-sm text-[#888]">Cargando…</p>}

      {products.map(product => {
        const rows = reservations.filter(r => r.product === product);
        return (
          <div key={product} className="bg-white border border-[#E0E0E0] p-4 md:p-6 mb-6">
            <p className="text-xs font-semibold uppercase text-[#888] mb-3">{product} · {rows.length} reservas</p>
            <div className="flex flex-wrap gap-3">
              {sizes[product].map(size => (
                <div key={size} className="border border-[#E0E0E0] px-4 py-2 text-center min-w-[64px]">
                  <p className="text-xs text-[#888]">{size}</p>
                  <p className="text-xl font-black">{rows.filter(r => r.size === size).length}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!loading && reservations.length === 0 && !error && (
        <p className="text-sm text-[#888]">Todavía no hay reservas.</p>
      )}

      {reservations.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[#888] border-b border-[#E0E0E0]">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Talla</th>
                <th className="px-4 py-3">Contactado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} className="border-b border-[#F0F0F0] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-[#888]">{new Date(r.created_at).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3">{r.name || '—'}</td>
                  <td className="px-4 py-3"><a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a></td>
                  <td className="px-4 py-3 font-bold">{r.size}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={r.status === 'contacted'}
                      onChange={() => toggleContacted(r)}
                      aria-label={`Marcar ${r.email} como contactado`}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(r)} aria-label="Borrar reserva" className="text-[#888] hover:text-[#C8302B] cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
