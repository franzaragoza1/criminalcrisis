import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomeSection from './components/sections/HomeSection';
import MusicSection from './components/sections/MusicSection';
import EventsSection from './components/sections/EventsSection';
import ArtistsSection from './components/sections/ArtistsSection';
import ShopSection from './components/sections/ShopSection';
import ContactSection from './components/sections/ContactSection';
import AdminLogin from './components/admin/AdminLogin';
import AdminPanel from './components/admin/AdminPanel';
import GlobalPlayer from './components/player/GlobalPlayer';
import PromoLanding from './components/promo/PromoLanding';
import Unsubscribe from './components/promo/Unsubscribe';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { api } from './api';
import type { HeroContent, Release, Event, Artist } from './types';

function PublicSite() {
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loadError, setLoadError] = useState(false);
  const { currentRelease } = usePlayer();

  useEffect(() => {
    Promise.all([
      api.getHero().then(h => setHero(h as HeroContent)).catch(err => { console.error('getHero failed:', err); setLoadError(true); }),
      api.getReleases().then(r => setReleases(r as Release[])).catch(err => { console.error('getReleases failed:', err); setLoadError(true); }),
      api.getEvents().then(e => setEvents(e as Event[])).catch(err => { console.error('getEvents failed:', err); setLoadError(true); }),
      api.getArtists().then(a => setArtists(a as Artist[])).catch(err => { console.error('getArtists failed:', err); setLoadError(true); }),
    ]);
  }, []);

  return (
    <div className="min-h-screen">
      {loadError && (
        <div className="bg-black text-white text-center text-sm py-2 px-4">
          No pudimos conectar con el servidor. Contenido puede aparecer incompleto — intenta recargar en unos minutos.
        </div>
      )}
      <Header />
      <main className={currentRelease ? 'pb-20' : ''}>
        <HomeSection hero={hero} />
        <MusicSection releases={releases} />
        <EventsSection events={events} />
        <ArtistsSection artists={artists} />
        <ShopSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAFAFA]">
      <div className="text-center">
        <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C0BABC] mb-4">Error 404</p>
        <h1 className="text-4xl md:text-5xl text-[#111] mb-6">Page not found</h1>
        <a href="/" className="inline-block border-b border-[#111] pb-0.5 text-xs font-semibold tracking-[0.2em] uppercase text-[#111] hover:text-[#C8302B] hover:border-[#C8302B] transition-colors">
          Back to criminalcrisis.com
        </a>
      </div>
    </div>
  );
}

function AdminRoute() {
  const [isAuth, setIsAuth] = useState(() => !!localStorage.getItem('cc_token'));

  if (!isAuth) return <AdminLogin onLogin={() => setIsAuth(true)} />;
  return <AdminPanel onLogout={() => setIsAuth(false)} />;
}

export default function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicSite />} />
          <Route path="/promo/:slug" element={<PromoLanding />} />
          <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/*" element={<AdminRoute />} />
          {/* Unknown paths used to render a blank page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <GlobalPlayer />
      </BrowserRouter>
    </PlayerProvider>
  );
}
