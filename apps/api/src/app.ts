import express, { type Request, type Response, type NextFunction, Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import { z, ZodError } from 'zod';
import {
  bookingInputSchema, reviewInputSchema, contactInputSchema, passportLookupSchema, tripInputSchema, leaderInputSchema,
  albumInputSchema, bookingUpdateSchema, reviewModerationSchema, settingsSchema, loginSchema, adminUserInputSchema,
  makeBookingRef, bookingWhatsAppMessage, contactWhatsAppMessage, waLink, bookingsToCsv, STATUS_MODES,
} from '@jzt/shared';
import type { Db } from './db';
import { isUniqueViolation, sqlErrorCode } from './db';
import type { Env } from './env';
import * as repo from './repo';
import { COOKIE, cookieOptions, login, requireAuth, requirePermission, requireCsrfHeader, hashPassword } from './auth';
import { type Storage, MAX_UPLOAD_BYTES, validateUpload } from './storage';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from './payments';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const BOOKING_ERRORS: Record<string, (d?: string) => [number, string]> = {
  TRIP_NOT_FOUND: () => [404, "We couldn't find that trip. It may have been unpublished."],
  TRIP_NOT_BOOKABLE: () => [409, "This trip isn't open for booking yet. Message us on WhatsApp to be notified."],
  TRIP_DEPARTED: () => [409, 'This trip has already departed.'],
  SOLD_OUT: () => [409, 'This trip is sold out. Message us on WhatsApp to join the waitlist.'],
  NOT_ENOUGH_SEATS: (d) => [409, d === '0' ? 'This trip is sold out.' : `Only ${d} seat${d === '1' ? '' : 's'} left. Reduce the number of travellers.`],
  BOOKING_NOT_FOUND: () => [404, 'Booking not found'],
};

export function createApp(deps: { db: Db; env: Env; storage: Storage }) {
  const { db, env, storage } = deps;
  const app = express();
  const origins = env.WEB_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: true }));

  // Razorpay webhook needs the raw body for its signature, so it's registered before the JSON parser.
  app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }), h(async (req, res) => {
    if (!env.PAYMENTS_ENABLED) return res.status(404).end();
    if (!verifyWebhookSignature(env, req.body as Buffer, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'Bad signature' });
    const event = JSON.parse((req.body as Buffer).toString('utf8'));
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const orderId = event.payload?.payment?.entity?.order_id;
      const paymentId = event.payload?.payment?.entity?.id;
      if (orderId) await markPaid(orderId, paymentId);
    }
    res.json({ ok: true });
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.STORAGE_DRIVER === 'local') app.use('/uploads', express.static(path.resolve(env.LOCAL_UPLOAD_DIR), { maxAge: '7d' }));

  const skip = () => env.NODE_ENV === 'test';
  const publicWriteLimit = rateLimit({ skip, windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please wait a few minutes and try again.' } });
  const loginLimit = rateLimit({ skip, windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });
  const lookupLimit = rateLimit({ skip, windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many lookups. Try again later.' } });

  async function markPaid(orderId: string, paymentId?: string) {
    const { rows } = await db.query(
      `update bookings set payment_status = 'paid', razorpay_payment_id = coalesce($2, razorpay_payment_id) where razorpay_order_id = $1 returning id, status`, [orderId, paymentId ?? null]);
    const b = rows[0];
    if (b && b.status === 'pending') {
      try {
        await repo.setBookingStatus(db, b.id, 'confirmed');
      } catch (e) {
        // Paid but no seats left (rare race). Keep it pending and flag it for a refund or a seat.
        await db.query(`update bookings set admin_notes = admin_notes || $2 where id = $1`, [b.id, '\n[Auto] Paid, but the trip was full when payment arrived. Contact the traveller.']);
      }
    }
    return b;
  }

  // ------------------------------------------------------------ public
  const pub = Router();

  pub.get('/health', h(async (_req, res) => {
    await db.query('select 1');
    res.json({ ok: true });
  }));

  pub.get('/settings', h(async (_req, res) => {
    const s = await repo.getSettings(db);
    res.set('Cache-Control', 'public, max-age=60').json({ ...s, paymentsEnabled: env.PAYMENTS_ENABLED, razorpayKeyId: env.PAYMENTS_ENABLED ? env.RAZORPAY_KEY_ID : null });
  }));

  pub.get('/trips', h(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=30').json(await repo.listTrips(db, { publishedOnly: true }));
  }));
  pub.get('/trips/:slug', h(async (req, res) => {
    const t = await repo.getTripBySlug(db, req.params.slug);
    if (!t) return res.status(404).json({ error: 'Trip not found' });
    res.set('Cache-Control', 'public, max-age=30').json(t);
  }));
  pub.get('/leaders', h(async (_req, res) => res.json(await repo.listLeaders(db, true))));
  pub.get('/leaders/:slug', h(async (req, res) => {
    const l = await repo.getLeaderBySlug(db, req.params.slug);
    if (!l) return res.status(404).json({ error: 'Profile not found' });
    res.json(l);
  }));
  pub.get('/reviews', h(async (_req, res) => res.json(await repo.listReviews(db, { approvedOnly: true }))));
  pub.get('/albums', h(async (_req, res) => res.json(await repo.listAlbums(db, true))));
  pub.get('/albums/:slug', h(async (req, res) => {
    const a = await repo.getAlbumBySlug(db, req.params.slug);
    if (!a) return res.status(404).json({ error: 'Album not found' });
    res.json(a);
  }));

  pub.post('/bookings', publicWriteLimit, h(async (req, res) => {
    const input = bookingInputSchema.parse(req.body);
    if (input.website) return res.status(201).json({ ok: true }); // honeypot: pretend success
    const trip = await repo.getTripBySlug(db, input.tripSlug);
    let booking;
    for (let attempt = 0; attempt < 4 && !booking; attempt++) {
      try {
        booking = await repo.createBooking(db, { ...input, ref: makeBookingRef() });
      } catch (e) {
        if (isUniqueViolation(e)) continue; // ref collision, try another
        throw e;
      }
    }
    if (!booking) throw new Error('Could not allocate a booking reference');
    const settings = await repo.getSettings(db);
    const message = bookingWhatsAppMessage(booking, trip ? `${trip.pickupTime}, ${trip.pickupPoint}` : undefined);
    res.status(201).json({ booking, whatsappUrl: waLink(settings.whatsappNumber, message), message });
  }));

  pub.post('/reviews', publicWriteLimit, h(async (req, res) => {
    const input = reviewInputSchema.parse(req.body);
    if (input.website) return res.status(201).json({ ok: true });
    await repo.createReview(db, { ...input, status: 'pending', source: 'website' });
    res.status(201).json({ ok: true });
  }));

  pub.post('/contact', publicWriteLimit, h(async (req, res) => {
    const input = contactInputSchema.parse(req.body);
    if (input.website) return res.status(201).json({ ok: true });
    await repo.createMessage(db, { name: input.name, phone: input.phone, email: input.email, topic: input.topic, message: input.message });
    const settings = await repo.getSettings(db);
    res.status(201).json({ ok: true, whatsappUrl: waLink(settings.whatsappNumber, contactWhatsAppMessage(input)) });
  }));

  pub.post('/passport', lookupLimit, h(async (req, res) => {
    const { phone, ref } = passportLookupSchema.parse(req.body);
    const stamps = await repo.passportStamps(db, phone, ref);
    if (!stamps) return res.status(404).json({ error: "We couldn't match that mobile number and booking reference." });
    res.json({ stamps });
  }));

  // Razorpay: create an order for an existing pending booking, then verify the payment.
  pub.post('/payments/razorpay/order', publicWriteLimit, h(async (req, res) => {
    if (!env.PAYMENTS_ENABLED) return res.status(501).json({ error: 'Online payment is not available yet. Book on WhatsApp.' });
    const { ref, phone } = z.object({ ref: z.string(), phone: z.string() }).parse(req.body);
    const b = await repo.getBookingByRef(db, ref.toUpperCase());
    if (!b || b.phone !== phone.slice(-10)) return res.status(404).json({ error: 'Booking not found' });
    if (b.paymentStatus === 'paid') return res.status(409).json({ error: 'This booking is already paid' });
    const order = await createRazorpayOrder(env, b.totalInr, b.ref);
    await db.query(`update bookings set razorpay_order_id = $2, channel = 'razorpay' where id = $1`, [b.id, order.id]);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID, ref: b.ref, name: b.fullName, email: b.email, phone: b.phone });
  }));
  pub.post('/payments/razorpay/verify', publicWriteLimit, h(async (req, res) => {
    if (!env.PAYMENTS_ENABLED) return res.status(501).json({ error: 'Online payment is not available yet.' });
    const p = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).parse(req.body);
    if (!verifyPaymentSignature(env, p.razorpay_order_id, p.razorpay_payment_id, p.razorpay_signature)) return res.status(400).json({ error: 'Payment could not be verified' });
    const b = await markPaid(p.razorpay_order_id, p.razorpay_payment_id);
    if (!b) return res.status(404).json({ error: 'Order not found' });
    res.json({ ok: true });
  }));

  app.use('/api', pub);

  // Search engines read this; the frontend rewrites /sitemap.xml here (see apps/web/vercel.json).
  app.get(['/sitemap.xml', '/api/sitemap.xml'], h(async (req, res) => {
    const site = (env.WEB_ORIGIN.split(',')[0] || '').replace(/\/$/, '');
    const [trips, leaders, albums] = await Promise.all([repo.listTrips(db, { publishedOnly: true }), repo.listLeaders(db, true), repo.listAlbums(db, true)]);
    const paths = ['/', '/trips', '/past-adventures', '/tribe', '/leaders', '/reviews', '/about', '/contact',
      ...trips.filter((t) => !t.isDemo).map((t) => `/trips/${t.slug}`),
      ...leaders.filter((l) => !l.isDemo).map((l) => `/leaders/${l.slug}`),
      ...albums.filter((a) => !a.isDemo).map((a) => `/past-adventures/${a.slug}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')}\n</urlset>`;
    res.set('Content-Type', 'application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
  }));

  // ------------------------------------------------------------ admin
  const admin = Router();
  admin.use(requireCsrfHeader);

  admin.post('/auth/login', loginLimit, h(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await login(db, env, email, password);
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    await repo.audit(db, result.user.id, 'login', 'admin_user', result.user.id);
    res.cookie(COOKIE, result.token, cookieOptions(env)).json({ user: result.user });
  }));
  admin.post('/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, { ...cookieOptions(env), maxAge: undefined }).json({ ok: true });
  });

  admin.use(requireAuth(db, env));
  admin.get('/auth/me', (req, res) => res.json({ user: req.admin }));

  admin.get('/overview', h(async (req, res) => {
    const o = await repo.overview(db);
    // Editors don't see customer data.
    if (req.admin!.role === 'editor') o.recentBookings = [];
    res.json(o);
  }));

  // trips
  admin.get('/trips', h(async (_req, res) => res.json(await repo.listTrips(db, { publishedOnly: false }))));
  admin.get('/trips/:id', h(async (req, res) => {
    const t = await repo.getTripById(db, req.params.id);
    if (!t) return res.status(404).json({ error: 'Trip not found' });
    res.json(t);
  }));
  admin.post('/trips', requirePermission('trips:write'), h(async (req, res) => {
    const t = await repo.saveTrip(db, tripInputSchema.parse(req.body));
    await repo.audit(db, req.admin!.id, 'create', 'trip', t.id, { slug: t.slug });
    res.status(201).json(t);
  }));
  admin.put('/trips/:id', requirePermission('trips:write'), h(async (req, res) => {
    const t = await repo.saveTrip(db, tripInputSchema.parse(req.body), req.params.id);
    await repo.audit(db, req.admin!.id, 'update', 'trip', t.id);
    res.json(t);
  }));
  admin.patch('/trips/:id', requirePermission('trips:write'), h(async (req, res) => {
    const patch = z.object({
      statusMode: z.enum(STATUS_MODES).optional(), isPublished: z.boolean().optional(), isFeatured: z.boolean().optional(),
      seatsTotal: z.number().int().min(1).max(500).nullable().optional(), priceInr: z.number().int().min(0).nullable().optional(),
    }).parse(req.body);
    const t = await repo.patchTrip(db, req.params.id, patch);
    if (!t) return res.status(404).json({ error: 'Trip not found' });
    await repo.audit(db, req.admin!.id, 'patch', 'trip', t.id, patch);
    res.json(t);
  }));
  admin.delete('/trips/:id', requirePermission('trips:delete'), h(async (req, res) => {
    const r = await repo.deleteTrip(db, req.params.id);
    if (r === 'has_bookings') return res.status(409).json({ error: 'This trip has bookings, so it can’t be deleted. Unpublish it instead.' });
    if (r === 'not_found') return res.status(404).json({ error: 'Trip not found' });
    await repo.audit(db, req.admin!.id, 'delete', 'trip', req.params.id);
    res.json({ ok: true });
  }));

  // bookings
  admin.get('/bookings', requirePermission('bookings:read'), h(async (req, res) => {
    const q = z.object({ tripId: z.string().uuid().optional(), status: z.string().optional(), q: z.string().max(80).optional() }).parse(req.query);
    res.json(await repo.listBookings(db, q));
  }));
  admin.get('/bookings/export.csv', requirePermission('bookings:export'), h(async (req, res) => {
    const rows = await repo.listBookings(db, { tripId: (req.query.tripId as string) || undefined });
    await repo.audit(db, req.admin!.id, 'export', 'bookings', undefined, { count: rows.length });
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="joinziptrip-bookings-${new Date().toISOString().slice(0, 10)}.csv"`).send('﻿' + bookingsToCsv(rows));
  }));
  admin.patch('/bookings/:id', requirePermission('bookings:write'), h(async (req, res) => {
    const u = bookingUpdateSchema.parse(req.body);
    const b = await repo.updateBooking(db, req.params.id, u);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    await repo.audit(db, req.admin!.id, 'update', 'booking', b.id, u);
    res.json(b);
  }));

  // leaders
  admin.get('/leaders', h(async (_req, res) => res.json(await repo.listLeaders(db, false))));
  admin.post('/leaders', requirePermission('leaders:write'), h(async (req, res) => res.status(201).json(await repo.saveLeader(db, leaderInputSchema.parse(req.body)))));
  admin.put('/leaders/:id', requirePermission('leaders:write'), h(async (req, res) => res.json(await repo.saveLeader(db, leaderInputSchema.parse(req.body), req.params.id))));
  admin.delete('/leaders/:id', requirePermission('leaders:write'), h(async (req, res) => {
    if (!(await repo.deleteLeader(db, req.params.id))) return res.status(404).json({ error: 'Profile not found' });
    res.json({ ok: true });
  }));

  // albums / gallery
  admin.get('/albums', h(async (_req, res) => res.json(await repo.listAlbums(db, false))));
  admin.post('/albums', requirePermission('gallery:write'), h(async (req, res) => res.status(201).json(await repo.saveAlbum(db, albumInputSchema.parse(req.body)))));
  admin.put('/albums/:id', requirePermission('gallery:write'), h(async (req, res) => res.json(await repo.saveAlbum(db, albumInputSchema.parse(req.body), req.params.id))));
  admin.delete('/albums/:id', requirePermission('gallery:write'), h(async (req, res) => {
    if (!(await repo.deleteAlbum(db, req.params.id))) return res.status(404).json({ error: 'Album not found' });
    res.json({ ok: true });
  }));

  // reviews
  admin.get('/reviews', h(async (req, res) => res.json(await repo.listReviews(db, { approvedOnly: false, status: (req.query.status as string) || undefined }))));
  admin.post('/reviews', requirePermission('reviews:moderate'), h(async (req, res) => {
    const input = reviewInputSchema.extend({ source: z.enum(['google', 'instagram', 'admin']).default('admin') }).parse(req.body);
    res.status(201).json(await repo.createReview(db, { ...input, status: 'approved' }));
  }));
  admin.patch('/reviews/:id', requirePermission('reviews:moderate'), h(async (req, res) => {
    const r = await repo.moderateReview(db, req.params.id, reviewModerationSchema.parse(req.body));
    if (!r) return res.status(404).json({ error: 'Review not found' });
    res.json(r);
  }));
  admin.delete('/reviews/:id', requirePermission('reviews:moderate'), h(async (req, res) => {
    if (!(await repo.deleteReview(db, req.params.id))) return res.status(404).json({ error: 'Review not found' });
    res.json({ ok: true });
  }));

  // enquiries
  admin.get('/messages', requirePermission('messages:read'), h(async (_req, res) => res.json(await repo.listMessages(db))));
  admin.patch('/messages/:id', requirePermission('messages:read'), h(async (req, res) => {
    const m = await repo.setMessageHandled(db, req.params.id, z.object({ handled: z.boolean() }).parse(req.body).handled);
    if (!m) return res.status(404).json({ error: 'Message not found' });
    res.json(m);
  }));

  // settings
  admin.get('/settings', h(async (_req, res) => res.json(await repo.getSettings(db))));
  admin.put('/settings', requirePermission('settings:write'), h(async (req, res) => {
    const s = await repo.saveSettings(db, settingsSchema.parse(req.body));
    await repo.audit(db, req.admin!.id, 'update', 'settings');
    res.json(s);
  }));

  // team
  admin.get('/users', requirePermission('users:manage'), h(async (_req, res) => res.json(await repo.listAdmins(db))));
  admin.post('/users', requirePermission('users:manage'), h(async (req, res) => {
    const u = adminUserInputSchema.required({ password: true }).parse(req.body);
    const { rows } = await db.query('insert into admin_users (email, name, role, password_hash, is_active) values ($1, $2, $3, $4, $5) returning *', [u.email, u.name, u.role, await hashPassword(u.password!), u.isActive]);
    await repo.audit(db, req.admin!.id, 'create', 'admin_user', rows[0].id, { role: u.role });
    res.status(201).json(repo.rowToAdmin(rows[0]));
  }));
  admin.patch('/users/:id', requirePermission('users:manage'), h(async (req, res) => {
    const u = adminUserInputSchema.partial().parse(req.body);
    if ((u.role && u.role !== 'owner') || u.isActive === false) {
      const { rows } = await db.query(`select count(*)::int as n from admin_users where role = 'owner' and is_active and id <> $1`, [req.params.id]);
      const target = await db.query('select role from admin_users where id = $1', [req.params.id]);
      if (target.rows[0]?.role === 'owner' && rows[0].n === 0) return res.status(409).json({ error: 'Keep at least one active owner' });
    }
    const { rows } = await db.query(
      `update admin_users set name = coalesce($2, name), role = coalesce($3::admin_role, role), is_active = coalesce($4, is_active),
         password_hash = coalesce($5, password_hash),
         token_version = token_version + case when $4 = false or $5 is not null or $3 is not null then 1 else 0 end
       where id = $1 returning *`,
      [req.params.id, u.name ?? null, u.role ?? null, u.isActive ?? null, u.password ? await hashPassword(u.password) : null]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await repo.audit(db, req.admin!.id, 'update', 'admin_user', rows[0].id, { role: u.role, isActive: u.isActive, passwordReset: !!u.password });
    res.json(repo.rowToAdmin(rows[0]));
  }));

  // uploads
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  admin.post('/uploads', requirePermission('gallery:write'), upload.single('file'), h(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });
    const check = validateUpload(req.file);
    if (!check.ok) return res.status(415).json({ error: check.error });
    const folder = String(req.body.folder ?? 'misc');
    const out = await storage.put(folder, { buffer: req.file.buffer, mimetype: check.mime, originalname: req.file.originalname });
    await repo.audit(db, req.admin!.id, 'upload', 'media', undefined, { url: out.url });
    res.status(201).json(out);
  }));

  app.use('/api/admin', admin);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // ------------------------------------------------------------ errors
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Some details need fixing', fields: Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message])) });
    }
    const sql = sqlErrorCode(err);
    if (sql && BOOKING_ERRORS[sql.code]) {
      const [status, message] = BOOKING_ERRORS[sql.code](sql.detail);
      return res.status(status).json({ error: message, code: sql.code });
    }
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'That web address (slug) or email is already in use' });
    const status = (err as { status?: number }).status;
    if (status && status < 500) return res.status(status).json({ error: (err as Error).message });
    if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again, or message us on WhatsApp.' });
  });

  return app;
}
