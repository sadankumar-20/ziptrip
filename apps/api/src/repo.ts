import type {
  Trip, TripView, Leader, Booking, Review, Album, ContactMessage, SiteSettings, AdminUser, PassportStamp,
  TripInput, LeaderInput, AlbumInput, BookingUpdate, ReviewModeration, BookingStatus,
} from '@jzt/shared';
import { toTripView, DEFAULT_SETTINGS, tripInputSchema, leaderInputSchema, albumInputSchema } from '@jzt/shared';
import type { Db, Queryable } from './db';

// ---------- value helpers ----------
const d = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};
const ts = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const time = (v: unknown): string | null => (v == null ? null : String(v).slice(0, 5));
const j = (v: unknown) => JSON.stringify(v ?? []);

// ---------- trips ----------
const TRIP_SELECT = `
  select t.*, coalesce(u.seats_booked, 0) as seats_booked,
         coalesce((select json_agg(tl.leader_id order by tl.position) from trip_leaders tl where tl.trip_id = t.id), '[]'::json) as leader_ids
  from trips t left join trip_seat_usage u on u.trip_id = t.id`;

function rowToTrip(r: any): TripView {
  const trip: Trip = {
    id: r.id, slug: r.slug, title: r.title, destination: r.destination, region: r.region, category: r.category,
    summary: r.summary, description: r.description, highlights: r.highlights, difficulty: r.difficulty,
    distanceLabel: r.distance_label, trekDurationLabel: r.trek_duration_label, altitudeM: r.altitude_m,
    ageGroup: r.age_group, fitness: r.fitness, pickupPoint: r.pickup_point, pickupCity: r.pickup_city,
    pickupTime: r.pickup_time, returnSchedule: r.return_schedule, departureDate: d(r.departure_date),
    departureTime: time(r.departure_time), durationDays: r.duration_days, durationLabel: r.duration_label,
    priceInr: r.price_inr, seatsTotal: r.seats_total, statusMode: r.status_mode, isFeatured: r.is_featured,
    isPublished: r.is_published, isDemo: r.is_demo, coverImage: r.cover_image, gallery: r.gallery,
    itinerary: r.itinerary, inclusions: r.inclusions, exclusions: r.exclusions, thingsToCarry: r.things_to_carry,
    safety: r.safety, cancellationPolicy: r.cancellation_policy, bookingTerms: r.booking_terms, faqs: r.faqs,
    elevation: r.elevation, leaderIds: (r.leader_ids ?? []).map(String), createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
  };
  return toTripView(trip, Number(r.seats_booked ?? 0));
}

export async function listTrips(db: Queryable, opts: { publishedOnly: boolean }): Promise<TripView[]> {
  const where = opts.publishedOnly ? 'where t.is_published' : '';
  const { rows } = await db.query(`${TRIP_SELECT} ${where} order by t.departure_date asc nulls last, t.created_at desc`);
  return rows.map(rowToTrip);
}
export async function getTripBySlug(db: Queryable, slug: string, publishedOnly = true): Promise<TripView | null> {
  const { rows } = await db.query(`${TRIP_SELECT} where t.slug = $1 ${publishedOnly ? 'and t.is_published' : ''}`, [slug]);
  return rows[0] ? rowToTrip(rows[0]) : null;
}
export async function getTripById(db: Queryable, id: string): Promise<TripView | null> {
  const { rows } = await db.query(`${TRIP_SELECT} where t.id = $1`, [id]);
  return rows[0] ? rowToTrip(rows[0]) : null;
}

const TRIP_COLUMNS = [
  'slug', 'title', 'destination', 'region', 'category', 'summary', 'description', 'highlights', 'difficulty',
  'distance_label', 'trek_duration_label', 'altitude_m', 'age_group', 'fitness', 'pickup_point', 'pickup_city',
  'pickup_time', 'return_schedule', 'departure_date', 'departure_time', 'duration_days', 'duration_label',
  'price_inr', 'seats_total', 'status_mode', 'is_featured', 'is_published', 'is_demo', 'cover_image', 'gallery',
  'itinerary', 'inclusions', 'exclusions', 'things_to_carry', 'safety', 'cancellation_policy', 'booking_terms',
  'faqs', 'elevation',
] as const;

