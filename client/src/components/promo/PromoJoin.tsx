import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

/**
 * The share link.
 *
 * Deliberately has no interface. It swaps the shared token for a personal one
 * and goes straight to the player, because the one thing that has to be
 * effortless is pressing play — a form here would put a step in front of it.
 * The visitor's name is asked later, inside the feedback they were already
 * writing to unlock the download.
 *
 * `replace` keeps the share token out of history, so Back leaves the site
 * instead of bouncing through here and minting a second identity.
 */
export default function PromoJoin() {
  const { shareToken = '' } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let alive = true;
    // Render's free tier sleeps; without this the page looks broken for ~50s.
    const timer = setTimeout(() => { if (alive) setSlow(true); }, 2500);

    (async () => {
      try {
        const res = (await api.enterPromoShare(shareToken)) as { url?: string };
        if (!alive) return;
        if (res?.url) window.location.replace(res.url);
        else setError('This link is no longer active.');
      } catch {
        if (alive) setError('This link is no longer active.');
      } finally {
        if (alive) clearTimeout(timer);
      }
    })();

    return () => { alive = false; clearTimeout(timer); };
  }, [shareToken]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-[#111] mb-1">{error}</p>
            <p className="text-xs text-[#888]">Ask whoever sent it for a new one.</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#999]">
              Criminal Crisis
            </p>
            <p className="mt-3 text-sm text-[#666]">Opening the promo…</p>
            {slow && (
              <p className="mt-2 text-xs text-[#999]">
                The server was asleep — this first one can take a moment.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
