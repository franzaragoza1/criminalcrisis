import { Instagram, Music } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#FAFAFA] border-t border-[#E8E8E8] py-8 px-6">
      <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-[#C0BABC] tracking-wider uppercase">Banging Boogie Bangers · Madrid</p>

        <div className="flex items-center gap-6">
          <a
            href="https://www.instagram.com/criminalcrisis/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-[#C8302B] transition-colors"
            aria-label="Instagram"
          >
            <Instagram size={18} />
          </a>
          <a
            href="https://soundcloud.com/criminal_crisis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-[#C8302B] transition-colors"
            aria-label="SoundCloud"
          >
            <Music size={18} />
          </a>
          <a
            href="https://www.beatport.com/es/label/criminal-crisis/115183"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#888] hover:text-[#C8302B] transition-colors"
          >
            Beatport
          </a>
          <a
            href="https://criminalcrisis.bandcamp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#888] hover:text-[#C8302B] transition-colors"
          >
            Bandcamp
          </a>
        </div>

        <p className="text-[10px] tracking-wide text-[#C0BABC]">
          © {new Date().getFullYear()} Criminal Crisis.{' '}
          <a href="/admin" className="hover:text-[#111] transition-colors">Admin</a>
        </p>
      </div>
    </footer>
  );
}
