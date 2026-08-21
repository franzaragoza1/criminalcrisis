import { useState } from 'react';
import { Check, Star } from 'lucide-react';
import type { PromoFeedbackEntry, PromoTrack } from '../../types';

type Body = {
  rating?: number;
  comment?: string;
  favourite_track_id?: number;
  name?: string;
};

/**
 * Three questions, once, at the bottom of the page: how good is it, which track
 * is the pick, anything to say.
 *
 * Rating and favourite autosave on click — asking a busy DJ to press save is how
 * you end up with no feedback at all. Only the comment needs an explicit save,
 * since it has a natural end. Clicking the current rating again clears it.
 */
export default function PromoFeedbackForm({
  initial,
  onSave,
  tracks,
  required = false,
  askName = false,
}: {
  initial?: PromoFeedbackEntry;
  onSave: (body: Body) => Promise<void>;
  /** Shown as the favourite-track picker; omit for single-track promos. */
  tracks?: PromoTrack[];
  /** Downloads are gated on rating + comment; show what's still missing. */
  required?: boolean;
  /** Share-link arrivals have no name on file. The only thing they are asked. */
  askName?: boolean;
}) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [favourite, setFavourite] = useState<number | null>(initial?.favourite_track_id ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // What the server has, as opposed to what's typed — the checklist below has to
  // reflect the former or it would claim the gate is met before anything is sent.
  const [saved, setSaved] = useState({
    rating: initial?.rating ?? 0,
    comment: initial?.comment ?? '',
  });

  const commentDirty = comment !== saved.comment;

  const nameReady = !askName || name.trim().length >= 2;

  const persist = async (patch: Body) => {
    // The server rejects nameless feedback, and this form swallows save errors
    // so a failure can never block listening. Without this guard a share-link
    // visitor would click stars, see them light up, and save nothing at all.
    if (!nameReady) { setNeedsName(true); return; }
    setNeedsName(false);
    setSaving(true);
    const next = {
      rating,
      comment: comment || undefined,
      favourite_track_id: favourite ?? undefined,
      ...(askName ? { name: name.trim() } : {}),
      ...patch,
    };
    try {
      await onSave(next);
      setSaved({ rating: next.rating ?? 0, comment: next.comment ?? '' });
      setSavedAt(Date.now());
    } catch {
      // Silent: a failed feedback save must never block listening.
    } finally {
      setSaving(false);
    }
  };

  const hasRating = saved.rating > 0;
  const hasComment = saved.comment.trim() !== '';
  const complete = hasRating && hasComment;

  return (
    <div className="space-y-6 max-w-lg">
      {askName && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-1 text-[#999]">
            Your name <span className="text-[#C8302B]">*</span>
          </p>
          <input
            value={name}
            onChange={e => { setName(e.target.value); if (needsName) setNeedsName(false); }}
            // Flush whatever they already picked once a name exists, so stars
            // clicked before typing are not lost.
            onBlur={() => {
              if (name.trim().length >= 2 && (rating > 0 || comment.trim() || favourite)) void persist({});
            }}
            maxLength={80}
            placeholder="So I know whose feedback this is"
            className="w-full bg-transparent border-0 border-b border-[#DDD] py-2 text-sm focus:outline-none transition-colors text-[#111] placeholder:text-[#C0BABC] focus:border-[#111]"
          />
          {needsName && (
            <p className="mt-1.5 text-[11px] text-[#C8302B]">Put your name in first and it'll save.</p>
          )}
        </div>
      )}

      {/* Rating */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 text-[#999]">
          Rating {required && <span className="text-[#C8302B]">*</span>}
        </p>
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
                  className={lit ? 'text-[#C8302B]' : 'text-[#DDD]'}
                  fill={lit ? 'currentColor' : 'none'}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
          <span className="ml-2 font-mono text-[11px] tabular-nums text-[#999]">{rating}/5</span>
        </div>
      </div>

      {/* Favourite track */}
      {tracks && tracks.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 text-[#999]">Favourite track</p>
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
                      : 'border-[#DDD] text-[#666] hover:border-[#111] hover:text-[#111]'
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
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-1 text-[#999]">
          Comment {required && <span className="text-[#C8302B]">*</span>}
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          // Also saved on blur: someone who types a comment and clicks straight
          // at the download button would otherwise stay locked with no clue why.
          onBlur={() => { if (commentDirty) void persist({ comment }); }}
          rows={2}
          maxLength={2000}
          placeholder="Anything you want to tell us…"
          className="w-full bg-transparent border-0 border-b border-[#DDD] py-2 text-sm resize-none focus:outline-none transition-colors text-[#111] placeholder:text-[#C0BABC] focus:border-[#111]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={saving || !commentDirty}
          onClick={() => void persist({ comment })}
          className="px-6 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-[#111] text-[#FAFAFA] hover:bg-[#C8302B]"
        >
          {saving ? 'Saving' : 'Save comment'}
        </button>

        {savedAt && !commentDirty && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C8302B]">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      {/* Says exactly what's still missing, rather than a generic "locked" */}
      {required && !complete && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#888]">
          {askName && (
            <span className={nameReady ? 'text-[#C8302B]' : ''}>
              {nameReady ? '✓' : '○'} Name
            </span>
          )}
          <span className={hasRating ? 'text-[#C8302B]' : ''}>
            {hasRating ? '✓' : '○'} Star rating
          </span>
          <span className={hasComment ? 'text-[#C8302B]' : ''}>
            {hasComment ? '✓' : '○'} Comment
          </span>
        </div>
      )}
    </div>
  );
}
