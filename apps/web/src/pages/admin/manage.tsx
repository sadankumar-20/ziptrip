import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, MessageCircle, ChevronDown, Plus, Pencil, Check, Star, Video, Link2 } from 'lucide-react';
import {
  BOOKING_STATUSES, PAYMENT_STATUSES, LEADER_ROLES, LEADER_ROLE_LABEL, ROLE_LABEL, ADMIN_ROLES, formatDate, formatINR, slugify, waLink,
  leaderInputSchema, albumInputSchema, settingsSchema, type BookingStatus, type PaymentStatus, type LeaderInput, type AlbumInput,
  type Leader, type Album, type SiteSettings, type AdminRole, type MediaItem,
} from '@jzt/shared';
import { api } from '../../lib/api';
import { useAdminQuery } from '../../lib/hooks';
import { cn } from '../../lib/cn';
import { IS_DEMO } from '../../lib/config';
import { Button, Field, Input, Textarea, Stars, StatusPill, SampleTag, ButtonLink, CopyButton } from '../../components/ui';
import { SeatMeter } from '../../components/trips';
import { AdminHeader, Card, LoadingRows, Toggle, ConfirmDelete, LinesField, UploadButton, ImageThumb, ErrorBox, useSaveState, useCan, Select, ReadOnlyNote, useAdmin } from './shell';

