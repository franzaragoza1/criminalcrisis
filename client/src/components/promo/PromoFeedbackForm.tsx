import { useState } from 'react';
import { Check } from 'lucide-react';
import type { PromoFeedbackEntry, WillPlay } from '../../types';

type Body = { rating?: number; will_play?: WillPlay; comment?: string };

const WILL_PLAY: { value: WillPlay; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

/**
 * Rating and "will you play it" autosave the moment they're clicked — asking a
 * busy DJ to click a save button is how you end up with no feedback at all.
 * Only the free-text comment needs an explicit save, since it has a natural end.
 *
 * Rating uses square blocks rather than stars to stay inside the label's
 * square-cornered visual language.
 */
export default function PromoFeedbackForm({
  initial,
  onSave,
  dark = false,
}: {
  initial?: PromoFeedbackEntry;
  onSave: (body: Body) => Promise<void>;
  dark?: boolean;
}) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [willPlay, setWillPlay] = useState<WillPlay | null>(initial?.will_play ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const commentDirty = comment !== (initial?.comment ?? '');

  const persist = async (patch: Body) => {
    setSaving(true);
    try {
      await onSave({
        rating: rating ?? undefined,
        will_play: willPlay ?? undefined,
        comment: comment || undefined,
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
  const idleBlock = dark ? 'bg-[#2A2A2A]' : 'bg-[#E8E8E8]';

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
        {/* Rating */}
        <div>
          <p className={`text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 ${label}`}>Rating</p>
          <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
            {[1, 2, 3, 4, 5].map(n => {
              const lit = (hover ?? rating ?? 0) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} out of 5`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => { setRating(n); void persist({ rating: n }); }}
                  className={`w-6 h-6 transition-colors cursor-pointer ${
                    lit ? 'bg-[#C8302B]' : idleBlock
                  }`}
                />
              );
            })}
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
