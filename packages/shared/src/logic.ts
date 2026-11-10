import type { Trip, TripStatus, TripView, SiteSettings, Booking, AdminRole, Difficulty, TripCategory, InclusionKey, LeaderRole } from './types';

// ---------- Pricing ----------

export function computeTotal(unitPriceInr: number, travellers: number): number {
  if (!Number.isFinite(unitPriceInr) || !Number.isFinite(travellers)) return 0;
  return Math.max(0, Math.round(unitPriceInr)) * Math.max(0, Math.floor(travellers));
}

// ---------- Seats & status ----------

/** Below this share of seats remaining, `auto` mode shows "Filling fast". */
export const FILLING_FAST_SHARE = 0.3;

export function seatsLeft(seatsTotal: number | null, seatsBooked: number): number | null {
  if (seatsTotal == null) return null;
  return Math.max(0, seatsTotal - seatsBooked);
}

/** Departure instant in IST. Falls back to midnight when no time is set. */
export function departureInstant(trip: Pick<Trip, 'departureDate' | 'departureTime'>): Date | null {
  if (!trip.departureDate) return null;
  return new Date(`${trip.departureDate}T${trip.departureTime ?? '00:00'}:00+05:30`);
}

export function deriveStatus(
  trip: Pick<Trip, 'statusMode' | 'seatsTotal' | 'departureDate' | 'departureTime'>,
  seatsBooked: number,
  now: Date = new Date(),
): TripStatus {
  const dep = departureInstant(trip);
  if (!dep) return 'dates_tba';
  if (dep.getTime() <= now.getTime()) return 'departed';
  if (trip.statusMode === 'sold_out') return 'sold_out';
  const left = seatsLeft(trip.seatsTotal, seatsBooked);
  if (left === 0) return 'sold_out';
  if (trip.statusMode === 'filling_fast') return 'filling_fast';
  if (trip.statusMode === 'open') return 'open';
  if (left != null && trip.seatsTotal && left / trip.seatsTotal <= FILLING_FAST_SHARE) return 'filling_fast';
  return 'open';
}

export function toTripView(trip: Trip, seatsBooked: number, now?: Date): TripView {
  return { ...trip, seatsBooked, seatsLeft: seatsLeft(trip.seatsTotal, seatsBooked), status: deriveStatus(trip, seatsBooked, now) };
}

export function isBookable(trip: TripView): boolean {
  return !trip.isDemo && trip.isPublished && trip.priceInr != null && (trip.status === 'open' || trip.status === 'filling_fast');
}

// ---------- Booking reference ----------

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeBookingRef(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)];
  return `JZT-${s}`;
}