function tripValues(t: ReturnType<typeof tripInputSchema.parse>) {
  return [
    t.slug, t.title, t.destination, t.region, t.category, t.summary, t.description, j(t.highlights), t.difficulty,
    t.distanceLabel, t.trekDurationLabel, t.altitudeM, t.ageGroup, t.fitness, t.pickupPoint, t.pickupCity,
    t.pickupTime, t.returnSchedule, t.departureDate, t.departureTime, t.durationDays, t.durationLabel,
    t.priceInr, t.seatsTotal, t.statusMode, t.isFeatured, t.isPublished, t.isDemo, JSON.stringify(t.coverImage), j(t.gallery),
    j(t.itinerary), j(t.inclusions), j(t.exclusions), j(t.thingsToCarry), j(t.safety), j(t.cancellationPolicy), j(t.bookingTerms),
    j(t.faqs), j(t.elevation),
  ];
}

async function setTripLeaders(q: Queryable, tripId: string, leaderIds: string[]) {
  await q.query('delete from trip_leaders where trip_id = $1', [tripId]);
  for (const [i, lid] of leaderIds.entries()) {
    await q.query('insert into trip_leaders (trip_id, leader_id, position) values ($1, $2, $3) on conflict do nothing', [tripId, lid, i]);
  }
}

export async function saveTrip(db: Db, input: TripInput, id?: string, forceId?: string): Promise<TripView> {
  const t = tripInputSchema.parse(input);
  const vals = tripValues(t);
  const tripId = await db.tx(async (q) => {
    let rowId: string;
    if (id) {
      const sets = TRIP_COLUMNS.map((c, i) => `${c} = $${i + 2}`).join(', ');
      const { rows } = await q.query(`update trips set ${sets} where id = $1 returning id`, [id, ...vals]);
      if (!rows[0]) throw Object.assign(new Error('Trip not found'), { status: 404 });
      rowId = rows[0].id;
    } else {
      const cols = forceId ? ['id', ...TRIP_COLUMNS] : [...TRIP_COLUMNS];
      const params = forceId ? [forceId, ...vals] : vals;
      const { rows } = await q.query(
        `insert into trips (${cols.join(', ')}) values (${params.map((_, i) => `$${i + 1}`).join(', ')}) returning id`, params);
      rowId = rows[0].id;
    }
    await setTripLeaders(q, rowId, t.leaderIds);
    return rowId;
  });
  return (await getTripById(db, tripId))!;
}

export async function patchTrip(db: Queryable, id: string, patch: Partial<Pick<Trip, 'statusMode' | 'isPublished' | 'isFeatured' | 'seatsTotal' | 'priceInr'>>) {
  const map: Record<string, string> = { statusMode: 'status_mode', isPublished: 'is_published', isFeatured: 'is_featured', seatsTotal: 'seats_total', priceInr: 'price_inr' };
  const keys = Object.keys(patch).filter((k) => k in map);
  if (!keys.length) return getTripById(db, id);
  const sets = keys.map((k, i) => `${map[k]} = $${i + 2}`).join(', ');
  await db.query(`update trips set ${sets} where id = $1`, [id, ...keys.map((k) => (patch as any)[k])]);
  return getTripById(db, id);
}

export async function deleteTrip(db: Queryable, id: string): Promise<'deleted' | 'has_bookings' | 'not_found'> {
  const { rows } = await db.query('select count(*)::int as n from bookings where trip_id = $1', [id]);
  if (rows[0].n > 0) return 'has_bookings';
  const r = await db.query('delete from trips where id = $1 returning id', [id]);
  return r.rows[0] ? 'deleted' : 'not_found';
}

