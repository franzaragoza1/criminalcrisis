import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ExternalLink, ChevronDown } from 'lucide-react';
import type { Event } from '../../types';

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube: youtube.com/watch?v=ID or youtu.be/ID
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    // Vimeo: vimeo.com/ID
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { /* invalid URL */ }
  return null;
}

function isDirectVideoUrl(url: string): boolean {
  return (
    url.includes('cloudinary.com') ||
    /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)
  );
}

interface Props {
  events: Event[];
}

function EventCard({ event, index }: { event: Event; index: number }) {
  const date = new Date(event.event_date);
  const isPast = event.is_past === 1 || date < new Date();

  const day = date.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = date.toLocaleDateString('en-GB', { year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`flex flex-col md:flex-row gap-6 py-7 border-b border-[#E8E8E8] relative ${isPast ? 'opacity-40' : ''}`}
    >
      {/* Red "live" indicator for upcoming events */}
      {!isPast && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#C8302B]" />
      )}

      {/* Date block */}
      <div className="flex-shrink-0 md:w-32 pl-4">
        <p className="font-mono text-base font-bold tracking-tight text-[#111]">
          {day}.{month}.{year}
        </p>
      </div>

      {/* Event info */}
      <div className="flex-1 pl-4 md:pl-0">
        <h3 className="text-xl font-bold text-[#111] mb-2">{event.name}</h3>

        <div className="flex flex-wrap gap-4 text-sm text-[#888] mb-3">
          {event.venue && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-[#C0BABC]" />
              {event.venue}
            </span>
          )}
          {event.city && (
            <span className="flex items-center gap-1 text-[#C0BABC]">
              {event.city}
            </span>
          )}
        </div>

        {event.lineup?.length > 0 && (
          <p className="text-sm text-[#555]">
            {event.lineup.join(' · ')}
          </p>
        )}

        {/* Video embed or native player */}
        {event.video_url && (() => {
          if (isDirectVideoUrl(event.video_url)) {
            return (
              <div className="mt-4 w-full" style={{ aspectRatio: '16/9' }}>
                <video
                  src={event.video_url}
                  controls
                  preload="metadata"
                  className="w-full h-full object-cover bg-black"
                />
              </div>
            );
          }
          const embedUrl = getEmbedUrl(event.video_url);
          return embedUrl ? (
            <div className="mt-4 w-full" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={embedUrl}
                className="w-full h-full border-0"
                loading="lazy"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={`Video — ${event.name}`}
              />
            </div>
          ) : null;
        })()}
      </div>

      {/* Ticket link */}
      {event.ticket_url && !isPast && (
        <div className="flex-shrink-0 flex items-start pl-4 md:pl-0">
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-[#111] text-[#111] px-5 py-2.5 text-xs font-semibold tracking-wide hover:bg-[#C8302B] hover:border-[#C8302B] hover:text-white transition-colors"
          >
            Tickets <ExternalLink size={11} />
          </a>
        </div>
      )}
    </motion.div>
  );
}

export default function EventsSection({ events }: Props) {
  const [showPast, setShowPast] = useState(false);

  const upcoming = events.filter((e) => e.is_past === 0 && new Date(e.event_date) >= new Date());
  const past = events.filter((e) => e.is_past === 1 || new Date(e.event_date) < new Date());

  return (
    <section id="events" className="py-24 px-6 bg-[#F5F5F5] border-t-4 border-[#111]">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-3">Live</p>
          <h2 className="text-4xl md:text-5xl font-black text-[#111]">Events</h2>
        </motion.div>

        {upcoming.length === 0 ? (
          <div className="text-center py-24">
            <img
              src="/img/iconos/icono_indiferente1_criminalCrisis.png"
              alt=""
              className="w-20 h-20 mx-auto mb-5 opacity-20"
            />
            <p className="text-[#888] text-sm tracking-wide uppercase">No upcoming events. Stay tuned.</p>
          </div>
        ) : (
          <div>
            {upcoming.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-12">
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex items-center gap-2 text-sm font-medium text-[#888] hover:text-[#111] transition-colors cursor-pointer"
            >
              Past Events ({past.length})
              <ChevronDown
                size={16}
                className={`transition-transform ${showPast ? 'rotate-180' : ''}`}
              />
            </button>

            {showPast && (
              <div className="mt-6">
                {past.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
