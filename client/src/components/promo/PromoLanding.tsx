import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Download, Check, SkipBack, SkipForward, Lock } from 'lucide-react';
import { api } from '../../api';
import type { PromoView, PromoFeedbackEntry } from '../../types';
import PromoFeedbackForm from './PromoFeedbackForm';

const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '--:--';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function PromoLanding() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('k') || '';

  const [data, setData] = useState<PromoView | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // A missing key is derived, not stored — there is nothing to fetch without it.
  const error = !token ? 'This link is missing its access key.' : fetchError;
  const [feedback, setFeedback] = useState<Record<string, PromoFeedbackEntry>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [openDownload, setOpenDownload] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overallRef = useRef<HTMLDivElement | null>(null);
  const scrollToOverall = () =>
    overallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Beacons are deduped per page load — one 'play' per track is a signal,
  // twenty from someone scrubbing is noise.
  const firedRef = useRef<Set<string>>(new Set());

  const beacon = useCallback(
    (type: string, trackId?: number) => {
      const key = `${type}:${trackId ?? 'x'}`;
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      api.trackPromoEvent(slug, { k: token, type, track_id: trackId });
    },
    [slug, token]
  );

  useEffect(() => {
    if (!token) return;
    let alive = true;

    void (async () => {
      try {
        const view = (await api.getPromo(slug, token)) as PromoView;
        if (!alive) return;
        setData(view);
        setUnlocked(view.downloadsUnlocked);
        const seeded: Record<string, PromoFeedbackEntry> = {};
        for (const f of view.feedback) seeded[f.track_id === null ? 'overall' : String(f.track_id)] = f;
        setFeedback(seeded);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : '';
        setFetchError(
          msg.includes('expired')
            ? 'This promo link has expired. Get in touch and we’ll send a fresh one.'
            : 'This promo link isn’t valid. It may have been revoked — just reply to the email and we’ll sort it.'
        );
      }
    })();

    return () => { alive = false; };
  }, [slug, token]);

  // Memoised so the fallback array doesn't get a new identity on every render,
  // which would invalidate the player callbacks below.
  const tracks = useMemo(() => data?.tracks ?? [], [data]);
  const currentIndex = useMemo(() => tracks.findIndex(t => t.id === currentId), [tracks, currentId]);
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  const playTrack = useCallback(
    (id: number) => {
      const track = tracks.find(t => t.id === id);
      if (!track?.stream_url) return;
      const audio = audioRef.current;
      if (!audio) return;

      if (currentId === id) {
        if (audio.paused) void audio.play();
        else audio.pause();
        return;
      }
      setCurrentId(id);
      audio.src = track.stream_url;
      void audio.play();
    },
    [tracks, currentId]
  );

  const step = useCallback(
    (delta: number) => {
      if (currentIndex < 0) return;
      const next = tracks[currentIndex + delta];
      if (next) playTrack(next.id);
    },
    [currentIndex, tracks, playTrack]
  );

  // Audio element wiring. Kept in one effect so listeners are attached and torn
  // down together rather than drifting apart as the component grows.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => { setIsPlaying(true); if (currentId) beacon('play', currentId); };
    const onPause = () => setIsPlaying(false);
    const onMeta = () => setDuration(audio.duration || 0);
    const onTime = () => {
      setProgress(audio.currentTime);
      if (currentId && audio.duration && audio.currentTime / audio.duration >= 0.75) {
        beacon('play_75', currentId);
      }
    };
    const onEnded = () => {
      if (currentId) beacon('complete', currentId);
      setIsPlaying(false);
      step(1);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentId, beacon, step]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const saveFeedback = async (
    trackId: number | null,
    body: { rating?: number; comment?: string; favourite_track_id?: number }
  ) => {
    const res = (await api.sendPromoFeedback(slug, { k: token, track_id: trackId, ...body })) as {
      downloadsUnlocked?: boolean;
    };
    setFeedback(prev => ({
      ...prev,
      [trackId === null ? 'overall' : String(trackId)]: { track_id: trackId, ...body },
    }));
    // Unlock without a reload the moment the rating lands.
    if (res?.downloadsUnlocked !== undefined) setUnlocked(res.downloadsUnlocked);
  };

  // --- states -------------------------------------------------------------

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAFAFA]">
        <div className="max-w-md text-center">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C8302B] mb-4">Access denied</p>
          <h1 className="text-3xl md:text-4xl text-[#111] mb-5">Link not valid</h1>
          <p className="text-sm text-[#666] leading-relaxed">{error}</p>
          <a href="mailto:info@criminalcrisis.com"
             className="inline-block mt-8 border-b border-[#111] pb-0.5 text-xs font-semibold tracking-[0.2em] uppercase text-[#111] hover:text-[#C8302B] hover:border-[#C8302B] transition-colors">
            info@criminalcrisis.com
          </a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <p className="text-[10px] font-semibold tracking-[0.4em] uppercase text-[#C0BABC] animate-pulse">Loading</p>
      </div>
    );
  }

  const { campaign, contactName } = data;
  const firstName = contactName?.split(' ')[0];

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32">
      <audio ref={audioRef} preload="none" />

      {/* Release ticker — the one piece of chrome that earns a full-bleed red bar.
          Play it out, just don't upload it: that's the actual ask for club promos. */}
      {campaign.release_date && (
        <div className="bg-[#C8302B] text-[#FAFAFA] py-2.5 px-6 overflow-hidden">
          <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-center">
            Out {campaign.release_date} · Please don&apos;t upload or share the files before release
          </p>
        </div>
      )}

      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <a href="/" className="text-[11px] font-semibold tracking-[0.28em] uppercase text-[#111]">
          Criminal Crisis
        </a>
        <span className="text-[11px] font-semibold tracking-[0.28em] uppercase text-[#C0BABC]">
          Private Promo
        </span>
      </header>

      <div className="border-t-4 border-[#111]" />

      <main className="max-w-6xl mx-auto px-6 md:px-10 pt-12 md:pt-20">
        <div className="grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-10 md:gap-16">

          {/* Artwork column — sticks while the tracklist scrolls past it */}
          <div className="md:sticky md:top-10 md:self-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="aspect-square bg-[#111] overflow-hidden"
            >
              {campaign.artwork_url ? (
                <img src={campaign.artwork_url} alt={campaign.title}
                     className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#FAFAFA] text-[10px] tracking-[0.3em] uppercase">Criminal Crisis</span>
                </div>
              )}
            </motion.div>

            <dl className="mt-5 space-y-1.5 text-[11px]">
              <div className="flex justify-between border-b border-[#E5E5E5] pb-1.5">
                <dt className="tracking-[0.18em] uppercase text-[#999]">Tracks</dt>
                <dd className="font-mono text-[#111]">{String(tracks.length).padStart(2, '0')}</dd>
              </div>
              <div className="flex justify-between border-b border-[#E5E5E5] pb-1.5">
                <dt className="tracking-[0.18em] uppercase text-[#999]">Format</dt>
                <dd className="font-mono text-[#111]">{campaign.download_enabled ? 'Stream + DL' : 'Stream'}</dd>
              </div>
              {campaign.release_date && (
                <div className="flex justify-between border-b border-[#E5E5E5] pb-1.5">
                  <dt className="tracking-[0.18em] uppercase text-[#999]">Out</dt>
                  <dd className="font-mono text-[#C8302B]">{campaign.release_date}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Content column */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              {firstName && (
                <p className="text-xs tracking-[0.2em] uppercase text-[#C8302B] mb-4">
                  Hey {firstName} —
                </p>
              )}
              <h1 className="text-4xl md:text-6xl leading-[0.95] text-[#111] mb-8">
                {campaign.title}
              </h1>

              {campaign.body_intro && (
                <div className="max-w-xl mb-14 space-y-4">
                  {campaign.body_intro.split(/\n{2,}/).map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-[#444]">{p}</p>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Tracklist */}
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C0BABC]">
                The music
              </p>
              {campaign.download_enabled && campaign.require_feedback && !unlocked && (
                <button
                  onClick={() => { scrollToOverall(); }}
                  className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase text-[#C8302B] hover:underline cursor-pointer"
                >
                  <Lock size={11} /> Leave feedback to unlock downloads
                </button>
              )}
            </div>
            <div className="border-t-2 border-[#111]">
              {tracks.map((track, i) => {
                const active = track.id === currentId;

                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                    className={`border-b border-[#E0E0E0] transition-colors ${active ? 'bg-[#111]' : ''}`}
                  >
                    <div className="flex items-center gap-4 py-4 px-3 md:px-4">
                      <button
                        onClick={() => playTrack(track.id)}
                        disabled={!track.stream_url}
                        aria-label={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                        className={`shrink-0 w-9 h-9 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          active ? 'bg-[#C8302B] text-[#FAFAFA]' : 'bg-[#111] text-[#FAFAFA] hover:bg-[#C8302B]'
                        }`}
                      >
                        {active && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      </button>

                      <span className={`font-mono text-[11px] tabular-nums shrink-0 ${active ? 'text-[#777]' : 'text-[#BBB]'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${active ? 'text-[#FAFAFA]' : 'text-[#111]'}`}>
                          {track.title}
                        </p>
                        {track.artist_name && (
                          <p className={`text-[11px] tracking-wide truncate ${active ? 'text-[#888]' : 'text-[#999]'}`}>
                            {track.artist_name}
                          </p>
                        )}
                      </div>

                      {active && isPlaying && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C8302B] animate-pulse-red shrink-0" />
                      )}

                      <span className={`font-mono text-[11px] tabular-nums shrink-0 hidden sm:block ${active ? 'text-[#777]' : 'text-[#BBB]'}`}>
                        {fmtTime(track.duration_seconds ?? NaN)}
                      </span>

                      {campaign.download_enabled && track.download_formats.length > 0 && (
                        <div className="relative shrink-0">
                          <button
                            onClick={() => {
                              if (!unlocked) { scrollToOverall(); return; }
                              setOpenDownload(openDownload === track.id ? null : track.id);
                            }}
                            aria-label={unlocked ? `Download ${track.title}` : 'Leave a rating and a comment to unlock downloads'}
                            title={unlocked ? undefined : 'Leave a rating and a comment to unlock downloads'}
                            className={`w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer ${
                              !unlocked
                                ? active
                                  ? 'border-[#3A3A3A] text-[#666]'
                                  : 'border-[#E5E5E5] text-[#CCC] hover:border-[#C8302B] hover:text-[#C8302B]'
                                : active
                                  ? 'border-[#444] text-[#FAFAFA] hover:bg-[#FAFAFA] hover:text-[#111]'
                                  : 'border-[#DDD] text-[#111] hover:border-[#111] hover:bg-[#111] hover:text-[#FAFAFA]'
                            }`}
                          >
                            {unlocked ? <Download size={14} /> : <Lock size={13} />}
                          </button>

                          <AnimatePresence>
                            {unlocked && openDownload === track.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-1 z-20 bg-[#111] border border-[#333] min-w-[130px]"
                              >
                                {track.download_formats.map(fmt => (
                                  <a
                                    key={fmt.id}
                                    href={api.promoDownloadUrl(slug, track.id, token, fmt.id)}
                                    onClick={() => { beacon('click', track.id); setOpenDownload(null); }}
                                    className="block px-4 py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#FAFAFA] hover:bg-[#C8302B] transition-colors whitespace-nowrap"
                                  >
                                    {fmt.label}
                                  </a>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Overall feedback */}
            <div ref={overallRef} className="mt-16 border-t-4 border-[#111] pt-8">
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">
                Overall
              </p>
              <h2 className="text-2xl md:text-3xl text-[#111] mb-6">What did you think?</h2>

              {campaign.download_enabled && campaign.require_feedback && (
                <div className={`flex items-start gap-2.5 mb-8 px-4 py-3 border ${
                  unlocked ? 'border-[#E0E0E0] text-[#666]' : 'border-[#C8302B] text-[#111]'
                }`}>
                  {unlocked
                    ? <Check size={15} className="text-[#C8302B] mt-0.5 shrink-0" />
                    : <Lock size={14} className="text-[#C8302B] mt-0.5 shrink-0" />}
                  <p className="text-xs leading-relaxed">
                    {unlocked
                      ? 'Downloads are unlocked. Thanks — that feedback is genuinely useful.'
                      : 'Leave a star rating and a comment and the downloads unlock straight away. Favourite track is optional.'}
                  </p>
                </div>
              )}

              <PromoFeedbackForm
                initial={feedback['overall']}
                onSave={body => saveFeedback(null, body)}
                // Picking a favourite from one track is a non-question.
                tracks={tracks.length > 1 ? tracks : undefined}
                required={campaign.download_enabled && campaign.require_feedback && !unlocked}
              />
            </div>

            <footer className="mt-20 pt-6 border-t border-[#E0E0E0] pb-10">
              <p className="text-[11px] text-[#999] leading-relaxed">
                This link is personal to you — please don&apos;t forward or share it.
                Questions? <a href="mailto:info@criminalcrisis.com" className="text-[#111] border-b border-[#111] hover:text-[#C8302B] hover:border-[#C8302B] transition-colors">info@criminalcrisis.com</a>
              </p>
            </footer>
          </div>
        </div>
      </main>

      {/* Sticky player — matches the site's existing #111 GlobalPlayer bar */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 right-0 bg-[#111] text-[#FAFAFA] z-50"
          >
            {/* The progress bar is the site's 4px rule, made live */}
            <div
              onClick={seek}
              className="h-1 bg-[#333] cursor-pointer group"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemax={Math.round(duration) || 100}
            >
              <div
                className="h-full bg-[#C8302B] group-hover:bg-[#FAFAFA] transition-colors"
                style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
              />
            </div>

            <div className="px-4 md:px-8 py-3 flex items-center gap-4">
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => step(-1)} disabled={currentIndex <= 0}
                        aria-label="Previous track"
                        className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-[#FAFAFA] disabled:opacity-25 transition-colors cursor-pointer">
                  <SkipBack size={15} fill="currentColor" />
                </button>
                <button onClick={() => playTrack(currentTrack.id)}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="w-10 h-10 flex items-center justify-center bg-[#FAFAFA] text-[#111] hover:bg-[#C8302B] hover:text-[#FAFAFA] transition-colors cursor-pointer">
                  {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                </button>
                <button onClick={() => step(1)} disabled={currentIndex >= tracks.length - 1}
                        aria-label="Next track"
                        className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-[#FAFAFA] disabled:opacity-25 transition-colors cursor-pointer">
                  <SkipForward size={15} fill="currentColor" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] truncate">{currentTrack.title}</p>
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#888] truncate">
                  {currentTrack.artist_name || campaign.title}
                </p>
              </div>

              <span className="font-mono text-[11px] tabular-nums text-[#888] shrink-0">
                {fmtTime(progress)} / {fmtTime(duration)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
