import { useState } from 'react';
import { Check, Star } from 'lucide-react';
import type { PromoFeedbackEntry, PromoTrack, WillPlay } from '../../types';

type Body = {
  rating?: number;
  will_play?: WillPlay;
  comment?: string;
  favourite_track_id?: number;
};

const WILL_PLAY: { value: WillPlay; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

/**
 * Rating, favourite track and "will you play it" autosave on click — asking a
 * busy DJ to press save is how you end up with no feedback at all. Only the
 * free-text comment needs an explicit save, since it has a natural end.
 *
 * Clicking the current rating again clears it back to zero.
 */
export default function PromoFeedbackForm({
  initial,
  onSave,
  dark = false,
  tracks,
}: {
  initial?: PromoFeedbackEntry;
  onSave: (body: Body) => Promise<void>;
  dark?: boolean;
  /** When present, shows the favourite-track picker (overall feedback only). */
  tracks?: PromoTrack[];
}) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [willPlay, setWillPlay] = useState<WillPlay | null>(initial?.will_play ?? null);
  const [favourite, setFavourite] = useState<number | null>(initial?.favourite_track_id ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const commentDirty = comment !== (initial?.comment ?? '');

  const persist = async (patch: Body) => {
    setSaving(true);
    try {
      await onSave({
        rating,
        will_play: willPlay ?? undefined,
        comment: comment || undefined,
        favourite_track_id: favourite ?? undefined,
        ...patch,
      });
      setSavedAt(Date.now());
    } catch {
      // Silent: a failed feedback save must never block listening.
    } finally {
      setSaving(false);
    }
  };

  const label = dark ? 'text-[#888]' : 'text-[#999]';
  const border = dark ? 'border-[#3A3A3A]' : 'border-[#DDD]';
  const dim = dark ? 'text-[#3A3A3A]' : 'text-[#DDD]';

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
        {/* Rating */}
        <div>
          <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 ${label}`}>Rating</p>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
            {[1, 2, 3, 4, 5].map(n => {
              const lit = (hover ?? rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} of 5`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => {
                    const next = rating === n ? 0 : n;
                    setRating(next);
                    void persist({ rating: next });
                  }}
                  className="p-0.5 transition-transform hover:scale-110 cursor-pointer"
                >
                  <Star
                    size={22}
                    className={lit ? 'text-[#C8302B]' : dim}
                    fill={lit ? 'currentColor' : 'none'}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
            <span className={`ml-2 font-mono text-[11px] tabular-nums ${label}`}>
              {rating}/5
            </span>
          </div>
        </div>

        {/* Will you play it */}
        <div>
          <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 ${label}`}>Will you play it?</p>
          <div className={`inline-flex border ${border}`}>
            {WILL_PLAY.map(opt => {
              const active = willPlay === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setWillPlay(opt.value); void persist({ will_play: opt.value }); }}
                  className={`px-4 py-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase transition-colors cursor-pointer border-r last:border-r-0 ${border} ${
                    active
                      ? 'bg-[#C8302B] text-[#FAFAFA]'
                      : dark
                        ? 'text-[#AAA] hover:text-[#FAFAFA]'
                        : 'text-[#666] hover:text-[#111]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Favourite track — overall feedback only */}
      {tracks && tracks.length > 0 && (
        <div>
          <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 ${label}`}>Favourite track</p>
          <div className="flex flex-wrap gap-1.5">
            {tracks.map((t, i) => {
              const active = favourite === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const next = active ? null : t.id;
                    setFavourite(next);
                    void persist({ favourite_track_id: next ?? undefined });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#C8302B] border-[#C8302B] text-[#FAFAFA]'
                      : `${border} ${dark ? 'text-[#AAA] hover:text-[#FAFAFA]' : 'text-[#666] hover:border-[#111] hover:text-[#111]'}`
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, '0')}</span>
                  {t.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Comment */}
      <div>
        <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase mb-1 ${label}`}>Comment</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Anything you want to tell us…"
          className={`w-full bg-transparent border-0 border-b py-2 text-sm resize-none focus:outline-none transition-colors ${border} ${
            dark
              ? 'text-[#FAFAFA] placeholder:text-[#666] focus:border-[#FAFAFA]'
              : 'text-[#111] placeholder:text-[#C0BABC] focus:border-[#111]'
          }`}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={saving || !commentDirty}
          onClick={() => void persist({ comment })}
          className={`px-6 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
            dark ? 'bg-[#FAFAFA] text-[#111] hover:bg-[#C8302B] hover:text-[#FAFAFA]' : 'bg-[#111] text-[#FAFAFA] hover:bg-[#C8302B]'
          }`}
        >
          {saving ? 'Saving' : 'Save comment'}
        </button>

        {savedAt && !commentDirty && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C8302B]">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
