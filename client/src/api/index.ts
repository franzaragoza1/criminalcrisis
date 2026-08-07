const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('cc_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Public
  getHero: () => request('/hero'),
  getReleases: () => request('/releases'),
  getRelease: (slug: string) => request(`/releases/${slug}`),
  getArtists: () => request('/artists'),
  getArtist: (slug: string) => request(`/artists/${slug}`),
  getEvents: () => request('/events'),
  sendContact: (data: object) =>
    request('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),

  // Admin - Artists
  createArtist: (data: FormData) =>
    request('/artists', { method: 'POST', headers: authHeaders(), body: data }),
  updateArtist: (id: number, data: FormData) =>
    request(`/artists/${id}`, { method: 'PUT', headers: authHeaders(), body: data }),
  deleteArtist: (id: number) =>
    request(`/artists/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeaders() } }),

  // Admin - Releases
  createRelease: (data: FormData) =>
    request('/releases', { method: 'POST', headers: authHeaders(), body: data }),
  updateRelease: (id: number, data: FormData) =>
    request(`/releases/${id}`, { method: 'PUT', headers: authHeaders(), body: data }),
  deleteRelease: (id: number) =>
    request(`/releases/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeaders() } }),

  // Admin - Events
  createEvent: (data: FormData) =>
    request('/events', { method: 'POST', headers: authHeaders(), body: data }),
  updateEvent: (id: number, data: FormData) =>
    request(`/events/${id}`, { method: 'PUT', headers: authHeaders(), body: data }),
  deleteEvent: (id: number) =>
    request(`/events/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeaders() } }),

  // Admin - Hero
  updateHero: (data: FormData) =>
    request('/hero', { method: 'PUT', headers: authHeaders(), body: data }),

  // --- Promo pool: public (token-gated, no login) ---
  getPromo: (slug: string, k: string) =>
    request(`/promo/${slug}?k=${encodeURIComponent(k)}`),
  /** Fire-and-forget engagement beacon; never blocks or interrupts playback. */
  trackPromoEvent: (slug: string, body: { k: string; type: string; track_id?: number }) =>
    fetch(`${BASE}/promo/${slug}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined),
  promoDownloadUrl: (slug: string, trackId: number, k: string, format: 'mp3' | 'wav' = 'mp3') =>
    `${BASE}/promo/${slug}/download/${trackId}?k=${encodeURIComponent(k)}&format=${format}`,
  sendPromoFeedback: (slug: string, body: object) =>
    request(`/promo/${slug}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  promoSignup: (body: object) =>
    request('/promo/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  // --- Promo pool: admin ---
  getPromoContacts: (query = '') => request(`/promo/contacts${query}`, { headers: authHeaders() }),
  getPromoContactStats: () => request('/promo/contacts/stats', { headers: authHeaders() }),
  createPromoContact: (body: object) =>
    request('/promo/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }),
  updatePromoContact: (id: number, body: object) =>
    request(`/promo/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }),
  deletePromoContact: (id: number) =>
    request(`/promo/contacts/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    }),
  importPromoContacts: (data: FormData) =>
    request('/promo/contacts/import', { method: 'POST', headers: authHeaders(), body: data }),
  exportPromoContactsUrl: () => `${BASE}/promo/contacts/export.csv`,

  getPromoCampaigns: () => request('/promo/campaigns', { headers: authHeaders() }),
  createPromoCampaign: (data: FormData) =>
    request('/promo/campaigns', { method: 'POST', headers: authHeaders(), body: data }),
  updatePromoCampaign: (id: number, data: FormData) =>
    request(`/promo/campaigns/${id}`, { method: 'PUT', headers: authHeaders(), body: data }),
  deletePromoCampaign: (id: number) =>
    request(`/promo/campaigns/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    }),
  addPromoTrack: (campaignId: number, data: FormData) =>
    request(`/promo/campaigns/${campaignId}/tracks`, { method: 'POST', headers: authHeaders(), body: data }),
  deletePromoTrack: (id: number) =>
    request(`/promo/tracks/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    }),
  reorderPromoTracks: (campaignId: number, ids: number[]) =>
    request(`/promo/campaigns/${campaignId}/tracks/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ids }),
    }),
  addPromoRecipients: (campaignId: number, body: object) =>
    request(`/promo/campaigns/${campaignId}/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }),
  sendPromoCampaign: (campaignId: number) =>
    request(`/promo/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    }),
  testPromoCampaign: (campaignId: number, email: string) =>
    request(`/promo/campaigns/${campaignId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ email }),
    }),
  getPromoStats: (campaignId: number) =>
    request(`/promo/campaigns/${campaignId}/stats`, { headers: authHeaders() }),
};
