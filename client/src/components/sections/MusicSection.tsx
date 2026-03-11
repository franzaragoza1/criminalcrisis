import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { Release } from '../../types';
import { usePlayer } from '../../context/PlayerContext';

interface Props {
  releases: Release[];
}

export default function MusicSection({ releases }: Props) {
  const { playRelease, currentRelease } = usePlayer();

  return (
    <section id="music" className="pt-32 pb-20 px-6 bg-[#FAFAFA]">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">Discography</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111]">Music</h2>
        </motion.div>

        {releases.length === 0 ? (
          <div className="text-center py-24">
            <img
              src="/img/iconos/icono_triste1_criminalCrisis.png"
              alt=""
              className="w-20 h-20 mx-auto mb-5 opacity-20"
            />
            <p className="text-[#888] text-sm tracking-wide uppercase">No releases yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {releases.map((release, i) => {
              const isPlaying = currentRelease?.id === release.id;
              const isFeatured = i === 0;
              return (
                <motion.div
                  key={release.id}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15, y: 10 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`group cursor-pointer ${isFeatured ? 'col-span-2 row-span-2' : ''}`}
                  onClick={() => playRelease(release)}
                >
                  <div className="aspect-square bg-[#F0F0F0] overflow-hidden mb-3 relative">
                    {release.artwork_url ? (
                      <img
                        src={release.artwork_url}
                        alt={release.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#E8E8E8]">
                        <span className="text-[#C0BABC] text-4xl font-black">CC</span>
                      </div>
                    )}

                    {/* Catalog number */}
                    {release.catalog_number && (
                      <span className="absolute top-0 left-0 bg-[#111] text-white text-[9px] font-mono tracking-wider px-1.5 py-0.5 uppercase">
                        {release.catalog_number}
                      </span>
                    )}

                    <div className={`absolute inset-0 transition-colors duration-300 flex items-center justify-center ${isPlaying ? 'bg-black/30' : 'bg-black/0 group-hover:bg-black/25'}`}>
                      <div className={`transition-opacity duration-200 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Play
                          size={isFeatured ? 48 : 32}
                          className="text-white drop-shadow-lg"
                          fill={isPlaying ? 'white' : 'transparent'}
                        />
                      </div>
                    </div>
                    {isPlaying && (
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[10px] font-semibold tracking-widest uppercase text-white bg-[#C8302B] px-2 py-0.5">
                          Playing
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#888] font-medium mb-0.5">
                    {release.artists?.map((a) => a.name).join(', ')}
                  </p>
                  <p className={`font-semibold leading-snug text-[#111] ${isFeatured ? 'text-lg' : 'text-sm'}`}>
                    {release.title}
                  </p>
                  {release.release_date && (
                    <p className="text-xs text-[#C0BABC] mt-0.5">
                      {new Date(release.release_date).getFullYear()}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
