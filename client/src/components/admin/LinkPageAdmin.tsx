import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, X } from 'lucide-react';
import { api } from '../../api';
import type { LinkItem, LinkPage } from '../../types';
import { INPUT_CLS, LABEL_CLS } from './adminStyles';


/**
 * Seven is the cap the public page enforces too. The point of /frankydrama is
 * that someone arriving from Instagram knows who this is and where to listen in
 * about three seconds; a longer list is a worse page, not a fuller one.
 */
const MAX_BUTTONS = 7;
const MAX_FOOTER_LINKS = 6;

/** Google truncates around these lengths. Not limits — just where the counter turns amber. */
const TITLE_BUDGET = 60;
const DESCRIPTION_BUDGET = 160;

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function CharCount({ value, budget }: { value: string; budget: number }) {
  const over = value.length > budget;
  return (
    <span className={`text-xs ${over ? 'text-[#C8302B]' : 'text-[#C0BABC]'}`}>
      {value.length} / {budget}
    </span>
  );
}

/**
 * Ordered list of label + URL rows. Order is the only thing that decides where a
 * link shows up, so reordering is two arrows and no other concept to learn.
 */
function LinkListEditor({
  items,
  onChange,
  max,
  withNote,
  addLabel,
}: {
  items: LinkItem[];
  onChange: (items: LinkItem[]) => void;
  max: number;
  withNote?: boolean;
  addLabel: string;
}) {
  const update = (i: number, field: keyof LinkItem, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-[#E8E8E8] bg-white p-3">
          <div className="flex items-start gap-2">
            <span className="text-xs text-[#C0BABC] font-mono w-5 pt-2.5 text-right flex-shrink-0">
              {i + 1}
            </span>

            <div className="flex-1 min-w-0 space-y-2">
              <input
                value={item.label}
                onChange={e => update(i, 'label', e.target.value)}
                placeholder="Texto del botón"
                className={INPUT_CLS}
              />
              <input
                value={item.url}
                onChange={e => update(i, 'url', e.target.value)}
                placeholder="https://..."
                className={`${INPUT_CLS} font-mono text-xs`}
              />
              {withNote && (
                <input
                  value={item.note ?? ''}
                  onChange={e => update(i, 'note', e.target.value)}
                  placeholder="Etiqueta pequeña encima, opcional — p. ej. Latest release"
                  className={INPUT_CLS}
                />
              )}
            </div>

            <div className="flex flex-col gap-1 flex-shrink-0 pt-1">
              <button
                type="button"
                onClick={() => onChange(move(items, i, i - 1))}
                disabled={i === 0}
                aria-label="Subir"
                className="text-[#888] hover:text-[#111] disabled:opacity-20 disabled:hover:text-[#888] transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => onChange(move(items, i, i + 1))}
                disabled={i === items.length - 1}
                aria-label="Bajar"
                className="text-[#888] hover:text-[#111] disabled:opacity-20 disabled:hover:text-[#888] transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                aria-label="Borrar"
                className="text-[#888] hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {items.length < max ? (
        <button
          type="button"
          onClick={() => onChange([...items, { label: '', url: '' }])}
          className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors cursor-pointer"
        >
          <Plus size={12} /> {addLabel}
        </button>
      ) : (
        <p className="text-xs text-[#C0BABC]">Máximo {max}. Borra uno para añadir otro.</p>
      )}
    </div>
  );
}

