import type { DataSource, PublicSettings } from './types';
import { ApiError } from './types';
import { API_URL } from '../config';

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  if (path.startsWith('/admin') && init.method && init.method !== 'GET') headers['x-jzt-csrf'] = '1';
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { ...init, body, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const d = (isJson ? data : {}) as { error?: string; fields?: Record<string, string> };
    throw new ApiError(res.status, d.error ?? `Request failed (${res.status})`, d.fields);
  }
  return data as T;
}

const get = <T>(p: string) => call<T>(p);
const post = <T>(p: string, json?: unknown) => call<T>(p, { method: 'POST', json });
const put = <T>(p: string, json?: unknown) => call<T>(p, { method: 'PUT', json });
const patch = <T>(p: string, json?: unknown) => call<T>(p, { method: 'PATCH', json });
const del = <T>(p: string) => call<T>(p, { method: 'DELETE' });
const qs = (o: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};

export const httpSource: DataSource = {
  mode: 'api',
  settings: () => get<PublicSettings>('/settings'),
  trips: () => get('/trips'),
  trip: (slug) => get(`/trips/${encodeURIComponent(slug)}`),
  leaders: () => get('/leaders'),
  leader: (slug) => get(`/leaders/${encodeURIComponent(slug)}`),
  reviews: () => get('/reviews'),
  submitReview: (input) => post('/reviews', input),
  albums: () => get('/albums'),
  album: (slug) => get(`/albums/${encodeURIComponent(slug)}`),
  createBooking: (input) => post('/bookings', input),
  sendContact: (input) => post('/contact', input),
  passport: async (phone, ref) => (await post<{ stamps: any[] }>('/passport', { phone, ref })).stamps,
  admin: {
    me: async () => {
      try {
        return (await get<{ user: any }>('/admin/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    login: async (email, password) => (await post<{ user: any }>('/admin/auth/login', { email, password })).user,
    logout: () => post('/admin/auth/logout'),
    overview: () => get('/admin/overview'),
    trips: () => get('/admin/trips'),
    trip: (id) => get(`/admin/trips/${id}`),
    createTrip: (input) => post('/admin/trips', input),
    updateTrip: (id, input) => put(`/admin/trips/${id}`, input),
    patchTrip: (id, p) => patch(`/admin/trips/${id}`, p),
    deleteTrip: (id) => del(`/admin/trips/${id}`),
    bookings: (f) => get(`/admin/bookings${qs(f)}`),
    updateBooking: (id, u) => patch(`/admin/bookings/${id}`, u),
    exportCsv: (f) => call<string>(`/admin/bookings/export.csv${qs(f)}`, { headers: { Accept: 'text/csv' } }),
    leaders: () => get('/admin/leaders'),
    createLeader: (input) => post('/admin/leaders', input),
    updateLeader: (id, input) => put(`/admin/leaders/${id}`, input),
    deleteLeader: (id) => del(`/admin/leaders/${id}`),
    albums: () => get('/admin/albums'),
    createAlbum: (input) => post('/admin/albums', input),
    updateAlbum: (id, input) => put(`/admin/albums/${id}`, input),
    deleteAlbum: (id) => del(`/admin/albums/${id}`),
    reviews: (status) => get(`/admin/reviews${qs({ status })}`),
    addReview: (input) => post('/admin/reviews', input),
    moderateReview: (id, m) => patch(`/admin/reviews/${id}`, m),
    deleteReview: (id) => del(`/admin/reviews/${id}`),
    messages: () => get('/admin/messages'),
    setMessageHandled: (id, handled) => patch(`/admin/messages/${id}`, { handled }),
    settings: () => get('/admin/settings'),
    saveSettings: (s) => put('/admin/settings', s),
    users: () => get('/admin/users'),
    createUser: (u) => post('/admin/users', u),
    updateUser: (id, u) => patch(`/admin/users/${id}`, u),
    upload: (file, folder) => {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', folder);
      return call('/admin/uploads', { method: 'POST', body: form });
    },
  },
};
