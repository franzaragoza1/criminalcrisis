import { useState } from 'react';
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

// CC face icons used as artist avatars when no photo is available
const ARTIST_ICONS = [
  '/img/iconos/icono_feliz1_criminalCrisis.png',
  '/img/iconos/icono_feliz2_criminalCrisis.png',
  '/img/iconos/icono_indiferente1_criminalCrisis.png',
  '/img/iconos/icono_enfadado1_criminalCrisis.png',
  '/img/iconos/icono_triste1_criminalCrisis.png',
  '/img/iconos/icono_triste2_criminalCrisis.png',
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
                className="w-24 h-24 object-cover flex-shrink-0 grayscale"
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
                      className="text-[#888] hover:text-[#111] transition-colors flex items-center gap-1 text-xs"
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

  return (
    <section id="artists" className="py-24 px-6 bg-[#FAFAFA]">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">Roster</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111]">Artists</h2>
        </motion.div>

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {artists.map((artist, i) => (
              <motion.div
                key={artist.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group cursor-pointer"
                onClick={() => setSelected(artist)}
              >
                <div className="aspect-square bg-[#F0F0F0] overflow-hidden mb-3">
                  {artist.photo_url ? (
                    <img
                      src={artist.photo_url}
                      alt={artist.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#F0F0F0] group-hover:bg-[#E8E8E8] transition-colors duration-300">
                      <img
                        src={artistIcon(artist.id)}
                        alt=""
                        className="w-3/5 h-3/5 object-contain opacity-40 group-hover:opacity-70 transition-opacity duration-300"
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#111]">{artist.name}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {selected && <ArtistModal artist={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
