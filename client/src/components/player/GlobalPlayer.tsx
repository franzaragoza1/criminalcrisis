import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronUp, ChevronDown, ExternalLink,
  SkipBack, SkipForward, Play, Pause,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

function buildEmbedSrc(embedHtml: string, trackId?: number, autoplay = false): string {
  const match = embedHtml.match(/src="([^"]+)"/);
  if (!match) return '';
  let src = match[1]
    .replace('bgcol=ffffff', 'bgcol=111111')
    .replace('linkcol=0687f5', 'linkcol=cccccc');
  src = src.replace(/\/track=\d+/, '');
  src = src.replace(/\/autoplay=\w+/, '');
  if (trackId) src = src.replace(/\/$/, '') + `/track=${trackId}/`;
  if (autoplay) src = src.replace(/\/$/, '') + `/autoplay=true/`;
  return src;
}

function sendToIframe(iframe: HTMLIFrameElement | null, method: string) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ method }), '*');
}

export default function GlobalPlayer() {
  const { currentRelease, closePlayer } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [activeTrackIdx, setActiveTrackIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const baseSrc = useMemo(() => {
    if (!currentRelease?.bandcamp_embed) return '';
    return buildEmbedSrc(currentRelease.bandcamp_embed);
  }, [currentRelease?.id]);

  // New release: load with autoplay
  useEffect(() => {
    if (!baseSrc) return;
    setActiveTrackIdx(-1);
    setIsPlaying(true);
    if (iframeRef.current) {
      iframeRef.current.src = baseSrc.replace(/\/$/, '') + '/autoplay=true/';
    }
  }, [baseSrc]);

  // Listen for Bandcamp player events to sync play state and active track
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'play') setIsPlaying(true);
        if (data?.event === 'pause') setIsPlaying(false);
        if (data?.event === 'finish') setIsPlaying(false);
      } catch { /* ignore */ }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const tracklist = currentRelease?.tracklist ?? [];

  const loadTrackById = useCallback((trackId: number, idx: number) => {
    if (!currentRelease?.bandcamp_embed) return;
    setActiveTrackIdx(idx);
    setIsPlaying(true);
    if (iframeRef.current) {
      iframeRef.current.src = buildEmbedSrc(currentRelease.bandcamp_embed, trackId, true);
    }
  }, [currentRelease]);

  function handleTrackClick(trackId: number | undefined, idx: number) {
    if (trackId) {
      loadTrackById(trackId, idx);
    } else {
      // No Bandcamp ID: use postMessage to jump by position (best effort)
      sendToIframe(iframeRef.current, 'play');
      setActiveTrackIdx(idx);
    }
  }

  function prevTrack() {
    if (tracklist.length === 0) return;
    const newIdx = activeTrackIdx <= 0 ? tracklist.length - 1 : activeTrackIdx - 1;
    const track = tracklist[newIdx];
    const trackId = typeof track === 'string' ? undefined : track.id;
    if (trackId) {
      loadTrackById(trackId, newIdx);
    } else {
      sendToIframe(iframeRef.current, 'prev_track');
      setActiveTrackIdx(newIdx);
    }
  }

  function nextTrack() {
    if (tracklist.length === 0) return;
    const newIdx = activeTrackIdx >= tracklist.length - 1 ? 0 : activeTrackIdx + 1;
    const track = tracklist[newIdx];
    const trackId = typeof track === 'string' ? undefined : track.id;
    if (trackId) {
      loadTrackById(trackId, newIdx);
    } else {
      sendToIframe(iframeRef.current, 'next_track');
      setActiveTrackIdx(newIdx);
    }
  }

  function togglePlay() {
    if (isPlaying) {
      sendToIframe(iframeRef.current, 'pause');
      setIsPlaying(false);
    } else {
      sendToIframe(iframeRef.current, 'play');
      setIsPlaying(true);
    }
  }

  const btnClass = 'p-1.5 text-[#555] hover:text-white transition-colors cursor-pointer';

  return (
    <AnimatePresence>
      {currentRelease && (
        <motion.div
          key={currentRelease.id}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] text-white shadow-[0_-4px_30px_rgba(0,0,0,0.4)]"
        >
          {/* Expanded tracklist panel */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-white/10"
              >
                <div className="px-6 py-4 flex gap-12">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#555] mb-3">
                      Tracklist
                    </p>
                    <ol className="space-y-0.5">
                      {tracklist.map((track, i) => {
                        const trackName = typeof track === 'string' ? track : track.name;
                        const trackId = typeof track === 'string' ? undefined : track.id;
                        const isActive = i === activeTrackIdx;
                        return (
                          <li
                            key={i}
                            onClick={() => handleTrackClick(trackId, i)}
                            className={`flex gap-3 items-baseline rounded px-2 py-1 transition-colors cursor-pointer hover:bg-white/5 group ${isActive ? 'bg-white/10' : ''}`}
                          >
                            <span className={`font-mono text-xs w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#444] group-hover:text-[#666]'}`}>
                              {isActive ? '▶' : String(i + 1).padStart(2, '0')}
                            </span>
                            <span className={`text-sm transition-colors ${isActive ? 'text-white font-medium' : 'text-[#aaa] group-hover:text-white'}`}>
                              {trackName}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  {Object.keys(currentRelease.links || {}).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#555] mb-3">
                        Links
                      </p>
                      <div className="flex flex-col gap-2">
                        {Object.entries(currentRelease.links).map(([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors"
                          >
                            <ExternalLink size={11} />
                            {platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main player bar */}
          <div className="flex items-center gap-3 px-4 py-2 h-[72px]">

            {/* Artwork */}
            {currentRelease.artwork_url ? (
              <img src={currentRelease.artwork_url} alt={currentRelease.title} className="w-12 h-12 object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-[#222] flex items-center justify-center flex-shrink-0">
                <span className="text-[#444] text-xs font-black">CC</span>
              </div>
            )}

            {/* Info */}
            <div className="flex-shrink-0 w-32 min-w-0">
              <p className="text-[11px] text-[#666] truncate leading-tight">
                {currentRelease.artists?.map((a) => a.name).join(', ')}
              </p>
              <p className="text-sm font-semibold truncate leading-tight">{currentRelease.title}</p>
              {currentRelease.release_date && (
                <p className="text-[10px] text-[#555] mt-0.5">
                  {new Date(currentRelease.release_date).getFullYear()}
                </p>
              )}
            </div>

            {/* Bandcamp iframe */}
            <div className="flex-1 min-w-0 overflow-hidden" style={{ height: '42px' }}>
              <iframe
                ref={iframeRef}
                src={baseSrc}
                allow="autoplay"
                style={{ border: 0, width: '100%', height: '42px' }}
                seamless
              />
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={prevTrack} className={btnClass} title="Anterior">
                <SkipBack size={15} />
              </button>
              <button onClick={togglePlay} className={btnClass} title={isPlaying ? 'Pausar' : 'Reproducir'}>
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button onClick={nextTrack} className={btnClass} title="Siguiente">
                <SkipForward size={15} />
              </button>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0 border-l border-white/10 pl-2">
              <button onClick={() => setExpanded(v => !v)} className={btnClass} title="Tracklist">
                {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              <button onClick={closePlayer} className={btnClass} title="Cerrar">
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
