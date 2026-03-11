import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useScrollToSection } from '../../hooks/useScrollToSection';

const NAV_ITEMS = [
  { label: 'Home', id: 'home' },
  { label: 'Music', id: 'music' },
  { label: 'Events', id: 'events' },
  { label: 'Artists', id: 'artists' },
  { label: 'Shop', id: 'shop' },
  { label: 'Contact', id: 'contact' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('home');
  const scrollTo = useScrollToSection();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);

      // Update active section based on scroll
      for (const item of [...NAV_ITEMS].reverse()) {
        const el = document.getElementById(item.id);
        if (el && window.scrollY >= el.offsetTop - 100) {
          setActive(item.id);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (id: string) => {
    scrollTo(id);
    setOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#FAFAFA]/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'
      }`}
      style={{ height: '72px' }}
    >
      <div className="max-w-screen-xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => handleNav('home')}
          className="cursor-pointer opacity-100 hover:opacity-70 transition-opacity flex-shrink-0"
          aria-label="Criminal Crisis — Home"
        >
          <img
            src="/img/logos/logo_header.png"
            alt="Criminal Crisis"
            className="h-9 w-auto"
          />
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`relative text-xs font-medium tracking-[0.12em] uppercase transition-colors cursor-pointer ${
                active === item.id
                  ? 'text-[#111]'
                  : 'text-[#888] hover:text-[#111]'
              }`}
            >
              {item.label}
              {active === item.id && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#C8302B]" />
              )}
            </button>
          ))}
        </nav>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-[#111] cursor-pointer"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden bg-[#FAFAFA] border-t border-[#E8E8E8]">
          <nav className="flex flex-col px-6 py-4 gap-4">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`text-left text-xs font-medium tracking-[0.12em] uppercase transition-colors cursor-pointer ${
                  active === item.id ? 'text-[#111]' : 'text-[#888]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
