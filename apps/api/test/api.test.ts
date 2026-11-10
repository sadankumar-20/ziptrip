import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import type { Db } from '../src/db';
import { createApp } from '../src/app';
import { loadEnv } from '../src/env';
import { hashPassword } from '../src/auth';
import { sniffMime } from '../src/storage';
import { verifyPaymentSignature } from '../src/payments';
import { seed } from '../scripts/seed-lib';
import { THADIYANDAMOL } from '@jzt/shared';

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');

let pg: PGlite;
let db: Db;
let app: ReturnType<typeof createApp>;
const env = loadEnv({
  NODE_ENV: 'test', DATABASE_URL: 'pglite://memory', JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  WEB_ORIGIN: 'http://localhost:5173', RAZORPAY_KEY_SECRET: 'rzp_secret',
});
const storage = { put: async () => ({ url: 'https://cdn.example/x.jpg', kind: 'image' as const }) };

async function signIn(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/admin/auth/login').set('x-jzt-csrf', '1').send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

const FUTURE_TRIP = {
  ...THADIYANDAMOL,
  slug: 'test-trek',
  title: 'Test Trek',
  departureDate: '2099-01-10',
  seatsTotal: 5,
  isDemo: false,
  isPublished: true,
  leaderIds: [],
};

const booking = (over: Record<string, unknown> = {}) => ({
  tripSlug: 'test-trek', fullName: 'Asha Rao', phone: '98450 12345', email: 'asha@example.com', travellers: 2,
  emergencyName: 'Ravi Rao', emergencyPhone: '9845012346', notes: 'Vegetarian', consent: true, ...over,
});

beforeAll(async () => {
  pg = new PGlite();
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  }
  db = {
    query: (t, p) => pg.query(t, p as any[]) as any,
    tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p as any[]) as any })) as any,
    close: () => pg.close(),
  };
  await seed(db);
  app = createApp({ db, env, storage });
  await db.query(`insert into admin_users (email, name, role, password_hash) values
    ('owner@jzt.test', 'Owner', 'owner', $1), ('editor@jzt.test', 'Editor', 'editor', $1)`, [await hashPassword('correct horse battery')]);
  const owner = await signIn('owner@jzt.test', 'correct horse battery');
  const res = await owner.post('/api/admin/trips').set('x-jzt-csrf', '1').send(FUTURE_TRIP);
  expect(res.status).toBe(201);
}, 60_000);

afterAll(async () => { await pg?.close(); });

describe('public catalogue', () => {
  it('lists only published trips and hides sample drafts', async () => {
    const res = await request(app).get('/api/trips');
    expect(res.status).toBe(200);
    const slugs = res.body.map((t: any) => t.slug);
    expect(slugs).toContain('thadiyandamol-trek');
    expect(slugs).toContain('test-trek');
    expect(slugs).not.toContain('sample-waterfall-trek');
  });

  it('returns Thadiyandamol with the poster details intact', async () => {
    const res = await request(app).get('/api/trips/thadiyandamol-trek');
    expect(res.body.priceInr).toBe(1699);
    expect(res.body.departureDate).toBe('2026-11-22');
    expect(res.body.departureTime).toBe('04:00');
    expect(res.body.pickupPoint).toMatch(/Mysuru Railway Station front gate/);
    expect(res.body.inclusions).toHaveLength(7);
    expect(res.body.leaderIds).toHaveLength(1);
  });
});

