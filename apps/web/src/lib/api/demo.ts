/**
 * In-browser stand-in for the API, used by the preview build (VITE_DATA_MODE=demo).
 * It applies the same validation, pricing, seat and permission rules as the server,
 * and saves changes to this browser's localStorage only.
 */
import {
  SEED_TRIPS, SEED_LEADERS, SEED_REVIEWS, SEED_ALBUMS, sampleBookings, DEFAULT_SETTINGS,
  bookingInputSchema, reviewInputSchema, contactInputSchema, passportLookupSchema, tripInputSchema, leaderInputSchema,
  albumInputSchema, settingsSchema, toTripView, makeBookingRef, bookingWhatsAppMessage, contactWhatsAppMessage, waLink,
  bookingsToCsv, can, type Trip, type Leader, type Review, type Album, type Booking, type SiteSettings,
  type ContactMessage, type AdminUser, type AdminRole, type Permission, type TripView, type PassportStamp,
} from '@jzt/shared';
import { ZodError, type ZodTypeAny, type output } from 'zod';
import type { DataSource, PublicSettings } from './types';
import { ApiError } from './types';
import { DATA_MODE } from '../config';

const STATIC = DATA_MODE === 'static';

const KEY = STATIC ? 'jzt-static-v1' : 'jzt-demo-v1';
const SESSION_KEY = 'jzt-demo-admin';

interface State {
  trips: Trip[];
  leaders: Leader[];
  reviews: Review[];
  albums: Album[];
  bookings: Booking[];
  messages: ContactMessage[];
  settings: SiteSettings;
  users: AdminUser[];
}

function fresh(): State {
  if (STATIC) {
    // Live site without a backend: real content only. Edit packages/shared/src/seed.ts and redeploy to change it.
    return {
      trips: structuredClone(SEED_TRIPS).filter((t) => !t.isDemo),
      leaders: structuredClone(SEED_LEADERS).filter((l) => !l.isDemo),
      reviews: [],
      albums: [],
      bookings: [],
      messages: [],
      settings: { ...DEFAULT_SETTINGS },
      users: [],
    };
  }
  return {
    trips: structuredClone(SEED_TRIPS).map((t) => ({ ...t, isPublished: true })),
    leaders: structuredClone(SEED_LEADERS),
    reviews: structuredClone(SEED_REVIEWS),
    albums: structuredClone(SEED_ALBUMS),
    bookings: sampleBookings(),
    messages: [],
    settings: { ...DEFAULT_SETTINGS },
    users: [
      { id: 'demo-owner', email: 'owner@demo.joinziptrip', name: 'Demo owner', role: 'owner', isActive: true, lastLoginAt: null },
      { id: 'demo-manager', email: 'manager@demo.joinziptrip', name: 'Demo manager', role: 'manager', isActive: true, lastLoginAt: null },
      { id: 'demo-editor', email: 'editor@demo.joinziptrip', name: 'Demo editor', role: 'editor', isActive: true, lastLoginAt: null },
    ],
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    // In static mode only this visitor's own bookings are kept; content always comes from the code.
    if (raw) return STATIC ? { ...fresh(), bookings: JSON.parse(raw).bookings ?? [] } : { ...fresh(), ...JSON.parse(raw) };
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return fresh();
}

let state = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or blocked storage: changes live until the tab closes */
  }
}

const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();

function parse<S extends ZodTypeAny>(schema: S, input: unknown): output<S> {
  try {
    return schema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ApiError(400, 'Some details need fixing', Object.fromEntries(e.issues.map((i) => [i.path.join('.'), i.message])));
    }
    throw e;
  }
}

const seatsBooked = (tripId: string) =>
  state.bookings.filter((b) => b.tripId === tripId && (b.status === 'confirmed' || b.status === 'completed')).reduce((s, b) => s + b.travellers, 0);
const view = (t: Trip): TripView => toTripView(t, seatsBooked(t.id));
const sortTrips = (a: TripView, b: TripView) => (a.departureDate ?? '9999').localeCompare(b.departureDate ?? '9999');

function notFound(what: string): never {
  throw new ApiError(404, `${what} not found`);
}