// ---------- leaders ----------
function rowToLeader(r: any): Leader {
  return {
    id: r.id, slug: r.slug, name: r.name, role: r.role, photoUrl: r.photo_url, intro: r.intro, story: r.story,
    philosophy: r.philosophy, yearsExperience: r.years_experience, tripsLed: r.trips_led, destinations: r.destinations,
    specializations: r.specializations, languages: r.languages, instagram: r.instagram, isPublished: r.is_published,
    isDemo: r.is_demo, sortOrder: r.sort_order,
  };
}
export async function listLeaders(db: Queryable, publishedOnly: boolean): Promise<Leader[]> {
  const { rows } = await db.query(`select * from leaders ${publishedOnly ? 'where is_published' : ''} order by sort_order, name`);
  return rows.map(rowToLeader);
}
export async function getLeaderBySlug(db: Queryable, slug: string): Promise<Leader | null> {
  const { rows } = await db.query('select * from leaders where slug = $1 and is_published', [slug]);
  return rows[0] ? rowToLeader(rows[0]) : null;
}
export async function saveLeader(db: Queryable, input: LeaderInput, id?: string, forceId?: string): Promise<Leader> {
  const l = leaderInputSchema.parse(input);
  const cols = ['slug', 'name', 'role', 'photo_url', 'intro', 'story', 'philosophy', 'years_experience', 'trips_led', 'destinations', 'specializations', 'languages', 'instagram', 'is_published', 'is_demo', 'sort_order'];
  const vals = [l.slug, l.name, l.role, l.photoUrl, l.intro, l.story, l.philosophy, l.yearsExperience, l.tripsLed, j(l.destinations), j(l.specializations), j(l.languages), l.instagram, l.isPublished, l.isDemo, l.sortOrder];
  if (id) {
    const { rows } = await db.query(`update leaders set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1 returning *`, [id, ...vals]);
    if (!rows[0]) throw Object.assign(new Error('Leader not found'), { status: 404 });
    return rowToLeader(rows[0]);
  }
  const c2 = forceId ? ['id', ...cols] : cols;
  const v2 = forceId ? [forceId, ...vals] : vals;
  const { rows } = await db.query(`insert into leaders (${c2.join(', ')}) values (${v2.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, v2);
  return rowToLeader(rows[0]);
}
export async function deleteLeader(db: Queryable, id: string) {
  const r = await db.query('delete from leaders where id = $1 returning id', [id]);
  return !!r.rows[0];
}

// ---------- bookings ----------
const BOOKING_SELECT = `select b.*, t.title as trip_title, t.slug as trip_slug from bookings b join trips t on t.id = b.trip_id`;
function rowToBooking(r: any): Booking {
  return {
    id: r.id, ref: r.ref, tripId: r.trip_id, tripTitle: r.trip_title, tripSlug: r.trip_slug, departureDate: d(r.departure_date),
    fullName: r.full_name, phone: r.phone, email: r.email, travellers: r.travellers, emergencyName: r.emergency_name,
    emergencyPhone: r.emergency_phone, notes: r.notes, unitPriceInr: r.unit_price_inr, totalInr: r.total_inr,
    status: r.status, paymentStatus: r.payment_status, channel: r.channel, adminNotes: r.admin_notes,
    createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
  };
}
export async function createBooking(db: Queryable, args: {
  tripSlug: string; ref: string; fullName: string; phone: string; email: string; travellers: number;
  emergencyName: string; emergencyPhone: string; notes: string; channel?: 'whatsapp' | 'razorpay';
}): Promise<Booking> {
  const { rows } = await db.query<{ id: string }>(
    'select id from create_booking($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [args.tripSlug, args.ref, args.fullName, args.phone, args.email, args.travellers, args.emergencyName, args.emergencyPhone, args.notes, args.channel ?? 'whatsapp'],
  );
  return (await getBooking(db, rows[0].id))!;
}
export async function getBooking(db: Queryable, id: string): Promise<Booking | null> {
  const { rows } = await db.query(`${BOOKING_SELECT} where b.id = $1`, [id]);
  return rows[0] ? rowToBooking(rows[0]) : null;
}
export async function getBookingByRef(db: Queryable, ref: string): Promise<Booking | null> {
  const { rows } = await db.query(`${BOOKING_SELECT} where b.ref = $1`, [ref]);
  return rows[0] ? rowToBooking(rows[0]) : null;
}
export async function listBookings(db: Queryable, f: { tripId?: string; status?: string; q?: string }): Promise<Booking[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.tripId) { params.push(f.tripId); where.push(`b.trip_id = $${params.length}`); }
  if (f.status) { params.push(f.status); where.push(`b.status = $${params.length}::booking_status`); }
  if (f.q) {
    params.push(`%${f.q.toLowerCase()}%`);
    where.push(`(lower(b.full_name) like $${params.length} or b.phone like $${params.length} or lower(b.ref) like $${params.length} or lower(b.email) like $${params.length})`);
  }
  const { rows } = await db.query(`${BOOKING_SELECT} ${where.length ? 'where ' + where.join(' and ') : ''} order by b.created_at desc limit 2000`, params);
  return rows.map(rowToBooking);
}
export async function updateBooking(db: Queryable, id: string, u: BookingUpdate): Promise<Booking | null> {
  if (u.status) await db.query('select id from set_booking_status($1, $2)', [id, u.status]);
  if (u.paymentStatus !== undefined || u.adminNotes !== undefined) {
    await db.query(
      `update bookings set payment_status = coalesce($2::payment_status, payment_status), admin_notes = coalesce($3, admin_notes) where id = $1`,
      [id, u.paymentStatus ?? null, u.adminNotes ?? null],
    );
  }
  return getBooking(db, id);
}
export async function setBookingStatus(db: Queryable, id: string, status: BookingStatus) {
  await db.query('select id from set_booking_status($1, $2)', [id, status]);
}

export async function passportStamps(db: Queryable, phone: string, ref: string): Promise<PassportStamp[] | null> {
  const own = await db.query('select 1 from bookings where phone = $1 and ref = $2', [phone, ref]);
  if (!own.rows[0]) return null;
  const { rows } = await db.query(
    `select b.ref, b.status, b.departure_date, t.title, t.destination, t.region, t.altitude_m, t.departure_time
       from bookings b join trips t on t.id = b.trip_id
      where b.phone = $1 and b.status in ('confirmed', 'completed')
      order by b.departure_date desc nulls last`, [phone]);
  const now = Date.now();
  return rows.map((r: any) => {
    const date = d(r.departure_date);
    const dep = date ? new Date(`${date}T${time(r.departure_time) ?? '00:00'}:00+05:30`).getTime() : Infinity;
    return {
      tripTitle: r.title, destination: r.destination, region: r.region, date, altitudeM: r.altitude_m, bookingRef: r.ref,
      state: r.status === 'completed' || dep < now ? 'completed' : 'upcoming',
    } satisfies PassportStamp;
  });
}

// ---------- reviews ----------
function rowToReview(r: any): Review {
  return {
    id: r.id, tripId: r.trip_id, tripName: r.trip_name, name: r.name, photoUrl: r.photo_url, rating: r.rating, body: r.body,
    experienceDate: d(r.experience_date), status: r.status, isFeatured: r.is_featured, isVerified: r.is_verified,
    isDemo: r.is_demo, source: r.source, createdAt: ts(r.created_at),
  };
}
export async function listReviews(db: Queryable, opts: { approvedOnly: boolean; status?: string }): Promise<Review[]> {
  const params: unknown[] = [];
  let where = '';
  if (opts.approvedOnly) where = `where status = 'approved'`;
  else if (opts.status) { params.push(opts.status); where = `where status = $1::review_status`; }
  const { rows } = await db.query(`select * from reviews ${where} order by is_featured desc, created_at desc`, params);
  return rows.map(rowToReview);
}
export async function createReview(db: Queryable, r: {
  name: string; tripName: string; tripId?: string | null; rating: number; body: string; experienceDate?: string | null;
  bookingRef?: string; photoUrl?: string | null; source?: Review['source']; status?: Review['status'];
}): Promise<Review> {
  let verified = false;
  let tripId = r.tripId ?? null;
  if (r.bookingRef) {
    const b = await db.query(`select trip_id from bookings where ref = $1 and status = 'completed'`, [r.bookingRef.toUpperCase()]);
    if (b.rows[0]) { verified = true; tripId = b.rows[0].trip_id; }
  }
  const { rows } = await db.query(
    `insert into reviews (trip_id, trip_name, name, photo_url, rating, body, experience_date, status, is_verified, source, booking_ref)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [tripId, r.tripName, r.name, r.photoUrl ?? null, r.rating, r.body, r.experienceDate ?? null, r.status ?? 'pending', verified, r.source ?? 'website', r.bookingRef || null],
  );
  return rowToReview(rows[0]);
}
export async function moderateReview(db: Queryable, id: string, m: ReviewModeration): Promise<Review | null> {
  const { rows } = await db.query(
    `update reviews set status = coalesce($2::review_status, status), is_featured = coalesce($3, is_featured) where id = $1 returning *`,
    [id, m.status ?? null, m.isFeatured ?? null]);
  return rows[0] ? rowToReview(rows[0]) : null;
}
export async function deleteReview(db: Queryable, id: string) {
  return !!(await db.query('delete from reviews where id = $1 returning id', [id])).rows[0];
}