describe('bookings', () => {
  it('creates a booking priced by the server and returns a WhatsApp link', async () => {
    const res = await request(app).post('/api/bookings').send({ ...booking(), priceInr: 1, totalInr: 1 });
    expect(res.status).toBe(201);
    expect(res.body.booking.totalInr).toBe(1699 * 2);
    expect(res.body.booking.phone).toBe('9845012345');
    expect(res.body.booking.ref).toMatch(/^JZT-[A-Z0-9]{5}$/);
    expect(res.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/918073271501\?text=/);
    expect(decodeURIComponent(res.body.whatsappUrl)).toContain(res.body.booking.ref);
  });

  it('rejects invalid details with field messages', async () => {
    const res = await request(app).post('/api/bookings').send(booking({ phone: '12345', email: 'nope', consent: false }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['phone', 'email', 'consent']));
  });

  it('refuses bookings on sample trips', async () => {
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const trips = (await owner.get('/api/admin/trips')).body;
    const sample = trips.find((t: any) => t.slug === 'sample-waterfall-trek');
    await owner.patch(`/api/admin/trips/${sample.id}`).set('x-jzt-csrf', '1').send({ isPublished: true });
    const res = await request(app).post('/api/bookings').send(booking({ tripSlug: 'sample-waterfall-trek' }));
    expect(res.status).toBe(409);
  });

  it('enforces capacity on confirm and on new bookings', async () => {
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const a = await request(app).post('/api/bookings').send(booking({ travellers: 3, phone: '9000000101' }));
    const b = await request(app).post('/api/bookings').send(booking({ travellers: 2, phone: '9000000102' }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((await owner.patch(`/api/admin/bookings/${a.body.booking.id}`).set('x-jzt-csrf', '1').send({ status: 'confirmed' })).status).toBe(200);
    expect((await owner.patch(`/api/admin/bookings/${b.body.booking.id}`).set('x-jzt-csrf', '1').send({ status: 'confirmed' })).status).toBe(200);
    // 5 of 5 seats now confirmed
    const trip = (await request(app).get('/api/trips/test-trek')).body;
    expect(trip.seatsLeft).toBe(0);
    expect(trip.status).toBe('sold_out');
    const c = await request(app).post('/api/bookings').send(booking({ travellers: 1, phone: '9000000103' }));
    expect(c.status).toBe(409);
    // Freeing seats and over-asking gives a precise message
    await owner.patch(`/api/admin/bookings/${b.body.booking.id}`).set('x-jzt-csrf', '1').send({ status: 'cancelled' });
    const d = await request(app).post('/api/bookings').send(booking({ travellers: 3, phone: '9000000104' }));
    expect(d.status).toBe(409);
    expect(d.body.error).toBe('Only 2 seats left. Reduce the number of travellers.');
  });

  it('lets a traveller open their adventure passport with mobile + ref', async () => {
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const res = await request(app).post('/api/bookings').send(booking({ tripSlug: 'thadiyandamol-trek', phone: '9123456780', travellers: 1 }));
    await owner.patch(`/api/admin/bookings/${res.body.booking.id}`).set('x-jzt-csrf', '1').send({ status: 'completed' });
    const ok = await request(app).post('/api/passport').send({ phone: '9123456780', ref: res.body.booking.ref });
    expect(ok.status).toBe(200);
    expect(ok.body.stamps[0]).toMatchObject({ destination: 'Thadiyandamol', state: 'completed', altitudeM: 1748 });
    const bad = await request(app).post('/api/passport').send({ phone: '9123456781', ref: res.body.booking.ref });
    expect(bad.status).toBe(404);
  });
});

describe('admin security', () => {
  it('requires a session', async () => {
    expect((await request(app).get('/api/admin/trips')).status).toBe(401);
  });
  it('rejects wrong passwords without revealing which part was wrong', async () => {
    const res = await request(app).post('/api/admin/auth/login').set('x-jzt-csrf', '1').send({ email: 'nobody@jzt.test', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email or password is incorrect');
  });
  it('sets an httpOnly, SameSite=Strict cookie', async () => {
    const res = await request(app).post('/api/admin/auth/login').set('x-jzt-csrf', '1').send({ email: 'owner@jzt.test', password: 'correct horse battery' });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });
  it('blocks state changes without the CSRF header', async () => {
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    expect((await owner.post('/api/admin/trips').send(FUTURE_TRIP)).status).toBe(403);
  });
  it('keeps customer data away from content editors', async () => {
    const editor = await signIn('editor@jzt.test', 'correct horse battery');
    expect((await editor.get('/api/admin/bookings')).status).toBe(403);
    expect((await editor.get('/api/admin/bookings/export.csv')).status).toBe(403);
    expect((await editor.get('/api/admin/overview')).body.recentBookings).toEqual([]);
    expect((await editor.delete('/api/admin/trips/00000000-0000-0000-0000-000000000000').set('x-jzt-csrf', '1')).status).toBe(403);
  });
  it('will not delete a trip that has bookings', async () => {
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const res = await owner.delete(`/api/admin/trips/${THADIYANDAMOL.id}`).set('x-jzt-csrf', '1');
    expect(res.status).toBe(409);
  });
  it('exports bookings as CSV with formula injection neutralised', async () => {
    await request(app).post('/api/bookings').send(booking({ tripSlug: 'thadiyandamol-trek', fullName: '=HYPERLINK("x")', phone: '9000000200', travellers: 1 }));
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const res = await owner.get('/api/admin/bookings/export.csv');
    expect(res.status).toBe(200);
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('reviews', () => {
  it('holds new reviews for approval', async () => {
    const before = (await request(app).get('/api/reviews')).body.length;
    const res = await request(app).post('/api/reviews').send({ name: 'Kiran', tripName: 'Thadiyandamol Trek', rating: 5, body: 'Loved the sunrise and the people on this trek.' });
    expect(res.status).toBe(201);
    expect((await request(app).get('/api/reviews')).body.length).toBe(before);
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const pending = (await owner.get('/api/admin/reviews?status=pending')).body;
    await owner.patch(`/api/admin/reviews/${pending[0].id}`).set('x-jzt-csrf', '1').send({ status: 'approved' });
    const after = (await request(app).get('/api/reviews')).body;
    expect(after.length).toBe(before + 1);
    expect(after[0].isVerified).toBe(false);
  });
});

describe('uploads and payments', () => {
  it('sniffs real file types', () => {
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(sniffMime(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });
  it('rejects a script disguised as an image', async () => {
    const owner = await signIn('owner@jzt.test', 'correct horse battery');
    const res = await owner.post('/api/admin/uploads').set('x-jzt-csrf', '1').attach('file', Buffer.from('<?php echo 1; ?>'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(415);
  });
  it('verifies Razorpay signatures with the server secret', () => {
    const sig = createHmac('sha256', 'rzp_secret').update('order_1|pay_1').digest('hex');
    expect(verifyPaymentSignature(env, 'order_1', 'pay_1', sig)).toBe(true);
    expect(verifyPaymentSignature(env, 'order_1', 'pay_2', sig)).toBe(false);
  });
  it('keeps payment endpoints off until enabled', async () => {
    expect((await request(app).post('/api/payments/razorpay/order').send({ ref: 'JZT-AAAAA', phone: '9845012345' })).status).toBe(501);
  });
});
