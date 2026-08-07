import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { api } from '../../api';

const ROLES = [
  { value: 'dj', label: 'DJ' },
  { value: 'radio', label: 'Radio' },
  { value: 'press', label: 'Press' },
  { value: 'blog', label: 'Blog' },
  { value: 'club', label: 'Club / Promoter' },
  { value: 'label', label: 'Label' },
];

const inputClass =
  'w-full bg-transparent border-0 border-b border-[#CCCCCC] py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors placeholder:text-[#C0BABC]';
const labelClass =
  'block text-[10px] font-semibold tracking-[0.2em] uppercase text-[#888] mb-1';

/**
 * Application form, not a signup. Requests land as `pending` and only reach a
 * send once approved in the admin, so the copy here must not imply automatic
 * access.
 */
export default function PromoApply() {
  const [form, setForm] = useState({
    name: '', email: '', role: 'dj', country: '', company: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await api.promoSignup(form);
      setStatus('sent');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Something went wrong');
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAFAFA]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md text-center"
        >
          <Check size={28} className="text-[#C8302B] mx-auto mb-5" />
          <h1 className="text-3xl md:text-4xl text-[#111] mb-5">Request received</h1>
          <p className="text-sm text-[#666] leading-relaxed">
            We read every one. If it's a fit you'll get the next promo straight to your
            inbox — no reply needed in the meantime.
          </p>
          <a
            href="/"
            className="inline-block mt-10 text-[10px] font-semibold tracking-[0.25em] uppercase text-[#999] hover:text-[#111] transition-colors"
          >
            ← criminalcrisis.com
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <a href="/" className="text-[11px] font-semibold tracking-[0.28em] uppercase text-[#111]">
          Criminal Crisis
        </a>
        <span className="text-[11px] font-semibold tracking-[0.28em] uppercase text-[#C0BABC]">
          Promo Pool
        </span>
      </header>

      <div className="border-t-4 border-[#111]" />

      <main className="max-w-xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-4">
            By request only
          </p>
          <h1 className="text-4xl md:text-5xl leading-[0.95] text-[#111] mb-12">
            Request to join<br />the promo pool
          </h1>
        </motion.div>

        <form onSubmit={submit} className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="Your name or alias"
              />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={inputClass}
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>What do you do? *</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ROLES.map(r => {
                const active = form.role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`px-4 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#C8302B] border-[#C8302B] text-[#FAFAFA]'
                        : 'border-[#DDD] text-[#666] hover:border-[#111] hover:text-[#111]'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Station / publication / club</label>
              <input
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>

          {status === 'error' && (
            <p className="text-sm text-[#C8302B]">{error}</p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'sending'}
              className="bg-[#111] text-[#FAFAFA] px-10 py-4 text-xs font-semibold tracking-[0.2em] uppercase hover:bg-[#C8302B] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {status === 'sending' ? 'Sending…' : 'Send request'}
            </button>
            <p className="text-[11px] text-[#999] mt-5 leading-relaxed">
              We only use your address to send promos, and every one carries a one-click
              unsubscribe. Nothing is shared with anyone.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