// ---------- albums ----------
function rowToAlbum(r: any): Album {
  return {
    id: r.id, slug: r.slug, title: r.title, location: r.location, tripDate: d(r.trip_date), tripId: r.trip_id, leaderId: r.leader_id,
    participants: r.participants, story: r.story, coverUrl: r.cover_url, media: r.media, isPublished: r.is_published,
    isDemo: r.is_demo, createdAt: ts(r.created_at),
  };
}
export async function listAlbums(db: Queryable, publishedOnly: boolean): Promise<Album[]> {
  const { rows } = await db.query(`select * from albums ${publishedOnly ? 'where is_published' : ''} order by trip_date desc nulls last, created_at desc`);
  return rows.map(rowToAlbum);
}
export async function getAlbumBySlug(db: Queryable, slug: string): Promise<Album | null> {
  const { rows } = await db.query('select * from albums where slug = $1 and is_published', [slug]);
  return rows[0] ? rowToAlbum(rows[0]) : null;
}
export async function saveAlbum(db: Queryable, input: AlbumInput, id?: string): Promise<Album> {
  const a = albumInputSchema.parse(input);
  const cols = ['slug', 'title', 'location', 'trip_date', 'trip_id', 'leader_id', 'participants', 'story', 'cover_url', 'media', 'is_published', 'is_demo'];
  const vals = [a.slug, a.title, a.location, a.tripDate, a.tripId, a.leaderId, a.participants, a.story, a.coverUrl, j(a.media), a.isPublished, a.isDemo];
  if (id) {
    const { rows } = await db.query(`update albums set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1 returning *`, [id, ...vals]);
    if (!rows[0]) throw Object.assign(new Error('Album not found'), { status: 404 });
    return rowToAlbum(rows[0]);
  }
  const { rows } = await db.query(`insert into albums (${cols.join(', ')}) values (${vals.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, vals);
  return rowToAlbum(rows[0]);
}
export async function deleteAlbum(db: Queryable, id: string) {
  return !!(await db.query('delete from albums where id = $1 returning id', [id])).rows[0];
}

// ---------- contact messages ----------
function rowToMessage(r: any): ContactMessage {
  return { id: r.id, name: r.name, phone: r.phone, email: r.email, topic: r.topic, message: r.message, handled: r.handled, createdAt: ts(r.created_at) };
}
export async function createMessage(db: Queryable, m: Omit<ContactMessage, 'id' | 'handled' | 'createdAt'>) {
  const { rows } = await db.query('insert into contact_messages (name, phone, email, topic, message) values ($1, $2, $3, $4, $5) returning *', [m.name, m.phone, m.email, m.topic, m.message]);
  return rowToMessage(rows[0]);
}
export async function listMessages(db: Queryable) {
  const { rows } = await db.query('select * from contact_messages order by handled, created_at desc limit 500');
  return rows.map(rowToMessage);
}
export async function setMessageHandled(db: Queryable, id: string, handled: boolean) {
  const { rows } = await db.query('update contact_messages set handled = $2 where id = $1 returning *', [id, handled]);
  return rows[0] ? rowToMessage(rows[0]) : null;
}

// ---------- settings ----------
export async function getSettings(db: Queryable): Promise<SiteSettings> {
  const { rows } = await db.query(`select value from settings where key = 'site'`);
  return { ...DEFAULT_SETTINGS, ...(rows[0]?.value ?? {}) };
}
export async function saveSettings(db: Queryable, s: SiteSettings) {
  await db.query(`insert into settings (key, value) values ('site', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(s)]);
  return getSettings(db);
}