// ---------- Formatting ----------

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatINR = (n: number) => inr.format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}
/** "Sun, 22 Nov 2026" */
export function formatDate(iso: string | null, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!iso) return 'Dates to be announced';
  const { y, m, d, dow } = parts(iso);
  const w = opts.weekday === false ? '' : `${DAYS[dow].slice(0, 3)}, `;
  return `${w}${d} ${MONTHS[m - 1]}${opts.year === false ? '' : ` ${y}`}`;
}
/** "Sunday, 22 November 2026" */
export function formatDateLong(iso: string | null): string {
  if (!iso) return 'Dates to be announced';
  const { y, m, d, dow } = parts(iso);
  return `${DAYS[dow]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}
export function monthShort(iso: string) { return MONTHS[parts(iso).m - 1]; }
export function dayOfMonth(iso: string) { return parts(iso).d; }
export function weekdayLong(iso: string) { return DAYS[parts(iso).dow]; }

/** "04:00" → "4:00 AM" */
export function formatTime(hhmm: string | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Text in square brackets is a placeholder the owner still has to fill in. */
export const isPlaceholder = (s: string | null | undefined) => !!s && /^\s*\[.*\]\s*$/s.test(s);

// ---------- Labels ----------

export const CATEGORY_LABEL: Record<TripCategory, string> = {
  trekking: 'Trekking',
  weekend_getaway: 'Weekend Getaway',
  adventure: 'Adventure',
  group_trip: 'Group Trip',
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  easy_moderate: 'Easy to moderate',
  moderate: 'Moderate',
  challenging: 'Challenging',
};
export const DIFFICULTY_LEVEL: Record<Difficulty, number> = { easy: 1, easy_moderate: 2, moderate: 3, challenging: 4 };
export const STATUS_LABEL: Record<TripStatus, string> = {
  open: 'Open',
  filling_fast: 'Filling fast',
  sold_out: 'Sold out',
  departed: 'Completed',
  dates_tba: 'Dates soon',
};
export const INCLUSION_LABEL: Record<InclusionKey, string> = {
  transport: 'Transportation',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  permit: 'Trek permit',
  trek_fee: 'Trek fee',
  guide: 'Trek guide',
  first_aid: 'First aid',
  stay: 'Stay',
  camping_gear: 'Camping gear',
  bonfire: 'Bonfire',
  photos: 'Trip photos',
  other: 'Other',
};
export const LEADER_ROLE_LABEL: Record<LeaderRole, string> = {
  founder: 'Founder',
  trek_leader: 'Trek Leader',
  coordinator: 'Adventure Coordinator',
};

// ---------- WhatsApp ----------

export function waLink(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function bookingWhatsAppMessage(b: Pick<Booking, 'ref' | 'tripTitle' | 'departureDate' | 'fullName' | 'phone' | 'email' | 'travellers' | 'emergencyName' | 'emergencyPhone' | 'notes' | 'unitPriceInr' | 'totalInr'>, pickup?: string): string {
  const lines = [
    `Hi JoinZipTrip! I'd like to book a trip.`,
    ``,
    `*Booking ref:* ${b.ref}`,
    `*Trip:* ${b.tripTitle}`,
    `*Date:* ${formatDateLong(b.departureDate)}`,
    pickup ? `*Pickup:* ${pickup}` : null,
    `*Travellers:* ${b.travellers}`,
    `*Total:* ${formatINR(b.totalInr)} (${formatINR(b.unitPriceInr)} × ${b.travellers})`,
    ``,
    `*Name:* ${b.fullName}`,
    `*Mobile:* +91 ${b.phone}`,
    `*Email:* ${b.email}`,
    `*Emergency contact:* ${b.emergencyName}, +91 ${b.emergencyPhone}`,
    b.notes ? `*Notes:* ${b.notes}` : null,
    ``,
    `Please share the payment details to confirm my seat.`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

export function contactWhatsAppMessage(c: { name: string; phone: string; topic: string; message: string }): string {
  const topic = { trip: 'Upcoming trip', group: 'Group booking', custom: 'Custom trip', other: 'Question' }[c.topic] ?? c.topic;
  return `Hi JoinZipTrip!\n\n*Name:* ${c.name}\n*Mobile:* +91 ${c.phone}\n*About:* ${topic}\n\n${c.message}`;
}

export function tripEnquiryMessage(trip: Pick<Trip, 'title' | 'departureDate'>): string {
  return `Hi JoinZipTrip! I'm interested in *${trip.title}*${trip.departureDate ? ` on ${formatDate(trip.departureDate)}` : ''}. Could you share the details?`;
}

// ---------- CSV ----------

export function bookingsToCsv(rows: Booking[]): string {
  const head = ['Ref', 'Trip', 'Date', 'Name', 'Mobile', 'Email', 'Travellers', 'Unit price', 'Total', 'Status', 'Payment', 'Emergency name', 'Emergency mobile', 'Notes', 'Created'];
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((b) => [b.ref, b.tripTitle, b.departureDate, b.fullName, b.phone, b.email, b.travellers, b.unitPriceInr, b.totalInr, b.status, b.paymentStatus, b.emergencyName, b.emergencyPhone, b.notes, b.createdAt].map(esc).join(','));
  return [head.join(','), ...body].join('\n');
}

// ---------- Settings defaults ----------

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: 'JoinZipTrip',
  phones: ['8073271501', '8660840458'],
  whatsappNumber: '918073271501',
  instagramHandle: 'joinziptrip',
  email: 'hello@joinziptrip.com',
  googleReviewsUrl: null,
  baseCity: 'Mysuru',
};

// ---------- Roles & permissions ----------

export const PERMISSIONS = [
  'trips:write', 'trips:delete', 'bookings:read', 'bookings:write', 'bookings:export',
  'leaders:write', 'gallery:write', 'reviews:moderate', 'messages:read', 'settings:write', 'users:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  manager: ['trips:write', 'bookings:read', 'bookings:write', 'bookings:export', 'leaders:write', 'gallery:write', 'reviews:moderate', 'messages:read'],
  // Editors manage content only and never see customer personal data.
  editor: ['trips:write', 'leaders:write', 'gallery:write', 'reviews:moderate'],
};
export const can = (role: AdminRole | undefined | null, p: Permission) => !!role && ROLE_PERMISSIONS[role].includes(p);
export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Owner', manager: 'Manager', editor: 'Content editor' };
