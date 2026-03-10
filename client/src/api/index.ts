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
};
