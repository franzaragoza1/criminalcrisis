import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Instagram, Music } from 'lucide-react';
import { useScrollToSection } from '../../hooks/useScrollToSection';
import SpaceInvaders from '../game/SpaceInvaders';
import type { HeroContent } from '../../types';

interface Props {
  hero: HeroContent | null;
}

export default function HomeSection({ hero }: Props) {
  const scrollTo = useScrollToSection();
  const [showPlay, setShowPlay] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // Only show PLAY when mouse stays still 1s inside the central 60% of the hero
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    clearTimer();
    setShowPlay(false);

    const section = sectionRef.current;
    if (!section) return;
    const { left, width, top, height } = section.getBoundingClientRect();
    const relX = (e.clientX - left) / width;
    const relY = (e.clientY - top) / height;
    const inCenter = relX > 0.2 && relX < 0.8 && relY > 0.15 && relY < 0.75;

    if (inCenter) {
      timerRef.current = setTimeout(() => setShowPlay(true), 1000);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    clearTimer();
    setShowPlay(false);
  }, []);

  return (
    <>
      {playing && <SpaceInvaders onExit={() => setPlaying(false)} />}

      <section
        id="home"
        ref={sectionRef}
        className="min-h-screen flex flex-col justify-end items-center text-center px-6 pt-[72px] relative overflow-hidden"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {/* Animation iframe */}
        <iframe
          src="/img/iconos/animation.html"
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          title="Criminal Crisis animation"
          scrolling="no"
        />

        {/* PLAY — large, ghost, center, shown after 1s still */}
        <AnimatePresence>
          {showPlay && !playing && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              onClick={() => setPlaying(true)}
              className="absolute inset-0 w-full h-full flex items-center justify-center z-20 cursor-pointer bg-transparent"
              style={{ paddingBottom: '15vh' }}
            >
              <span
                className="font-mono font-black uppercase select-none"
                style={{
                  fontSize: 'clamp(64px, 12vw, 140px)',
                  letterSpacing: '0.15em',
                  color: 'rgba(17,17,17,0.13)',
                }}
              >
                PLAY
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Gradient fade at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, transparent, #FAFAFA)' }}
        />

        {/* Buttons + social links */}
        <div className="relative z-20 w-full max-w-4xl mx-auto pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center justify-center gap-4 mb-10"
          >
            <button
              onClick={() => scrollTo('music')}
              className="bg-[#111] text-[#FAFAFA] px-8 py-3 text-xs font-medium tracking-[0.15em] uppercase hover:bg-[#333] transition-colors cursor-pointer"
            >
              Listen Now
            </button>
            <button
              onClick={() => scrollTo('events')}
              className="border border-[#111] text-[#111] px-8 py-3 text-xs font-medium tracking-[0.15em] uppercase hover:bg-[#111] hover:text-[#FAFAFA] transition-colors cursor-pointer"
            >
              Events
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-6 text-[#888]"
          >
            <a
              href="https://www.instagram.com/criminalcrisisrec/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs tracking-[0.1em] uppercase hover:text-[#111] transition-colors"
            >
              <Instagram size={14} /> Instagram
            </a>
            <span className="w-px h-4 bg-[#E0E0E0]" />
            <a
              href="https://soundcloud.com/criminalcrisis"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs tracking-[0.1em] uppercase hover:text-[#111] transition-colors"
            >
              <Music size={14} /> SoundCloud
            </a>
            <span className="w-px h-4 bg-[#E0E0E0]" />
            <a
              href="https://criminalcrisis.bandcamp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs tracking-[0.1em] uppercase hover:text-[#111] transition-colors"
            >
              Bandcamp
            </a>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          onClick={() => scrollTo('music')}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[#888] hover:text-[#111] transition-colors cursor-pointer animate-bounce z-20"
        >
          <ArrowDown size={18} />
        </motion.button>
      </section>
    </>
  );
}
