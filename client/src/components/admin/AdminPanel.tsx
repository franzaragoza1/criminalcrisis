import { useState, useEffect } from 'react';
import { LogOut, Music, Users, Calendar, Home, Plus, Trash2, Edit3, X, Send } from 'lucide-react';
import { api } from '../../api';
import type { Artist, Release, Event } from '../../types';
import { INPUT_CLS, LABEL_CLS } from './adminStyles';
import PromoAdmin from './PromoAdmin';

type Section = 'home' | 'releases' | 'artists' | 'events' | 'promo';

// ─── Reusable components ──────────────────────────────────────────────────────

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold text-[#111]">{title}</h2>
      <button onClick={onAdd} className="flex items-center gap-2 bg-[#111] text-white px-4 py-2 text-sm font-medium hover:bg-[#333] transition-colors cursor-pointer">
        <Plus size={14} /> Add New
      </button>
    </div>
  );
}

function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onConfirm} className="text-xs bg-red-500 text-white px-2 py-1 hover:bg-red-600 cursor-pointer">Delete</button>
      <button onClick={onCancel} className="text-xs border border-[#E0E0E0] px-2 py-1 hover:border-[#111] cursor-pointer">Cancel</button>
    </div>
  );
}

type TrackRow = { name: string; id: string };

// Tracklist editor: track name + optional Bandcamp track ID
function TracklistEditor({ tracks, onChange }: { tracks: TrackRow[]; onChange: (t: TrackRow[]) => void }) {
  const update = (i: number, field: keyof TrackRow, val: string) => {
    const t = [...tracks]; t[i] = { ...t[i], [field]: val }; onChange(t);
  };
  const remove = (i: number) => onChange(tracks.filter((_, idx) => idx !== i));
  const add = () => onChange([...tracks, { name: '', id: '' }]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-[10px] font-semibold tracking-wide uppercase text-[#C0BABC] px-8">
        <span className="flex-1">Track name</span>
        <span className="w-32">Bandcamp ID <span className="normal-case font-normal">(opcional)</span></span>
      </div>
      {tracks.map((track, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs text-[#C0BABC] font-mono w-6 text-right flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
          <input
            value={track.name}
            onChange={e => update(i, 'name', e.target.value)}
            placeholder={`Track ${i + 1}`}
            className="flex-1 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#111] transition-colors"
          />
          <input
            value={track.id}
            onChange={e => update(i, 'id', e.target.value.replace(/\D/g, ''))}
            placeholder="1234567890"
            className="w-32 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[#111] transition-colors"
          />
          <button type="button" onClick={() => remove(i)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors cursor-pointer mt-1">
        <Plus size={12} /> Add track
      </button>
      <p className="text-xs text-[#999] mt-1">El ID de Bandcamp está en el embed code del track: <span className="font-mono">/track=<strong>XXXXXXXXXX</strong>/</span></p>
    </div>
  );
}

// Links editor: platform name + URL pairs
function LinksEditor({ links, onChange }: { links: Record<string, string>; onChange: (l: Record<string, string>) => void }) {
  const entries = Object.entries(links);

  const updateKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(links)) next[k === oldKey ? newKey : k] = v;
    onChange(next);
  };
  const updateVal = (key: string, val: string) => onChange({ ...links, [key]: val });
  const remove = (key: string) => { const next = { ...links }; delete next[key]; onChange(next); };
  const add = () => onChange({ ...links, '': '' });

  const PLATFORM_PRESETS = ['Spotify', 'SoundCloud', 'Apple Music', 'Bandcamp', 'YouTube', 'Beatport'];

  return (
    <div className="space-y-2">
      {entries.map(([key, val], i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={key}
            onChange={e => updateKey(key, e.target.value)}
            placeholder="Platform"
            list="platform-presets"
            className="w-32 flex-shrink-0 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#111] transition-colors"
          />
          <datalist id="platform-presets">
            {PLATFORM_PRESETS.map(p => <option key={p} value={p} />)}
          </datalist>
          <input
            value={val}
            onChange={e => updateVal(key, e.target.value)}
            placeholder="https://..."
            type="url"
            className="flex-1 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#111] transition-colors"
          />
          <button type="button" onClick={() => remove(key)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors cursor-pointer mt-1">
        <Plus size={12} /> Add link
      </button>
    </div>
  );
}

// Social links editor (platform + URL)
function SocialLinksEditor({ links, onChange }: { links: Record<string, string>; onChange: (l: Record<string, string>) => void }) {
  const SOCIAL_PRESETS = ['Instagram', 'SoundCloud', 'Bandcamp', 'Spotify', 'YouTube', 'Facebook', 'Twitter', 'Resident Advisor'];
  const entries = Object.entries(links);

  const updateKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(links)) next[k === oldKey ? newKey : k] = v;
    onChange(next);
  };
  const updateVal = (key: string, val: string) => onChange({ ...links, [key]: val });
  const remove = (key: string) => { const next = { ...links }; delete next[key]; onChange(next); };
  const add = () => onChange({ ...links, '': '' });

  return (
    <div className="space-y-2">
      {entries.map(([key, val], i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={key}
            onChange={e => updateKey(key, e.target.value)}
            placeholder="Platform"
            list="social-presets"
            className="w-36 flex-shrink-0 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#111] transition-colors"
          />
          <datalist id="social-presets">
            {SOCIAL_PRESETS.map(p => <option key={p} value={p} />)}
          </datalist>
          <input
            value={val}
            onChange={e => updateVal(key, e.target.value)}
            placeholder="https://..."
            type="url"
            className="flex-1 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#111] transition-colors"
          />
          <button type="button" onClick={() => remove(key)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors cursor-pointer mt-1">
        <Plus size={12} /> Add social link
      </button>
    </div>
  );
}

// Lineup editor (simple list of names)
function LineupEditor({ lineup, onChange }: { lineup: string[]; onChange: (l: string[]) => void }) {
  const update = (i: number, val: string) => { const l = [...lineup]; l[i] = val; onChange(l); };
  const remove = (i: number) => onChange(lineup.filter((_, idx) => idx !== i));
  const add = () => onChange([...lineup, '']);

  return (
    <div className="space-y-2">
      {lineup.map((name, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={name}
            onChange={e => update(i, e.target.value)}
            placeholder="Artist / DJ name"
            className="flex-1 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#111] transition-colors"
          />
          <button type="button" onClick={() => remove(i)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-[#111] transition-colors cursor-pointer mt-1">
        <Plus size={12} /> Add artist
      </button>
    </div>
  );
}

// ─── Artists ──────────────────────────────────────────────────────────────────

function ArtistsAdmin() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);

  const load = async () => setArtists(await api.getArtists() as Artist[]);
  useEffect(() => { load(); }, []);

  const resetForm = () => { setName(''); setBio(''); setSocialLinks({}); setPhoto(null); setEditing(null); setShowForm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', name);
    fd.append('bio', bio);
    fd.append('social_links', JSON.stringify(socialLinks));
    if (photo) fd.append('photo', photo);
    try {
      if (editing) await api.updateArtist(editing.id, fd);
      else await api.createArtist(fd);
      await load();
      resetForm();
    } catch (err: any) { alert(err.message); }
  };

  const startEdit = (a: Artist) => {
    setEditing(a); setName(a.name); setBio(a.bio || ''); setSocialLinks(a.social_links || {}); setShowForm(true);
  };

  return (
    <div>
      <SectionHeader title="Artists" onAdd={() => { resetForm(); setShowForm(true); }} />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#F5F5F5] p-6 mb-6 space-y-5">
          <h3 className="font-semibold text-[#111]">{editing ? 'Edit Artist' : 'New Artist'}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className={INPUT_CLS} placeholder="Artist name" />
            </div>
            <div>
              <label className={LABEL_CLS}>Photo</label>
              <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} className="text-sm text-[#888]" />
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className={INPUT_CLS + ' resize-none'} placeholder="Short artist biography..." />
          </div>
          <div>
            <label className={LABEL_CLS}>Social Links</label>
            <SocialLinksEditor links={socialLinks} onChange={setSocialLinks} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-[#111] text-white px-5 py-2 text-sm font-medium hover:bg-[#333] transition-colors cursor-pointer">
              {editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="border border-[#E0E0E0] px-5 py-2 text-sm hover:border-[#111] transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {artists.map(a => (
          <div key={a.id} className="flex items-center gap-4 py-3 border-b border-[#E8E8E8]">
            {a.photo_url && <img src={a.photo_url} alt={a.name} className="w-10 h-10 object-cover" />}
            <span className="flex-1 text-sm font-medium text-[#111]">{a.name}</span>
            <div className="flex items-center gap-3">
              {confirmDelete === a.id ? (
                <ConfirmDelete onConfirm={async () => { await api.deleteArtist(a.id); setConfirmDelete(null); load(); }} onCancel={() => setConfirmDelete(null)} />
              ) : (
                <>
                  <button onClick={() => startEdit(a)} className="text-[#888] hover:text-[#111] transition-colors cursor-pointer"><Edit3 size={14} /></button>
                  <button onClick={() => setConfirmDelete(a.id)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Releases ─────────────────────────────────────────────────────────────────

function ReleasesAdmin() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [bandcampEmbed, setBandcampEmbed] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [tracklist, setTracklist] = useState<TrackRow[]>([]);
  const [artistIds, setArtistIds] = useState<number[]>([]);
  const [artwork, setArtwork] = useState<File | null>(null);

  const load = async () => {
    const [r, a] = await Promise.all([api.getReleases(), api.getArtists()]);
    setReleases(r as Release[]); setArtists(a as Artist[]);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setTitle(''); setReleaseDate(''); setCatalogNumber(''); setBandcampEmbed(''); setLinks({}); setTracklist([] as TrackRow[]); setArtistIds([]); setArtwork(null); setEditing(null); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', title);
    fd.append('release_date', releaseDate);
    fd.append('catalog_number', catalogNumber);
    fd.append('bandcamp_embed', bandcampEmbed);
    fd.append('links', JSON.stringify(links));
    const serializedTracklist = tracklist
      .filter(t => t.name.trim())
      .map(t => t.id ? { name: t.name, id: parseInt(t.id) } : t.name);
    fd.append('tracklist', JSON.stringify(serializedTracklist));
    fd.append('artist_ids', JSON.stringify(artistIds));
    if (artwork) fd.append('artwork', artwork);
    try {
      if (editing) await api.updateRelease(editing.id, fd);
      else await api.createRelease(fd);
      await load(); resetForm();
    } catch (err: any) { alert(err.message); }
  };

  const startEdit = (r: Release) => {
    setEditing(r); setTitle(r.title); setReleaseDate(r.release_date || '');
    setCatalogNumber(r.catalog_number || '');
    setBandcampEmbed(r.bandcamp_embed || ''); setLinks(r.links || {});
    setTracklist(r.tracklist?.map(t => typeof t === 'string' ? { name: t, id: '' } : { name: t.name, id: String(t.id) }) || []); setArtistIds(r.artists?.map(a => a.id) || []);
    setShowForm(true);
  };

  const toggleArtist = (id: number) =>
    setArtistIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div>
      <SectionHeader title="Releases" onAdd={() => { resetForm(); setShowForm(true); }} />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#F5F5F5] p-6 mb-6 space-y-5">
          <h3 className="font-semibold text-[#111]">{editing ? 'Edit Release' : 'New Release'}</h3>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className={LABEL_CLS}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className={INPUT_CLS} placeholder="Release title" />
            </div>
            <div>
              <label className={LABEL_CLS}>Release Date</label>
              <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Catalog Number</label>
              <input value={catalogNumber} onChange={e => setCatalogNumber(e.target.value)} className={INPUT_CLS} placeholder="CRC001" />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Artwork</label>
            <input type="file" accept="image/*" onChange={e => setArtwork(e.target.files?.[0] || null)} className="text-sm text-[#888]" />
          </div>

          {artists.length > 0 && (
            <div>
              <label className={LABEL_CLS}>Artists</label>
              <div className="flex flex-wrap gap-2">
                {artists.map(a => (
                  <button
                    key={a.id} type="button" onClick={() => toggleArtist(a.id)}
                    className={`text-xs px-3 py-1.5 border transition-colors cursor-pointer ${artistIds.includes(a.id) ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'}`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={LABEL_CLS}>Bandcamp Embed Code</label>
            <textarea
              value={bandcampEmbed} onChange={e => setBandcampEmbed(e.target.value)} rows={3}
              placeholder="Pega aquí el código iframe de Bandcamp (Share > Embed)"
              className={INPUT_CLS + ' resize-none font-mono text-xs'}
            />
            <p className="text-xs text-[#888] mt-1">En Bandcamp: Share &rarr; Embed &rarr; copia el código &lt;iframe&gt;</p>
          </div>

          <div>
            <label className={LABEL_CLS}>Links de streaming</label>
            <LinksEditor links={links} onChange={setLinks} />
          </div>

          <div>
            <label className={LABEL_CLS}>Tracklist</label>
            <TracklistEditor tracks={tracklist} onChange={setTracklist} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-[#111] text-white px-5 py-2 text-sm font-medium hover:bg-[#333] transition-colors cursor-pointer">
              {editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="border border-[#E0E0E0] px-5 py-2 text-sm hover:border-[#111] transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {releases.map(r => (
          <div key={r.id} className="flex items-center gap-4 py-3 border-b border-[#E8E8E8]">
            {r.artwork_url && <img src={r.artwork_url} alt={r.title} className="w-10 h-10 object-cover" />}
            <div className="flex-1">
              <p className="text-sm font-medium text-[#111]">{r.title}</p>
              <p className="text-xs text-[#888]">{r.artists?.map(a => a.name).join(', ')}</p>
            </div>
            <div className="flex items-center gap-3">
              {confirmDelete === r.id ? (
                <ConfirmDelete onConfirm={async () => { await api.deleteRelease(r.id); setConfirmDelete(null); load(); }} onCancel={() => setConfirmDelete(null)} />
              ) : (
                <>
                  <button onClick={() => startEdit(r)} className="text-[#888] hover:text-[#111] transition-colors cursor-pointer"><Edit3 size={14} /></button>
                  <button onClick={() => setConfirmDelete(r.id)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Events ───────────────────────────────────────────────────────────────────

function isDirectVideo(url: string) {
  return (
    url.includes('cloudinary.com') ||
    /\.(mp4|webm|ogg|mov)$/i.test(url)
  );
}

function EventsAdmin() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [lineup, setLineup] = useState<string[]>([]);
  const [ticketUrl, setTicketUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoMode, setVideoMode] = useState<'url' | 'file'>('url');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isPast, setIsPast] = useState(false);
  const [image, setImage] = useState<File | null>(null);

  const load = async () => setEvents(await api.getEvents() as Event[]);
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(''); setEventDate(''); setVenue(''); setCity(''); setLineup([]); setTicketUrl('');
    setVideoUrl(''); setVideoMode('url'); setVideoFile(null); setIsPast(false); setImage(null);
    setEditing(null); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', name); fd.append('event_date', eventDate); fd.append('venue', venue);
    fd.append('city', city); fd.append('lineup', JSON.stringify(lineup.filter(l => l.trim())));
    fd.append('ticket_url', ticketUrl); fd.append('is_past', isPast ? '1' : '0');
    if (videoMode === 'file' && videoFile) {
      fd.append('video', videoFile);
    } else {
      fd.append('video_url', videoUrl);
    }
    if (image) fd.append('image', image);
    try {
      if (editing) await api.updateEvent(editing.id, fd);
      else await api.createEvent(fd);
      await load(); resetForm();
    } catch (err: any) { alert(err.message); }
  };

  const startEdit = (ev: Event) => {
    setEditing(ev); setName(ev.name); setEventDate(ev.event_date); setVenue(ev.venue || '');
    setCity(ev.city || ''); setLineup(ev.lineup || []); setTicketUrl(ev.ticket_url || '');
    const existingVideo = ev.video_url || '';
    setVideoUrl(existingVideo);
    setVideoMode(existingVideo && isDirectVideo(existingVideo) ? 'file' : 'url');
    setVideoFile(null);
    setIsPast(ev.is_past === 1); setShowForm(true);
  };

  return (
    <div>
      <SectionHeader title="Events" onAdd={() => { resetForm(); setShowForm(true); }} />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#F5F5F5] p-6 mb-6 space-y-5">
          <h3 className="font-semibold text-[#111]">{editing ? 'Edit Event' : 'New Event'}</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className={INPUT_CLS} placeholder="Event name" />
            </div>
            <div>
              <label className={LABEL_CLS}>Date *</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Venue</label>
              <input value={venue} onChange={e => setVenue(e.target.value)} className={INPUT_CLS} placeholder="Sala / club" />
            </div>
            <div>
              <label className={LABEL_CLS}>City</label>
              <input value={city} onChange={e => setCity(e.target.value)} className={INPUT_CLS} placeholder="Madrid" />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Lineup</label>
            <LineupEditor lineup={lineup} onChange={setLineup} />
          </div>

          <div>
            <label className={LABEL_CLS}>Ticket URL</label>
            <input value={ticketUrl} onChange={e => setTicketUrl(e.target.value)} type="url" className={INPUT_CLS} placeholder="https://ra.co/events/..." />
          </div>

          <div>
            <label className={LABEL_CLS}>Vídeo <span className="font-normal normal-case text-[#C0BABC]">(opcional)</span></label>
            {/* Toggle mode */}
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() => setVideoMode('url')}
                className={`px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                  videoMode === 'url' ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'
                }`}
              >
                URL externa
              </button>
              <button
                type="button"
                onClick={() => setVideoMode('file')}
                className={`px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                  videoMode === 'file' ? 'bg-[#111] text-white border-[#111]' : 'border-[#E0E0E0] text-[#555] hover:border-[#111]'
                }`}
              >
                Subir archivo
              </button>
            </div>
            {videoMode === 'url' ? (
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                type="url"
                className={INPUT_CLS}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            ) : (
              <div className="space-y-1">
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => setVideoFile(e.target.files?.[0] || null)}
                  className="text-sm text-[#888]"
                />
                {editing && videoUrl && isDirectVideo(videoUrl) && !videoFile && (
                  <p className="text-xs text-[#888]">
                    Vídeo actual guardado — sube uno nuevo para reemplazarlo.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>Event Image</label>
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} className="text-sm text-[#888]" />
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_past" checked={isPast} onChange={e => setIsPast(e.target.checked)} className="cursor-pointer" />
            <label htmlFor="is_past" className="text-sm text-[#555] cursor-pointer">Mark as past event</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-[#111] text-white px-5 py-2 text-sm font-medium hover:bg-[#333] transition-colors cursor-pointer">
              {editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="border border-[#E0E0E0] px-5 py-2 text-sm hover:border-[#111] transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="flex items-center gap-4 py-3 border-b border-[#E8E8E8]">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#111]">{ev.name}</p>
              <p className="text-xs text-[#888]">{ev.event_date} · {ev.city}</p>
            </div>
            <div className="flex items-center gap-3">
              {confirmDelete === ev.id ? (
                <ConfirmDelete onConfirm={async () => { await api.deleteEvent(ev.id); setConfirmDelete(null); load(); }} onCancel={() => setConfirmDelete(null)} />
              ) : (
                <>
                  <button onClick={() => startEdit(ev)} className="text-[#888] hover:text-[#111] transition-colors cursor-pointer"><Edit3 size={14} /></button>
                  <button onClick={() => setConfirmDelete(ev.id)} className="text-[#888] hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroAdmin() {
  const [tagline, setTagline] = useState('Banging Boogie Bangers');
  const [image, setImage] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getHero().then((h: any) => { if (h?.tagline) setTagline(h.tagline); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('tagline', tagline);
    if (image) fd.append('image', image);
    try {
      await api.updateHero(fd);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111] mb-6">Homepage Content</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className={LABEL_CLS}>Tagline</label>
          <input value={tagline} onChange={e => setTagline(e.target.value)} className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Hero Background Image</label>
          <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} className="text-sm text-[#888]" />
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" className="bg-[#111] text-white px-5 py-2 text-sm font-medium hover:bg-[#333] transition-colors cursor-pointer">Save</button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </form>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>('releases');

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Homepage', icon: <Home size={16} /> },
    { id: 'releases', label: 'Releases', icon: <Music size={16} /> },
    { id: 'artists', label: 'Artists', icon: <Users size={16} /> },
    { id: 'events', label: 'Events', icon: <Calendar size={16} /> },
    { id: 'promo', label: 'Promo Pool', icon: <Send size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <aside className="w-56 bg-[#111] text-white flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <p className="font-black text-sm tracking-tight" style={{ fontFamily: "'ABCCamera', 'Helvetica Neue', sans-serif" }}>CRIMINAL CRISIS</p>
          <p className="text-xs text-white/40 mt-0.5">Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id} onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer ${section === item.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <a href="/" className="block text-xs text-white/40 hover:text-white transition-colors mb-3">← View Site</a>
          <button onClick={() => { localStorage.removeItem('cc_token'); onLogout(); }} className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors cursor-pointer">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {section === 'home' && <HeroAdmin />}
        {section === 'releases' && <ReleasesAdmin />}
        {section === 'artists' && <ArtistsAdmin />}
        {section === 'events' && <EventsAdmin />}
        {section === 'promo' && <PromoAdmin />}
      </main>
    </div>
  );
}
