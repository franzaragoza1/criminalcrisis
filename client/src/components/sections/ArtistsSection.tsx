import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Instagram, Music, ExternalLink } from 'lucide-react';
import type { Artist } from '../../types';

interface Props {
  artists: Artist[];
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={16} />,
  soundcloud: <Music size={16} />,
};

const ARTIST_ICONS = [
  '/img/iconos/icono_feliz1_criminalCrisis.png',
  '/img/iconos/icono_feliz2_criminalCrisis.png',
  '/img/iconos/icono_indiferente1_criminalCrisis.png',
  '/img/iconos/icono_enfadado1_criminalCrisis.png',
  '/img/iconos/icono_triste1_criminalCrisis.png',
  '/img/iconos/icono_triste2_criminalCrisis.png',
];

// Deterministic animation variants per artist
const ICON_ANIMATIONS = [
  { rotate: [0, 8, -8, 0], scale: [1, 1.05, 1] },
  { rotate: [0, -12, 12, 0], scale: [1, 0.95, 1] },
  { rotate: [0, 5, -5, 5, 0], scale: [1, 1.08, 1] },
  { rotate: [0, -6, 6, -6, 0], scale: [0.95, 1, 0.95] },
  { rotate: [0, 10, 0, -10, 0], scale: [1, 1.03, 1] },
  { rotate: [0, -8, 0, 8, 0], scale: [1, 0.97, 1.03, 1] },
];

function artistIcon(id: number) {
  return ARTIST_ICONS[id % ARTIST_ICONS.length];
}

function ArtistModal({ artist, onClose }: { artist: Artist; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#FAFAFA] max-w-lg w-full p-8 relative shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#888] hover:text-[#111] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="flex gap-6 mb-6">
            {artist.photo_url ? (
              <img
                src={artist.photo_url}
                alt={artist.name}
                className="w-24 h-24 object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 bg-[#F0F0F0] flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={artistIcon(artist.id)}
                  alt=""
                  className="w-16 h-16 object-contain opacity-60"
                />
              </div>
            )}
            <div>
              <h3 className="text-2xl font-bold text-[#111] mb-2">{artist.name}</h3>
              {Object.keys(artist.social_links || {}).length > 0 && (
                <div className="flex gap-3">
                  {Object.entries(artist.social_links).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#888] hover:text-[#C8302B] transition-colors flex items-center gap-1 text-xs"
                    >
                      {SOCIAL_ICONS[platform.toLowerCase()] || <ExternalLink size={14} />}
                      {platform}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {artist.bio && (
            <p className="text-sm text-[#555] leading-relaxed">{artist.bio}</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ArtistsSection({ artists }: Props) {
  const [selected, setSelected] = useState<Artist | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  return (
    <section id="artists" className="py-16 bg-[#FAFAFA] border-t border-[#E8E8E8]">
      {/* Header — constrained */}
      <div className="px-6 max-w-screen-xl mx-auto mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">Roster</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111]">Artists</h2>
        </motion.div>
      </div>

      {artists.length === 0 ? (
        <div className="text-center py-24">
          <img
            src="/img/iconos/icono_indiferente1_criminalCrisis.png"
            alt=""
            className="w-20 h-20 mx-auto mb-5 opacity-20"
          />
          <p className="text-[#888] text-sm tracking-wide uppercase">No artists yet.</p>
        </div>
      ) : (
        /* Horizontal drag strip — bleeds to viewport edges */
        <motion.div
          ref={stripRef}
          drag="x"
          dragConstraints={stripRef}
          className="flex gap-4 px-6 max-w-screen-xl mx-auto cursor-grab active:cursor-grabbing select-none overflow-x-auto md:justify-center pb-4"
          style={{ scrollbarWidth: 'none' }}
          whileTap={{ cursor: 'grabbing' }}
        >
          {artists.map((artist) => {
            const anim = ICON_ANIMATIONS[artist.id % ICON_ANIMATIONS.length];
            return (
              <div
                key={artist.id}
                className="flex-shrink-0 w-44 md:w-56 cursor-pointer group"
                onClick={() => setSelected(artist)}
              >
                {/* Card — tall 3:4 ratio */}
                <div className="bg-[#F0F0F0] overflow-hidden mb-3 relative" style={{ aspectRatio: '3/4' }}>
                  {artist.photo_url ? (
                    <img
                      src={artist.photo_url}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#F0F0F0]">
                      <motion.img
                        src={artistIcon(artist.id)}
                        alt=""
                        className="w-3/5 h-3/5 object-contain opacity-40"
                        animate={anim}
                        transition={{ duration: 4 + (artist.id % 3), repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  )}
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-sm font-bold uppercase tracking-wide leading-tight">{artist.name}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#111] group-hover:text-[#C8302B] transition-colors">{artist.name}</p>
              </div>
            );
          })}
        </motion.div>
      )}

      {selected && <ArtistModal artist={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