// ---------- admin users ----------
export function rowToAdmin(r: any): AdminUser {
  return { id: r.id, email: r.email, name: r.name, role: r.role, isActive: r.is_active, lastLoginAt: r.last_login_at ? ts(r.last_login_at) : null };
}
export async function listAdmins(db: Queryable) {
  const { rows } = await db.query('select * from admin_users order by created_at');
  return rows.map(rowToAdmin);
}

export async function audit(db: Queryable, actorId: string | null, action: string, entity: string, entityId?: string, detail: object = {}) {
  try {
    await db.query('insert into audit_log (actor_id, action, entity, entity_id, detail) values ($1, $2, $3, $4, $5)', [actorId, action, entity, entityId ?? null, JSON.stringify(detail)]);
  } catch {
    /* auditing must never break the request */
  }
}

export async function overview(db: Queryable) {
  const trips = (await listTrips(db, { publishedOnly: false })).filter((t) => t.status !== 'departed' && t.isPublished);
  const [{ rows: p }, { rows: c }, { rows: r }, { rows: m }] = await Promise.all([
    db.query(`select count(*)::int as n from bookings where status = 'pending'`),
    db.query(`select coalesce(sum(travellers), 0)::int as n from bookings b join trips t on t.id = b.trip_id where b.status = 'confirmed' and (t.departure_date is null or t.departure_date >= current_date)`),
    db.query(`select count(*)::int as n from reviews where status = 'pending'`),
    db.query(`select count(*)::int as n from contact_messages where not handled`),
  ]);
  const recent = await listBookings(db, {});
  return { upcoming: trips, pendingBookings: p[0].n, confirmedTravellers: c[0].n, pendingReviews: r[0].n, openMessages: m[0].n, recentBookings: recent.slice(0, 8) };
}