function Fieldset({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#111] mb-1">{title}</h3>
      {hint && <p className="text-xs text-[#888] mb-4 max-w-prose leading-relaxed">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

export default function LinkPageAdmin({ slug, title }: { slug: string; title: string }) {
  const [page, setPage] = useState<LinkPage | null>(null);
  const [ogImage, setOgImage] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getLinkPage(slug)
      .then(p => {
        setPage(p);
        setOgImage(null);
        setPhoto(null);
        setStatus('idle');
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la página');
        setStatus('error');
      });
  }, [slug]);

  const set = <K extends keyof LinkPage>(field: K, value: LinkPage[K]) =>
    setPage(prev => (prev ? { ...prev, [field]: value } : prev));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page) return;
    setStatus('saving');
    setError('');

    const fd = new FormData();
    fd.append('display_name', page.display_name ?? '');
    fd.append('tagline', page.tagline ?? '');
    fd.append('city', page.city ?? '');
    fd.append('alternate_name', page.alternate_name ?? '');
    fd.append('seo_title', page.seo_title ?? '');
    fd.append('seo_description', page.seo_description ?? '');
    fd.append('buttons', JSON.stringify(page.buttons));
    fd.append('footer_links', JSON.stringify(page.footer_links));
    if (ogImage) fd.append('og_image', ogImage);
    if (photo) fd.append('photo', photo);

    try {
      const saved = await api.updateLinkPage(slug, fd);
      setPage(saved);
      setOgImage(null);
      setPhoto(null);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'No se pudo guardar');
      setStatus('error');
    }
  };

  if (status === 'loading') return <p className="text-sm text-[#888]">Cargando…</p>;
  if (!page) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-[#111]">{title}</h2>
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors"
        >
          Ver página <ExternalLink size={12} />
        </a>
      </div>
      <p className="text-xs text-[#888] mb-8 max-w-prose leading-relaxed">
        Todo lo de esta pantalla sale en criminalcrisis.com/{slug}. Los cambios tardan
        hasta un minuto en verse online; recarga la página pública pasado ese rato.
      </p>

      <form onSubmit={save}>
        <Fieldset title="Lo que se ve en la página" hint="El nombre, la foto y las dos líneas de debajo.">
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLS}>Nombre</label>
              <input
                value={page.display_name ?? ''}
                onChange={e => set('display_name', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Foto</label>
              {page.photo_url && (
                <img
                  src={page.photo_url}
                  alt=""
                  className="w-56 aspect-[1.91/1] object-cover border border-[#E8E8E8] mb-2"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => setPhoto(e.target.files?.[0] || null)}
                className="text-sm text-[#888]"
              />
              <p className="text-xs text-[#999] mt-1">
                Sale debajo del nombre. Se recorta a formato apaisado, así que usa una
                horizontal — a lo ancho, unos 1200 px o más.
              </p>
            </div>

            <div>
              <label className={LABEL_CLS}>Frase</label>
              <input
                value={page.tagline ?? ''}
                onChange={e => set('tagline', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Ciudad</label>
              <input
                value={page.city ?? ''}
                onChange={e => set('city', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </Fieldset>

        <Fieldset
          title={`Botones (${page.buttons.length}/${MAX_BUTTONS})`}
          hint="En el orden en que aparecen. El primero sale destacado en negro — déjale ahí el lanzamiento nuevo."
        >
          <LinkListEditor
            items={page.buttons}
            onChange={items => set('buttons', items)}
            max={MAX_BUTTONS}
            withNote
            addLabel="Añadir botón"
          />
        </Fieldset>

        <Fieldset
          title="Pie de página"
          hint="Enlaces pequeños debajo de los botones. Para un email escribe la URL como mailto:fran@criminalcrisis.com."
        >
          <LinkListEditor
            items={page.footer_links}
            onChange={items => set('footer_links', items)}
            max={MAX_FOOTER_LINKS}
            addLabel="Añadir enlace"
          />
        </Fieldset>

        <Fieldset
          title="Google y redes"
          hint="Nada de esto se ve en la página: es lo que lee Google y lo que sale al pegar el enlace en Instagram o WhatsApp."
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <label className={LABEL_CLS}>Título en Google</label>
                <CharCount value={page.seo_title ?? ''} budget={TITLE_BUDGET} />
              </div>
              <input
                value={page.seo_title ?? ''}
                onChange={e => set('seo_title', e.target.value)}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label className={LABEL_CLS}>Descripción</label>
                <CharCount value={page.seo_description ?? ''} budget={DESCRIPTION_BUDGET} />
              </div>
              <textarea
                value={page.seo_description ?? ''}
                onChange={e => set('seo_description', e.target.value)}
                rows={4}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Nombre real</label>
              <input
                value={page.alternate_name ?? ''}
                onChange={e => set('alternate_name', e.target.value)}
                className={INPUT_CLS}
              />
              <p className="text-xs text-[#999] mt-1">
                Le dice a Google que frankydrama y esta persona son la misma.
              </p>
            </div>

            <div>
              <label className={LABEL_CLS}>Imagen al compartir</label>
              {page.og_image_url && (
                <img
                  src={page.og_image_url}
                  alt=""
                  className="w-40 h-auto border border-[#E8E8E8] mb-2"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => setOgImage(e.target.files?.[0] || null)}
                className="text-sm text-[#888]"
              />
              <p className="text-xs text-[#999] mt-1">
                Ideal 1200 × 630 px. Se ve al pegar el enlace en Instagram, WhatsApp o X.
              </p>
            </div>
          </div>
        </Fieldset>

        <div className="flex items-center gap-4 border-t border-[#E8E8E8] pt-6">
          <button
            type="submit"
            disabled={status === 'saving'}
            className="bg-[#111] text-white px-5 py-2 text-sm font-medium hover:bg-[#333] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>
          {status === 'saved' && <span className="text-sm text-green-600 font-medium">Guardado</span>}
          {status === 'error' && <span className="text-sm text-red-500">{error}</span>}
        </div>
      </form>
    </div>
  );
}
