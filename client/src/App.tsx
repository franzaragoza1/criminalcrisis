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
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { api } from './api';
import type { HeroContent, Release, Event, Artist } from './types';

function PublicSite() {
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const { currentRelease } = usePlayer();

  useEffect(() => {
    Promise.all([
      api.getHero().then(h => setHero(h as HeroContent)).catch(() => {}),
      api.getReleases().then(r => setReleases(r as Release[])).catch(() => {}),
      api.getEvents().then(e => setEvents(e as Event[])).catch(() => {}),
      api.getArtists().then(a => setArtists(a as Artist[])).catch(() => {}),
    ]);
  }, []);

  return (
    <div className="min-h-screen">
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
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/*" element={<AdminRoute />} />
        </Routes>
        <GlobalPlayer />
      </BrowserRouter>
    </PlayerProvider>
  );
}