const BOOKING_LABEL: Record<BookingStatus, string> = { pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' };
const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', partially_paid: 'Part paid', paid: 'Paid', refunded: 'Refunded' };
const BOOKING_TONE: Record<BookingStatus, string> = { pending: 'bg-orange/20 text-ember', confirmed: 'bg-forest text-cream', cancelled: 'bg-ink/10 text-muted line-through', completed: 'bg-sage text-forest' };

// ---------------------------------------------------------------- overview
export function Overview() {
  const me = useAdmin();
  const { data, isLoading, error } = useAdminQuery(['overview'], api.admin.overview);
  const canBookings = useCan('bookings:read');
  if (isLoading) return <LoadingRows />;
  if (error || !data) return <ErrorBox error={error} />;
  const tiles = [
    canBookings && { n: data.pendingBookings, label: 'Bookings waiting for confirmation', to: '/admin/bookings', hot: data.pendingBookings > 0 },
    canBookings && { n: data.confirmedTravellers, label: 'Travellers confirmed on upcoming trips', to: '/admin/bookings' },
    { n: data.pendingReviews, label: 'Reviews waiting for approval', to: '/admin/reviews', hot: data.pendingReviews > 0 },
  ].filter(Boolean) as { n: number; label: string; to: string; hot?: boolean }[];
  return (
    <>
      <AdminHeader title={`Hello, ${me.name.split(' ')[0]}`} intro="What needs your attention today." />
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className={cn('rounded-2xl p-5 ring-1 transition-colors', t.hot ? 'bg-orange/10 ring-orange/40 hover:bg-orange/15' : 'bg-white ring-line hover:ring-ink/30')}>
            <p className="font-display text-4xl font-bold tabular">{t.n}</p>
            <p className="mt-1 text-sm text-muted">{t.label}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-10 font-display text-2xl font-bold">Upcoming departures</h2>
      <div className="mt-4 grid gap-3">
        {data.upcoming.length === 0 && <Card className="p-5 text-muted">No published upcoming trips. <Link to="/admin/trips/new" className="font-semibold text-forest">Create one</Link>.</Card>}
        {data.upcoming.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center gap-4 p-4">
            <ImageThumb url={t.coverImage.url} alt="" className="h-14 w-20" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{t.title} <StatusPill status={t.status} />{t.isDemo && <SampleTag className="text-ember" />}</p>
              <p className="text-sm text-muted">{formatDate(t.departureDate)} · {t.priceInr != null ? formatINR(t.priceInr) : 'No price'}</p>
            </div>
            <div className="w-56">{t.seatsTotal != null ? <SeatMeter trip={t} compact /> : <p className="text-sm text-muted">{t.seatsBooked} confirmed · set a seat limit to track availability</p>}</div>
            <Link to={`/admin/trips/${t.id}`} className="text-sm font-semibold text-forest">Edit</Link>
          </Card>
        ))}
      </div>
      {canBookings && data.recentBookings.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-2xl font-bold">Latest bookings</h2>
          <Card className="mt-4 divide-y divide-line">
            {data.recentBookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="font-semibold tabular">{b.ref}</span>
                <span className="min-w-0 flex-1 truncate">{b.fullName} · {b.tripTitle} · {b.travellers} traveller{b.travellers === 1 ? '' : 's'}</span>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', BOOKING_TONE[b.status])}>{BOOKING_LABEL[b.status]}</span>
                <span className="font-semibold tabular">{formatINR(b.totalInr)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- bookings
export function BookingsAdmin() {
  const canWrite = useCan('bookings:write');
  const canExport = useCan('bookings:export');
  const [filter, setFilter] = useState<{ tripId?: string; status?: string; q?: string }>({});
  const trips = useAdminQuery(['trips'], api.admin.trips);
  const { data, isLoading, error } = useAdminQuery(['bookings', filter], () => api.admin.bookings(filter));
  const qc = useQueryClient();
  const update = useMutation({ mutationFn: ({ id, u }: { id: string; u: Parameters<typeof api.admin.updateBooking>[1] }) => api.admin.updateBooking(id, u), onSuccess: () => qc.invalidateQueries() });
  const [open, setOpen] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);

  async function exportCsv() {
    const text = await api.admin.exportCsv({ tripId: filter.tripId });
    try {
      const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `joinziptrip-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { /* fall through to the copy view */ }
    setCsv(text); // also shown for copying, in case the browser blocks downloads
  }
  const totals = (data ?? []).filter((b) => b.status !== 'cancelled').reduce((s, b) => ({ people: s.people + b.travellers, money: s.money + b.totalInr }), { people: 0, money: 0 });

  return (
    <>
      <AdminHeader title="Bookings" intro="Every booking sent from the website. Confirm a booking once payment is in; seats are only counted for confirmed bookings." action={canExport && <Button variant="outline" onClick={exportCsv}><Download size={16} /> Export CSV</Button>} />
      {csv != null && (
        <Card className="mb-6 p-4">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold">CSV export</p><div className="flex gap-2"><CopyButton text={csv} /><Button size="sm" variant="ghost" onClick={() => setCsv(null)}>Close</Button></div></div>
          <p className="mb-2 text-sm text-muted">If the download didn’t start, copy this and paste it into a spreadsheet.</p>
          <pre id="copy-fallback" className="max-h-56 overflow-auto rounded-lg bg-paper p-3 text-xs">{csv}</pre>
        </Card>
      )}
      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-[1fr_12rem_1fr]">
        <label className="sr-only" htmlFor="bf-trip">Trip</label>
        <Select id="bf-trip" value={filter.tripId ?? ''} onChange={(e) => setFilter((f) => ({ ...f, tripId: e.target.value || undefined }))}>
          <option value="">All trips</option>
          {trips.data?.map((t) => <option key={t.id} value={t.id}>{t.title} · {formatDate(t.departureDate, { year: false })}</option>)}
        </Select>
        <label className="sr-only" htmlFor="bf-status">Status</label>
        <Select id="bf-status" value={filter.status ?? ''} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}>
          <option value="">Any status</option>
          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{BOOKING_LABEL[s]}</option>)}
        </Select>
        <label className="sr-only" htmlFor="bf-q">Search</label>
        <Input id="bf-q" placeholder="Search name, mobile, email or ref" value={filter.q ?? ''} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))} />
      </Card>
      <ErrorBox error={error ?? update.error} />
      {data && <p className="mb-3 text-sm text-muted">{data.length} booking{data.length === 1 ? '' : 's'} · {totals.people} travellers · {formatINR(totals.money)} excluding cancelled</p>}
      {isLoading && <LoadingRows />}
      <div className="grid gap-2">
        {data?.map((b) => {
          const isOpen = open === b.id;
          return (
            <Card key={b.id} className={cn(b.status === 'cancelled' && 'opacity-70')}>
              <button className="grid w-full gap-2 p-4 text-left md:grid-cols-[7rem_1fr_9rem_7rem_6rem_1.5rem] md:items-center" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                <span className="font-semibold tabular">{b.ref}</span>
                <span className="min-w-0"><span className="block truncate font-semibold">{b.fullName}</span><span className="block truncate text-sm text-muted">{b.tripTitle} · {formatDate(b.departureDate, { year: false })}</span></span>
                <span className="text-sm">{b.travellers} × {formatINR(b.unitPriceInr)}</span>
                <span className={cn('justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold', BOOKING_TONE[b.status])}>{BOOKING_LABEL[b.status]}</span>
                <span className="text-sm font-semibold">{PAYMENT_LABEL[b.paymentStatus]}</span>
                <ChevronDown size={18} className={cn('transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </button>
              {isOpen && (
                <div className="grid gap-5 border-t border-line p-4 md:grid-cols-2">
                  <dl className="grid gap-2 text-sm">
                    {[
                      ['Mobile', `+91 ${b.phone}`], ['Email', b.email], ['Emergency contact', `${b.emergencyName}, +91 ${b.emergencyPhone}`],
                      ['Total', formatINR(b.totalInr)], ['Booked on', new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })], ['Channel', b.channel === 'whatsapp' ? 'WhatsApp' : 'Online payment'],
                      ...(b.notes ? [['Requirements', b.notes]] : []),
                    ].map(([k, v]) => <div key={k} className="grid grid-cols-[9rem_1fr] gap-2"><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={waLink(`91${b.phone}`, `Hi ${b.fullName.split(' ')[0]}, this is JoinZipTrip about your booking ${b.ref} for ${b.tripTitle}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-3.5 text-sm font-semibold text-cream"><MessageCircle size={15} /> WhatsApp traveller</a>
                    </div>
                  </dl>
                  <div className="grid content-start gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Booking status" htmlFor={`bs-${b.id}`}>
                        <Select id={`bs-${b.id}`} value={b.status} disabled={!canWrite || update.isPending} onChange={(e) => update.mutate({ id: b.id, u: { status: e.target.value as BookingStatus } })}>
                          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{BOOKING_LABEL[s]}</option>)}
                        </Select>
                      </Field>
                      <Field label="Payment" htmlFor={`bp-${b.id}`}>
                        <Select id={`bp-${b.id}`} value={b.paymentStatus} disabled={!canWrite || update.isPending} onChange={(e) => update.mutate({ id: b.id, u: { paymentStatus: e.target.value as PaymentStatus } })}>
                          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <NotesEditor id={b.id} initial={b.adminNotes} disabled={!canWrite} onSave={(adminNotes) => update.mutate({ id: b.id, u: { adminNotes } })} />
                    {canWrite && b.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="forest" onClick={() => update.mutate({ id: b.id, u: { status: 'confirmed', paymentStatus: 'paid' } })}><Check size={15} /> Mark paid and confirm</Button>
                        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: b.id, u: { status: 'cancelled' } })}>Cancel booking</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {data?.length === 0 && <Card className="p-6 text-muted">No bookings match these filters.</Card>}
      </div>
    </>
  );
}

