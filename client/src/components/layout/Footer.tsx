import { Instagram, Music } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#111] text-[#888] py-12 px-6">
      <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-3">
          <img
            src="/img/logos/logotipo5_criminalCrisis@2x.png"
            alt="Criminal Crisis"
            className="h-8 w-auto"
            style={{ filter: 'invert(1)' }}
          />
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <img
              src="/img/iconos/icono_feliz1_criminalCrisis.png"
              alt=""
              className="w-5 h-5"
              style={{ filter: 'invert(1)', opacity: 0.4 }}
            />
            <span>Banging Boogie Bangers · Madrid</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://www.instagram.com/criminalcrisisrec/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-[#FAFAFA] transition-colors"
            aria-label="Instagram"
          >
            <Instagram size={20} />
          </a>
          <a
            href="https://soundcloud.com/criminalcrisis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-[#FAFAFA] transition-colors"
            aria-label="SoundCloud"
          >
            <Music size={20} />
          </a>
          <a
            href="https://criminalcrisis.bandcamp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium tracking-[0.1em] uppercase text-[#888] hover:text-[#FAFAFA] transition-colors"
          >
            Bandcamp
          </a>
        </div>

        <p className="text-xs tracking-wide">
          © {new Date().getFullYear()} Criminal Crisis.{' '}
          <a href="/admin" className="hover:text-[#FAFAFA] transition-colors">Admin</a>
        </p>
      </div>
    </footer>
  );
}