// ---------- demo admin session ----------
function session(): AdminUser | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return state.users.find((u) => u.id === id) ?? null;
  } catch {
    return memorySession;
  }
}
let memorySession: AdminUser | null = null;
function setSession(u: AdminUser | null) {
  memorySession = u;
  try {
    if (u) sessionStorage.setItem(SESSION_KEY, u.id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* fall back to memory */
  }
}
function guard(p?: Permission): AdminUser {
  const u = session();
  if (!u) throw new ApiError(401, 'Sign in to continue');
  if (p && !can(u.role, p)) throw new ApiError(403, "Your role doesn't allow this action");
  return u;
}

function uniqueSlug(list: { slug: string; id: string }[], slug: string, id?: string) {
  if (list.some((x) => x.slug === slug && x.id !== id)) throw new ApiError(409, 'That web address (slug) is already in use');
}

export const demoSource: DataSource = {
  mode: 'demo',

  async settings(): Promise<PublicSettings> {
    await wait(60);
    return { ...state.settings, paymentsEnabled: false, razorpayKeyId: null };
  },
  async trips() {
    await wait();
    return state.trips.filter((t) => t.isPublished).map(view).sort(sortTrips);
  },
  async trip(slug) {
    await wait();
    const t = state.trips.find((x) => x.slug === slug && x.isPublished);
    return t ? view(t) : notFound('Trip');
  },
  async leaders() {
    await wait();
    return state.leaders.filter((l) => l.isPublished).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async leader(slug) {
    await wait();
    return state.leaders.find((l) => l.slug === slug && l.isPublished) ?? notFound('Profile');
  },
  async reviews() {
    await wait();
    return state.reviews.filter((r) => r.status === 'approved').sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.createdAt.localeCompare(a.createdAt));
  },
  async submitReview(input) {
    await wait(400);
    const r = parse(reviewInputSchema, input);
    const b = r.bookingRef ? state.bookings.find((x) => x.ref === r.bookingRef.toUpperCase() && x.status === 'completed') : undefined;
    state.reviews.push({
      id: uuid(), tripId: b?.tripId ?? r.tripId ?? null, tripName: r.tripName, name: r.name, photoUrl: r.photoUrl ?? null,
      rating: r.rating, body: r.body, experienceDate: r.experienceDate ?? null, status: 'pending', isFeatured: false,
      isVerified: !!b, isDemo: false, source: 'website', createdAt: now(),
    });
    save();
  },
  async albums() {
    await wait();
    return state.albums.filter((a) => a.isPublished);
  },
  async album(slug) {
    await wait();
    return state.albums.find((a) => a.slug === slug && a.isPublished) ?? notFound('Album');
  },
  async createBooking(input) {
    await wait(500);
    const i = parse(bookingInputSchema, input);
    const t = state.trips.find((x) => x.slug === i.tripSlug && x.isPublished);
    if (!t) throw new ApiError(404, "We couldn't find that trip. It may have been unpublished.");
    const v = view(t);
    if (t.isDemo || t.priceInr == null || !t.departureDate) throw new ApiError(409, "This trip isn't open for booking yet. Message us on WhatsApp to be notified.");
    if (v.status === 'departed') throw new ApiError(409, 'This trip has already departed.');
    if (v.status === 'sold_out') throw new ApiError(409, 'This trip is sold out. Message us on WhatsApp to join the waitlist.');
    if (v.seatsLeft != null && i.travellers > v.seatsLeft) throw new ApiError(409, `Only ${v.seatsLeft} seat${v.seatsLeft === 1 ? '' : 's'} left. Reduce the number of travellers.`);
    const booking: Booking = {
      id: uuid(), ref: makeBookingRef(), tripId: t.id, tripTitle: t.title, tripSlug: t.slug, departureDate: t.departureDate,
      fullName: i.fullName, phone: i.phone, email: i.email, travellers: i.travellers, emergencyName: i.emergencyName,
      emergencyPhone: i.emergencyPhone, notes: i.notes, unitPriceInr: t.priceInr, totalInr: t.priceInr * i.travellers,
      status: 'pending', paymentStatus: 'unpaid', channel: 'whatsapp', adminNotes: '', createdAt: now(), updatedAt: now(),
    };
    state.bookings.unshift(booking);
    save();
    const message = bookingWhatsAppMessage(booking, `${t.pickupTime}, ${t.pickupPoint}`);
    return { booking, message, whatsappUrl: waLink(state.settings.whatsappNumber, message) };
  },
  async sendContact(input) {
    await wait(400);
    const c = parse(contactInputSchema, input);
    state.messages.unshift({ id: uuid(), name: c.name, phone: c.phone, email: c.email, topic: c.topic, message: c.message, handled: false, createdAt: now() });
    save();
    return { whatsappUrl: waLink(state.settings.whatsappNumber, contactWhatsAppMessage(c)) };
  },
  async passport(phone, ref) {
    await wait(400);
    const q = parse(passportLookupSchema, { phone, ref });
    if (!state.bookings.some((b) => b.phone === q.phone && b.ref === q.ref)) throw new ApiError(404, "We couldn't match that mobile number and booking reference.");
    return state.bookings
      .filter((b) => b.phone === q.phone && (b.status === 'confirmed' || b.status === 'completed'))
      .map((b): PassportStamp => {
        const t = state.trips.find((x) => x.id === b.tripId);
        const dep = b.departureDate ? new Date(`${b.departureDate}T${t?.departureTime ?? '00:00'}:00+05:30`).getTime() : Infinity;
        return {
          tripTitle: b.tripTitle, destination: t?.destination ?? b.tripTitle, region: t?.region ?? '', date: b.departureDate,
          altitudeM: t?.altitudeM ?? null, bookingRef: b.ref, state: b.status === 'completed' || dep < Date.now() ? 'completed' : 'upcoming',
        };
      });
  },

  admin: {
    async me() {
      await wait(60);
      return session();
    },
    async login() {
      if (STATIC) throw new ApiError(404, 'Not found');
      await wait(300);
      const u = state.users[0];
      setSession(u);
      return u;
    },
    async switchRole(role: AdminRole) {
      const u = state.users.find((x) => x.role === role)!;
      setSession(u);
      return u;
    },
    async resetDemo() {
      state = fresh();
      save();
    },
    async logout() {
      setSession(null);
    },
    async overview() {
      const u = guard();
      await wait();
      const upcoming = state.trips.map(view).filter((t) => t.status !== 'departed' && t.isPublished).sort(sortTrips);
      const confirmedTravellers = state.bookings
        .filter((b) => b.status === 'confirmed' && upcoming.some((t) => t.id === b.tripId))
        .reduce((s, b) => s + b.travellers, 0);
      return {
        upcoming,
        pendingBookings: state.bookings.filter((b) => b.status === 'pending').length,
        confirmedTravellers,
        pendingReviews: state.reviews.filter((r) => r.status === 'pending').length,
        openMessages: state.messages.filter((m) => !m.handled).length,
        recentBookings: u.role === 'editor' ? [] : [...state.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
      };
    },
    async trips() {
      guard();
      await wait();
      return state.trips.map(view).sort(sortTrips);
    },
    async trip(id) {
      guard();
      await wait();
      const t = state.trips.find((x) => x.id === id);
      return t ? view(t) : notFound('Trip');
    },
    async createTrip(input) {
      guard('trips:write');
      await wait();
      const t = parse(tripInputSchema, input);
      uniqueSlug(state.trips, t.slug);
      const trip: Trip = { ...t, id: uuid(), createdAt: now(), updatedAt: now() } as Trip;
      state.trips.push(trip);
      save();
      return view(trip);
    },
    async updateTrip(id, input) {
      guard('trips:write');
      await wait();
      const t = parse(tripInputSchema, input);
      uniqueSlug(state.trips, t.slug, id);
      const i = state.trips.findIndex((x) => x.id === id);
      if (i < 0) notFound('Trip');
      state.trips[i] = { ...state.trips[i], ...t, updatedAt: now() } as Trip;
      save();
      return view(state.trips[i]);
    },
    async patchTrip(id, patch) {
      guard('trips:write');
      await wait(150);
      const t = state.trips.find((x) => x.id === id) ?? notFound('Trip');
      Object.assign(t, patch, { updatedAt: now() });
      save();
      return view(t);
    },
    async deleteTrip(id) {
      guard('trips:delete');
      await wait();
      if (state.bookings.some((b) => b.tripId === id)) throw new ApiError(409, 'This trip has bookings, so it can’t be deleted. Unpublish it instead.');
      state.trips = state.trips.filter((t) => t.id !== id);
      save();
    },
    async bookings(f) {
      guard('bookings:read');
      await wait();
      const q = f.q?.toLowerCase();
      return state.bookings
        .filter((b) => (!f.tripId || b.tripId === f.tripId) && (!f.status || b.status === f.status))
        .filter((b) => !q || [b.fullName, b.phone, b.ref, b.email].some((s) => s.toLowerCase().includes(q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async updateBooking(id, u) {
      guard('bookings:write');
      await wait(200);
      const b = state.bookings.find((x) => x.id === id) ?? notFound('Booking');
      if (u.status && (u.status === 'confirmed' || u.status === 'completed') && b.status !== 'confirmed' && b.status !== 'completed') {
        const t = state.trips.find((x) => x.id === b.tripId);
        if (t?.seatsTotal != null) {
          const left = t.seatsTotal - seatsBooked(t.id);
          if (b.travellers > left) throw new ApiError(409, left <= 0 ? 'This trip is sold out.' : `Only ${left} seat${left === 1 ? '' : 's'} left on this trip.`);
        }
      }
      Object.assign(b, Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined)), { updatedAt: now() });
      save();
      return b;
    },
    async exportCsv(f) {
      guard('bookings:export');
      return bookingsToCsv(state.bookings.filter((b) => !f.tripId || b.tripId === f.tripId));
    },
    async leaders() {
      guard();
      await wait();
      return [...state.leaders].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async createLeader(input) {
      guard('leaders:write');
      await wait();
      const l = parse(leaderInputSchema, input);
      uniqueSlug(state.leaders, l.slug);
      const leader = { ...l, id: uuid() } as Leader;
      state.leaders.push(leader);
      save();
      return leader;
    },
    async updateLeader(id, input) {
      guard('leaders:write');
      await wait();
      const l = parse(leaderInputSchema, input);
      uniqueSlug(state.leaders, l.slug, id);
      const i = state.leaders.findIndex((x) => x.id === id);
      if (i < 0) notFound('Profile');
      state.leaders[i] = { ...state.leaders[i], ...l } as Leader;
      save();
      return state.leaders[i];
    },
    async deleteLeader(id) {
      guard('leaders:write');
      state.leaders = state.leaders.filter((l) => l.id !== id);
      state.trips.forEach((t) => (t.leaderIds = t.leaderIds.filter((x) => x !== id)));
      save();
    },
    async albums() {
      guard();
      await wait();
      return state.albums;
    },
    async createAlbum(input) {
      guard('gallery:write');
      await wait();
      const a = parse(albumInputSchema, input);
      uniqueSlug(state.albums, a.slug);
      const album = { ...a, id: uuid(), createdAt: now() } as Album;
      state.albums.unshift(album);
      save();
      return album;
    },
    async updateAlbum(id, input) {
      guard('gallery:write');
      await wait();
      const a = parse(albumInputSchema, input);
      uniqueSlug(state.albums, a.slug, id);
      const i = state.albums.findIndex((x) => x.id === id);
      if (i < 0) notFound('Album');
      state.albums[i] = { ...state.albums[i], ...a } as Album;
      save();
      return state.albums[i];
    },
    async deleteAlbum(id) {
      guard('gallery:write');
      state.albums = state.albums.filter((a) => a.id !== id);
      save();
    },
    async reviews(status) {
      guard();
      await wait();
      return state.reviews.filter((r) => !status || r.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async addReview(input) {
      guard('reviews:moderate');
      const r = parse(reviewInputSchema, input);
      const review: Review = {
        id: uuid(), tripId: r.tripId ?? null, tripName: r.tripName, name: r.name, photoUrl: r.photoUrl ?? null, rating: r.rating,
        body: r.body, experienceDate: r.experienceDate ?? null, status: 'approved', isFeatured: false, isVerified: false,
        isDemo: false, source: input.source, createdAt: now(),
      };
      state.reviews.unshift(review);
      save();
      return review;
    },
    async moderateReview(id, m) {
      guard('reviews:moderate');
      await wait(150);
      const r = state.reviews.find((x) => x.id === id) ?? notFound('Review');
      Object.assign(r, Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)));
      save();
      return r;
    },
    async deleteReview(id) {
      guard('reviews:moderate');
      state.reviews = state.reviews.filter((r) => r.id !== id);
      save();
    },
    async messages() {
      guard('messages:read');
      await wait();
      return state.messages;
    },
    async setMessageHandled(id, handled) {
      guard('messages:read');
      const m = state.messages.find((x) => x.id === id) ?? notFound('Message');
      m.handled = handled;
      save();
      return m;
    },
    async settings() {
      guard();
      return { ...state.settings };
    },
    async saveSettings(s) {
      guard('settings:write');
      await wait();
      state.settings = parse(settingsSchema, s) as SiteSettings;
      save();
      return state.settings;
    },
    async users() {
      guard('users:manage');
      return state.users;
    },
    async createUser() {
      guard('users:manage');
      throw new ApiError(400, 'Team accounts are created on the live site. In the demo you can switch roles above instead.');
    },
    async updateUser() {
      guard('users:manage');
      throw new ApiError(400, 'Team accounts are managed on the live site.');
    },
    async upload(file) {
      guard('gallery:write');
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new ApiError(415, 'In the demo, upload a JPG, PNG, WebP or AVIF image');
      // Shrink to keep the demo within browser storage limits; the live site keeps the original.
      const url = await downscale(file, 1600);
      return { url, kind: 'image' as const };
    },
  },
};

async function downscale(file: File, max: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.8);
}