function NotesEditor({ id, initial, onSave, disabled }: { id: string; initial: string; onSave: (s: string) => void; disabled?: boolean }) {
  const [v, setV] = useState(initial);
  return (
    <Field label="Team notes" htmlFor={`bn-${id}`} hint="Only visible to the team">
      <Textarea id={`bn-${id}`} className="min-h-20" value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onSave(v)} />
    </Field>
  );
}

// ---------------------------------------------------------------- leaders
export function LeadersAdmin() {
  const { data, isLoading, error } = useAdminQuery(['leaders'], api.admin.leaders);
  const canWrite = useCan('leaders:write');
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: api.admin.deleteLeader, onSuccess: () => qc.invalidateQueries() });
  return (
    <>
      <AdminHeader title="Trip leaders" intro="Profiles shown on the Trip Leaders page and on each trip. Experience and trip counts stay hidden until you enter them." action={canWrite && <ButtonLink to="/admin/leaders/new"><Plus size={17} /> Add leader</ButtonLink>} />
      <ErrorBox error={error ?? del.error} />
      {isLoading && <LoadingRows />}
      <div className="grid gap-3">
        {data?.map((l) => (
          <Card key={l.id} className="flex flex-wrap items-center gap-4 p-4">
            <ImageThumb url={l.photoUrl} alt="" className="size-14" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{l.name}{l.isDemo && <SampleTag className="text-ember">Needs details</SampleTag>}{!l.isPublished && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs">Hidden</span>}</p>
              <p className="text-sm text-muted">{LEADER_ROLE_LABEL[l.role]} · {l.yearsExperience != null ? `${l.yearsExperience} yrs` : 'experience not set'} · {l.tripsLed != null ? `${l.tripsLed} trips led` : 'trips led not set'}</p>
            </div>
            <Link to={`/admin/leaders/${l.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><Pencil size={15} /> Edit</Link>
            {canWrite && <ConfirmDelete onConfirm={() => del.mutate(l.id)} />}
          </Card>
        ))}
      </div>
    </>
  );
}

const BLANK_LEADER: LeaderInput = { slug: '', name: '', role: 'trek_leader', photoUrl: null, intro: '', story: '', philosophy: '', yearsExperience: null, tripsLed: null, destinations: [], specializations: [], languages: [], instagram: null, isPublished: true, isDemo: false, sortOrder: 10 };

export function LeaderEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canWrite = useCan('leaders:write');
  const list = useAdminQuery(['leaders'], api.admin.leaders);
  const [f, setF] = useState<LeaderInput | null>(isNew ? { ...BLANK_LEADER } : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { saved, flash } = useSaveState();
  useEffect(() => {
    if (!isNew && !f && list.data) {
      const l = list.data.find((x) => x.id === id);
      if (l) { const { id: _i, ...rest } = l; setF(rest); }
    }
  }, [list.data, id, isNew, f]);
  const save = useMutation({
    mutationFn: (input: LeaderInput) => (isNew ? api.admin.createLeader(input) : api.admin.updateLeader(id!, input)),
    onSuccess: (l: Leader) => { qc.invalidateQueries(); flash(); if (isNew) navigate(`/admin/leaders/${l.id}`, { replace: true }); },
  });
  if (!f) return list.isLoading ? <LoadingRows /> : <ErrorBox error={{ message: 'Profile not found' }} />;
  const set = <K extends keyof LeaderInput>(k: K, v: LeaderInput[K]) => setF((x) => ({ ...x!, [k]: v }));
  const num = (v: string) => (v === '' ? null : Number(v));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = leaderInputSchema.safeParse(f);
    if (!p.success) return setErrors(Object.fromEntries(p.error.issues.map((i) => [i.path.join('.'), i.message])));
    setErrors({});
    save.mutate(p.data);
  }
  return (
    <form onSubmit={submit} noValidate>
      <AdminHeader title={isNew ? 'Add trip leader' : 'Edit profile'} intro={<Link to="/admin/leaders" className="font-semibold text-forest">Back to all leaders</Link>} action={canWrite && <div className="flex items-center gap-3">{saved && <span className="inline-flex items-center gap-1 font-semibold text-forest"><Check size={16} /> Saved</span>}<Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button></div>} />
      {!canWrite && <ReadOnlyNote what="profiles" />}
      {Object.keys(errors).length > 0 && <div className="mb-5"><ErrorBox error={{ message: 'Some fields need fixing', fields: errors }} /></div>}
      <ErrorBox error={save.error} />
      <fieldset disabled={!canWrite} className="grid gap-5">
        <Card className="grid gap-5 p-5 md:grid-cols-[12rem_1fr] md:p-6">
          <div className="grid content-start gap-2">
            <ImageThumb url={f.photoUrl ?? null} alt="Profile photo" className="aspect-[4/5] w-full" />
            <UploadButton folder="leaders" label="Upload photo" onUploaded={(r) => set('photoUrl', r.url)} />
            {f.photoUrl && <button type="button" className="text-left text-sm font-semibold text-[#9F2D1F]" onClick={() => set('photoUrl', null)}>Remove photo</button>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="l-name" error={errors.name}><Input id="l-name" value={f.name} onChange={(e) => { set('name', e.target.value); if (isNew) set('slug', slugify(e.target.value)); }} /></Field>
            <Field label="Role" htmlFor="l-role"><Select id="l-role" value={f.role} onChange={(e) => set('role', e.target.value as LeaderInput['role'])}>{LEADER_ROLES.map((r) => <option key={r} value={r}>{LEADER_ROLE_LABEL[r]}</option>)}</Select></Field>
            <Field label="Web address" htmlFor="l-slug" hint={`joinziptrip.com/leaders/${f.slug || '…'}`} error={errors.slug}><Input id="l-slug" value={f.slug} onChange={(e) => set('slug', e.target.value)} /></Field>
            <Field label="Instagram handle" htmlFor="l-ig" optional><Input id="l-ig" value={f.instagram ?? ''} onChange={(e) => set('instagram', e.target.value || null)} placeholder="without @" /></Field>
            <Field label="Years of experience" htmlFor="l-years" optional hint="Only enter a verified figure. Left empty, it isn’t shown."><Input id="l-years" type="number" min={0} value={f.yearsExperience ?? ''} onChange={(e) => set('yearsExperience', num(e.target.value))} /></Field>
            <Field label="Trips led" htmlFor="l-trips" optional hint="Only enter a verified figure. Left empty, it isn’t shown."><Input id="l-trips" type="number" min={0} value={f.tripsLed ?? ''} onChange={(e) => set('tripsLed', num(e.target.value))} /></Field>
          </div>
        </Card>
        <Card className="grid gap-5 p-5 md:p-6">
          <Field label="Short introduction" htmlFor="l-intro"><Textarea id="l-intro" className="min-h-20" value={f.intro} onChange={(e) => set('intro', e.target.value)} /></Field>
          <Field label="Travel philosophy" htmlFor="l-phil" hint="One sentence, shown as a quote"><Input id="l-phil" value={f.philosophy} onChange={(e) => set('philosophy', e.target.value)} /></Field>
          <Field label="Personal travel story" htmlFor="l-story"><Textarea id="l-story" className="min-h-40" value={f.story} onChange={(e) => set('story', e.target.value)} /></Field>
          <div className="grid gap-5 md:grid-cols-3">
            <LinesField id="l-dest" label="Destinations explored" value={f.destinations!} onChange={(v) => set('destinations', v)} hint="One per line" />
            <LinesField id="l-spec" label="Areas of expertise" value={f.specializations!} onChange={(v) => set('specializations', v)} hint="One per line" />
            <LinesField id="l-lang" label="Languages" value={f.languages!} onChange={(v) => set('languages', v)} hint="One per line" />
          </div>
          <div className="flex flex-wrap gap-6">
            <Toggle id="l-pub" label="Show on website" checked={!!f.isPublished} onChange={(v) => set('isPublished', v)} />
            <Toggle id="l-demo" label="Mark as placeholder" checked={!!f.isDemo} onChange={(v) => set('isDemo', v)} />
          </div>
        </Card>
      </fieldset>
    </form>
  );
}

// ---------------------------------------------------------------- gallery
export function GalleryAdmin() {
  const { data, isLoading, error } = useAdminQuery(['albums'], api.admin.albums);
  const canWrite = useCan('gallery:write');
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: api.admin.deleteAlbum, onSuccess: () => qc.invalidateQueries() });
  return (
    <>
      <AdminHeader title="Gallery" intro="One album per completed trip. Albums appear on Past Adventures and feed the Memory Wall." action={canWrite && <ButtonLink to="/admin/gallery/new"><Plus size={17} /> New album</ButtonLink>} />
      <ErrorBox error={error ?? del.error} />
      {isLoading && <LoadingRows />}
      {data?.length === 0 && <Card className="p-6 text-muted">No albums yet. Create one after your first trip.</Card>}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((a) => (
          <Card key={a.id} className="flex gap-4 p-4">
            <ImageThumb url={a.coverUrl ?? a.media[0]?.url ?? null} alt="" className="h-20 w-28" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{a.title}{a.isDemo && <SampleTag className="text-ember" />}{!a.isPublished && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs">Draft</span>}</p>
              <p className="text-sm text-muted">{a.location} · {a.media.length} items</p>
              <div className="mt-2 flex items-center gap-3">
                <Link to={`/admin/gallery/${a.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><Pencil size={15} /> Edit</Link>
                {canWrite && <ConfirmDelete onConfirm={() => del.mutate(a.id)} />}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

const BLANK_ALBUM: AlbumInput = { slug: '', title: '', location: '', tripDate: null, tripId: null, leaderId: null, participants: null, story: '', coverUrl: null, media: [], isPublished: false, isDemo: false };

export function AlbumEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canWrite = useCan('gallery:write');
  const list = useAdminQuery(['albums'], api.admin.albums);
  const trips = useAdminQuery(['trips'], api.admin.trips);
  const leaders = useAdminQuery(['leaders'], api.admin.leaders);
  const [f, setF] = useState<AlbumInput | null>(isNew ? { ...BLANK_ALBUM } : null);
  const [reel, setReel] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { saved, flash } = useSaveState();
  useEffect(() => {
    if (!isNew && !f && list.data) {
      const a = list.data.find((x) => x.id === id);
      if (a) { const { id: _i, createdAt: _c, ...rest } = a; setF(rest); }
    }
  }, [list.data, id, isNew, f]);
  const save = useMutation({
    mutationFn: (input: AlbumInput) => (isNew ? api.admin.createAlbum(input) : api.admin.updateAlbum(id!, input)),
    onSuccess: (a: Album) => { qc.invalidateQueries(); flash(); if (isNew) navigate(`/admin/gallery/${a.id}`, { replace: true }); },
  });
  if (!f) return list.isLoading ? <LoadingRows /> : <ErrorBox error={{ message: 'Album not found' }} />;
  const set = <K extends keyof AlbumInput>(k: K, v: AlbumInput[K]) => setF((x) => ({ ...x!, [k]: v }));
  const media = f.media as MediaItem[];
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = albumInputSchema.safeParse(f);
    if (!p.success) return setErrors(Object.fromEntries(p.error.issues.map((i) => [i.path.join('.'), i.message])));
    setErrors({});
    save.mutate(p.data);
  }
  return (
    <form onSubmit={submit} noValidate>
      <AdminHeader title={isNew ? 'New album' : f.title || 'Edit album'} intro={<Link to="/admin/gallery" className="font-semibold text-forest">Back to gallery</Link>} action={canWrite && <div className="flex items-center gap-3">{saved && <span className="inline-flex items-center gap-1 font-semibold text-forest"><Check size={16} /> Saved</span>}<Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save album'}</Button></div>} />
      {Object.keys(errors).length > 0 && <div className="mb-5"><ErrorBox error={{ message: 'Some fields need fixing', fields: errors }} /></div>}
      <ErrorBox error={save.error} />
      <fieldset disabled={!canWrite} className="grid gap-5">
        <Card className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
          <Field label="Album title" htmlFor="a-title" error={errors.title}><Input id="a-title" value={f.title} onChange={(e) => { set('title', e.target.value); if (isNew) set('slug', slugify(e.target.value)); }} /></Field>
          <Field label="Web address" htmlFor="a-slug" error={errors.slug} hint={`/past-adventures/${f.slug || '…'}`}><Input id="a-slug" value={f.slug} onChange={(e) => set('slug', e.target.value)} /></Field>
          <Field label="Location" htmlFor="a-loc"><Input id="a-loc" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Trip date" htmlFor="a-date"><Input id="a-date" type="date" value={f.tripDate ?? ''} onChange={(e) => set('tripDate', e.target.value || null)} /></Field>
          <Field label="Linked trip" htmlFor="a-trip" hint="Shows that trip’s reviews in the album"><Select id="a-trip" value={f.tripId ?? ''} onChange={(e) => set('tripId', e.target.value || null)}><option value="">None</option>{trips.data?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></Field>
          <Field label="Trip leader" htmlFor="a-leader"><Select id="a-leader" value={f.leaderId ?? ''} onChange={(e) => set('leaderId', e.target.value || null)}><option value="">None</option>{leaders.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
          <Field label="Number of travellers" htmlFor="a-count" optional hint="Only enter a verified head-count"><Input id="a-count" type="number" min={1} value={f.participants ?? ''} onChange={(e) => set('participants', e.target.value ? Number(e.target.value) : null)} /></Field>
          <div className="flex flex-wrap items-end gap-6"><Toggle id="a-pub" label="Published" checked={!!f.isPublished} onChange={(v) => set('isPublished', v)} /><Toggle id="a-demo" label="Sample album" checked={!!f.isDemo} onChange={(v) => set('isDemo', v)} /></div>
          <Field label="Trip story" htmlFor="a-story" className="md:col-span-2"><Textarea id="a-story" className="min-h-32" value={f.story} onChange={(e) => set('story', e.target.value)} /></Field>
        </Card>
        <Card className="grid gap-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Photos and videos</h2>
            <div className="flex flex-wrap gap-2">
              <UploadButton folder="albums" multiple label="Upload photos" onUploaded={(r) => setF((x) => ({ ...x!, media: [...(x!.media as MediaItem[]), { url: r.url, alt: r.name, kind: r.kind }] }))} />
              <UploadButton folder="albums" label="Upload video" accept="video/mp4,video/webm" onUploaded={(r) => setF((x) => ({ ...x!, media: [...(x!.media as MediaItem[]), { url: r.url, alt: r.name, kind: 'video' }] }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="a-reel">Instagram reel or YouTube link</label>
            <Input id="a-reel" className="h-10 max-w-md flex-1 text-sm" placeholder="Paste an Instagram reel or YouTube link" value={reel} onChange={(e) => setReel(e.target.value)} />
            <Button type="button" size="sm" variant="outline" disabled={!/^https:\/\//.test(reel)} onClick={() => { set('media', [...media, { url: reel, externalUrl: reel, alt: 'Trip reel', kind: 'video' }]); setReel(''); }}><Link2 size={15} /> Add reel link</Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((m, i) => (
              <li key={m.url + i} className={cn('flex gap-3 rounded-xl bg-paper p-2 ring-1', f.coverUrl === m.url ? 'ring-forest' : 'ring-line')}>
                {m.kind === 'video' ? <span className="grid h-16 w-20 place-items-center rounded-lg bg-ink text-cream"><Video size={18} /></span> : <ImageThumb url={m.url} alt="" className="h-16 w-20" />}
                <div className="grid min-w-0 flex-1 gap-1">
                  <Input aria-label={`Item ${i + 1} description`} className="h-9 text-sm" value={m.alt} onChange={(e) => set('media', media.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                  <div className="flex gap-3 text-sm font-semibold">
                    {m.kind === 'image' && <button type="button" className="text-forest" onClick={() => set('coverUrl', m.url)}>{f.coverUrl === m.url ? 'Cover' : 'Make cover'}</button>}
                    <button type="button" className="text-[#9F2D1F]" onClick={() => set('media', media.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </fieldset>
    </form>
  );
}

// ---------------------------------------------------------------- reviews
export function ReviewsAdmin() {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const { data, isLoading, error } = useAdminQuery(['reviews', tab], () => api.admin.reviews(tab || undefined));
  const canMod = useCan('reviews:moderate');
  const qc = useQueryClient();
  const mod = useMutation({ mutationFn: ({ id, m }: { id: string; m: Parameters<typeof api.admin.moderateReview>[1] }) => api.admin.moderateReview(id, m), onSuccess: () => qc.invalidateQueries() });
  const del = useMutation({ mutationFn: api.admin.deleteReview, onSuccess: () => qc.invalidateQueries() });
  return (
    <>
      <AdminHeader title="Reviews" intro="Approve reviews before they appear. Featured reviews show first on the homepage. Never edit what a traveller wrote." />
      <div className="mb-5 flex gap-2" role="tablist">
        {([['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']] as const).map(([v, l]) => (
          <button key={l} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn('rounded-full px-4 py-2 text-sm font-semibold', tab === v ? 'bg-forest text-cream' : 'bg-white ring-1 ring-line')}>{l}</button>
        ))}
      </div>
      <ErrorBox error={error ?? mod.error} />
      {isLoading && <LoadingRows />}
      {data?.length === 0 && <Card className="p-6 text-muted">{tab === 'pending' ? 'Nothing waiting. New reviews from the website land here.' : 'No reviews here.'}</Card>}
      <div className="grid gap-3">
        {data?.map((r) => (
          <Card key={r.id} className="grid gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} />
              <span className="font-semibold">{r.name}</span>
              <span className="text-sm text-muted">{r.tripName}{r.experienceDate ? ` · ${formatDate(r.experienceDate, { weekday: false })}` : ''}</span>
              {r.isVerified && <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-semibold text-forest">Verified traveller</span>}
              {r.isDemo && <SampleTag className="text-ember" />}
              {r.isFeatured && <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-semibold text-ember">Featured</span>}
              <span className="ml-auto text-xs capitalize text-muted">{r.status}</span>
            </div>
            <p className="max-w-prose">{r.body}</p>
            {canMod && (
              <div className="flex flex-wrap gap-2">
                {r.status !== 'approved' && <Button size="sm" variant="forest" onClick={() => mod.mutate({ id: r.id, m: { status: 'approved' } })}><Check size={15} /> Approve</Button>}
                {r.status !== 'rejected' && <Button size="sm" variant="outline" onClick={() => mod.mutate({ id: r.id, m: { status: 'rejected', isFeatured: false } })}>Reject</Button>}
                {r.status === 'approved' && <Button size="sm" variant="ghost" onClick={() => mod.mutate({ id: r.id, m: { isFeatured: !r.isFeatured } })}><Star size={15} /> {r.isFeatured ? 'Unfeature' : 'Feature'}</Button>}
                <ConfirmDelete onConfirm={() => del.mutate(r.id)} />
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- settings
export function SettingsAdmin() {
  const canWrite = useCan('settings:write');
  const canUsers = useCan('users:manage');
  const q = useAdminQuery(['settings'], api.admin.settings);
  const [f, setF] = useState<SiteSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { saved, flash } = useSaveState();
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);
  const save = useMutation({ mutationFn: api.admin.saveSettings, onSuccess: () => { qc.invalidateQueries(); flash(); } });
  if (!f) return <LoadingRows />;
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setF((x) => ({ ...x!, [k]: v }));
  return (
    <>
      <AdminHeader title="Settings" intro="Contact details used across the website, WhatsApp messages and the footer." />
      {!canWrite && <ReadOnlyNote what="settings" />}
      <form noValidate onSubmit={(e) => { e.preventDefault(); const p = settingsSchema.safeParse(f); if (!p.success) return setErrors(Object.fromEntries(p.error.issues.map((i) => [i.path.join('.'), i.message]))); setErrors({}); save.mutate(p.data as SiteSettings); }}>
        <fieldset disabled={!canWrite}>
          <Card className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
            <Field label="Phone 1" htmlFor="s-p1" error={errors['phones.0']}><Input id="s-p1" value={f.phones[0] ?? ''} onChange={(e) => set('phones', [e.target.value, ...f.phones.slice(1)])} /></Field>
            <Field label="Phone 2" htmlFor="s-p2" optional error={errors['phones.1']}><Input id="s-p2" value={f.phones[1] ?? ''} onChange={(e) => set('phones', [f.phones[0], e.target.value].filter((x) => x !== ''))} /></Field>
            <Field label="WhatsApp number for bookings" htmlFor="s-wa" hint="91 followed by the 10-digit number" error={errors.whatsappNumber}><Input id="s-wa" value={f.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} /></Field>
            <Field label="Instagram handle" htmlFor="s-ig" hint="Without @. Please confirm this is the right account." error={errors.instagramHandle}><Input id="s-ig" value={f.instagramHandle} onChange={(e) => set('instagramHandle', e.target.value)} /></Field>
            <Field label="Business email" htmlFor="s-email" error={errors.email}><Input id="s-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Google reviews link" htmlFor="s-google" optional hint="Shows a “See Google reviews” button once added" error={errors.googleReviewsUrl}><Input id="s-google" type="url" value={f.googleReviewsUrl ?? ''} onChange={(e) => set('googleReviewsUrl', e.target.value || null)} /></Field>
            <Field label="Base city" htmlFor="s-city"><Input id="s-city" value={f.baseCity} onChange={(e) => set('baseCity', e.target.value)} /></Field>
            <Field label="Brand name" htmlFor="s-brand"><Input id="s-brand" value={f.brandName} onChange={(e) => set('brandName', e.target.value)} /></Field>
            {canWrite && <div className="flex items-center gap-3 md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>{saved && <span className="inline-flex items-center gap-1 font-semibold text-forest" role="status"><Check size={16} /> Saved</span>}</div>}
            <div className="md:col-span-2"><ErrorBox error={save.error} /></div>
          </Card>
        </fieldset>
      </form>
      {canUsers && <TeamAccess />}
    </>
  );
}

function TeamAccess() {
  const me = useAdmin();
  const users = useAdminQuery(['users'], api.admin.users);
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', name: '', role: 'manager' as AdminRole, password: '' });
  const create = useMutation({ mutationFn: () => api.admin.createUser(form), onSuccess: () => { qc.invalidateQueries(); setForm({ email: '', name: '', role: 'manager', password: '' }); } });
  const update = useMutation({ mutationFn: ({ id, u }: { id: string; u: Parameters<typeof api.admin.updateUser>[1] }) => api.admin.updateUser(id, u), onSuccess: () => qc.invalidateQueries() });
  return (
    <>
      <h2 className="mt-12 font-display text-3xl font-bold">Team access</h2>
      <p className="mt-1 max-w-2xl text-muted">Owners manage everything. Managers handle trips, bookings and reviews. Content editors update trips, leaders, photos and reviews, and can’t see customer details.</p>
      <ErrorBox error={users.error ?? update.error} />
      <Card className="mt-5 divide-y divide-line">
        {users.data?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="font-semibold">{u.name} {u.id === me.id && <span className="text-sm font-normal text-muted">(you)</span>}</p><p className="text-sm text-muted">{u.email}</p></div>
            <label className="sr-only" htmlFor={`u-role-${u.id}`}>Role</label>
            <Select id={`u-role-${u.id}`} value={u.role} className="h-9 w-44 text-sm" disabled={IS_DEMO || u.id === me.id} onChange={(e) => update.mutate({ id: u.id, u: { role: e.target.value as AdminRole } })}>
              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
            <Toggle id={`u-act-${u.id}`} label="Active" checked={u.isActive} disabled={IS_DEMO || u.id === me.id} onChange={(v) => update.mutate({ id: u.id, u: { isActive: v } })} />
          </div>
        ))}
      </Card>
      {!IS_DEMO && (
        <Card className="mt-5 p-5">
          <p className="font-semibold">Add a team member</p>
          <form className="mt-4 grid gap-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Name" htmlFor="nu-name"><Input id="nu-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" htmlFor="nu-email"><Input id="nu-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Role" htmlFor="nu-role"><Select id="nu-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>{ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
            <Field label="Temporary password" htmlFor="nu-pw" hint="At least 12 characters"><Input id="nu-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <div className="md:col-span-4"><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add team member'}</Button></div>
          </form>
          <div className="mt-3"><ErrorBox error={create.error} /></div>
        </Card>
      )}
    </>
  );
}

