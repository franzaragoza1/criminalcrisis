import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ExternalLink, ChevronDown } from 'lucide-react';
import type { Event } from '../../types';

interface Props {
  events: Event[];
}

function EventCard({ event, index }: { event: Event; index: number }) {
  const date = new Date(event.event_date);
  const isPast = event.is_past === 1 || date < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`flex flex-col md:flex-row gap-6 py-8 border-b border-[#E8E8E8] ${isPast ? 'opacity-50' : ''}`}
    >
      {/* Date block */}
      <div className="flex-shrink-0 md:w-24 text-center md:text-left">
        <p className="text-3xl font-black text-[#111]">
          {date.toLocaleDateString('en-GB', { day: '2-digit' })}
        </p>
        <p className="text-xs font-semibold tracking-widest uppercase text-[#C0BABC]">
          {date.toLocaleDateString('en-GB', { month: 'short' })}
        </p>
        <p className="text-xs text-[#888]">
          {date.toLocaleDateString('en-GB', { year: 'numeric' })}
        </p>
      </div>

      {/* Event info */}
      <div className="flex-1">
        <h3 className="text-xl font-bold text-[#111] mb-2">{event.name}</h3>

        <div className="flex flex-wrap gap-4 text-sm text-[#888] mb-3">
          {event.venue && (
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-[#C0BABC]" />
              {event.venue}
            </span>
          )}
          {event.city && (
            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-[#C0BABC]" />
              {event.city}
            </span>
          )}
        </div>

        {event.lineup?.length > 0 && (
          <p className="text-sm text-[#555]">
            <span className="font-medium">Lineup: </span>
            {event.lineup.join(' · ')}
          </p>
        )}
      </div>

      {/* Ticket link */}
      {event.ticket_url && !isPast && (
        <div className="flex-shrink-0 flex items-start">
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-[#111] text-[#FAFAFA] px-5 py-2.5 text-xs font-semibold tracking-wide hover:bg-[#333] transition-colors"
          >
            Tickets <ExternalLink size={12} />
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
    <section id="events" className="py-24 px-6 bg-[#F5F5F5]">
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
