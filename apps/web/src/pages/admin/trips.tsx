import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, Check, Video } from 'lucide-react';
import {
  CATEGORY_LABEL, DIFFICULTY_LABEL, INCLUSION_KEYS, INCLUSION_LABEL, STATUS_MODES, TRIP_CATEGORIES, DIFFICULTIES, LEADER_ROLE_LABEL,
  formatDate, formatINR, slugify, tripInputSchema, THADIYANDAMOL, type TripInput, type TripView, type MediaItem, type StatusMode,
} from '@jzt/shared';
import { api } from '../../lib/api';
import { useAdminQuery } from '../../lib/hooks';
import { cn } from '../../lib/cn';
import { Button, Field, Input, Textarea, StatusPill, SampleTag, ButtonLink } from '../../components/ui';
import { SeatMeter } from '../../components/trips';
import { AdminHeader, Card, LoadingRows, Toggle, ConfirmDelete, LinesField, RowsEditor, UploadButton, ImageThumb, ErrorBox, useSaveState, useCan, Select, ReadOnlyNote } from './shell';

const STATUS_MODE_LABEL: Record<StatusMode, string> = { auto: 'Automatic (from seats)', open: 'Open', filling_fast: 'Filling fast', sold_out: 'Sold out' };

export function TripsAdmin() {
  const { data, isLoading, error } = useAdminQuery(['trips'], api.admin.trips);
  const canWrite = useCan('trips:write');
  const canDelete = useCan('trips:delete');
  const qc = useQueryClient();
  const patch = useMutation({ mutationFn: ({ id, p }: { id: string; p: Parameters<typeof api.admin.patchTrip>[1] }) => api.admin.patchTrip(id, p), onSuccess: () => qc.invalidateQueries() });
  const del = useMutation({ mutationFn: api.admin.deleteTrip, onSuccess: () => qc.invalidateQueries() });
  return (
    <>
      <AdminHeader title="Trips" intro="Create trips, set prices, dates and seats, and control what shows on the website." action={canWrite && <ButtonLink to="/admin/trips/new"><Plus size={17} /> New trip</ButtonLink>} />
      {!canWrite && <ReadOnlyNote what="trips" />}
      <ErrorBox error={error ?? patch.error ?? del.error} />
      {isLoading && <LoadingRows />}
      <div className="grid gap-3">
        {data?.map((t) => (
          <Card key={t.id} className="grid gap-4 p-4 md:grid-cols-[5rem_1fr_auto] md:items-center">
            <ImageThumb url={t.coverImage.url} alt="" className="hidden h-16 w-20 md:block" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/admin/trips/${t.id}`} className="font-display text-xl font-bold hover:underline">{t.title}</Link>
                <StatusPill status={t.status} />
                {!t.isPublished && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">Draft</span>}
                {t.isFeatured && <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-semibold text-ember">Featured</span>}
                {t.isDemo && <SampleTag className="text-ember" />}
              </div>
              <p className="mt-1 text-sm text-muted">{formatDate(t.departureDate)} · {t.priceInr != null ? formatINR(t.priceInr) : 'No price'} · {CATEGORY_LABEL[t.category]}</p>
              <div className="mt-2 max-w-xs">{t.seatsTotal != null ? <SeatMeter trip={t} compact /> : <p className="text-sm text-muted">{t.seatsBooked} confirmed · no seat limit set</p>}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <label className="sr-only" htmlFor={`sm-${t.id}`}>Booking status for {t.title}</label>
              <Select id={`sm-${t.id}`} value={t.statusMode} disabled={!canWrite} onChange={(e) => patch.mutate({ id: t.id, p: { statusMode: e.target.value as StatusMode } })} className="h-9 w-48 text-sm">
                {STATUS_MODES.map((m) => <option key={m} value={m}>{STATUS_MODE_LABEL[m]}</option>)}
              </Select>
              <Toggle id={`pub-${t.id}`} label="Published" checked={t.isPublished} disabled={!canWrite} onChange={(v) => patch.mutate({ id: t.id, p: { isPublished: v } })} />
              <Link to={`/admin/trips/${t.id}`} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`Edit ${t.title}`}><Pencil size={16} /></Link>
              {t.isPublished && <Link to={`/trips/${t.slug}`} className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label={`View ${t.title} on the website`}><Eye size={16} /></Link>}
              {canDelete && <ConfirmDelete onConfirm={() => del.mutate(t.id)} pending={del.isPending} />}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- editor
const BLANK: TripInput = {
  slug: '', title: '', destination: '', region: '', category: 'trekking', summary: '', description: '', highlights: [], difficulty: 'easy',
  distanceLabel: '', trekDurationLabel: '', altitudeM: null, ageGroup: null, fitness: '', pickupPoint: '', pickupCity: 'Mysuru',
  pickupTime: '', returnSchedule: '', departureDate: null, departureTime: null, durationDays: 1, durationLabel: '1 day', priceInr: null,
  seatsTotal: null, statusMode: 'auto', isFeatured: false, isPublished: false, isDemo: false,
  coverImage: { url: '', alt: '', kind: 'image' }, gallery: [], itinerary: [], inclusions: [], exclusions: [],
  thingsToCarry: THADIYANDAMOL.thingsToCarry, safety: THADIYANDAMOL.safety.slice(0, 6), cancellationPolicy: THADIYANDAMOL.cancellationPolicy,
  bookingTerms: THADIYANDAMOL.bookingTerms, faqs: [], elevation: [], leaderIds: [],
};

function toInput(t: TripView): TripInput {
  const { id: _i, createdAt: _c, updatedAt: _u, seatsBooked: _s, seatsLeft: _l, status: _st, ...rest } = t;
  return rest;
}

function Section({ title, children, intro }: { title: string; children: React.ReactNode; intro?: string }) {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      <div className="mt-5 grid gap-5">{children}</div>
    </Card>
  );
}

export function TripEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canWrite = useCan('trips:write');
  const existing = useAdminQuery(['trip', id], () => api.admin.trip(id!), !isNew);
  const leaders = useAdminQuery(['leaders'], api.admin.leaders);
  const [f, setF] = useState<TripInput | null>(isNew ? structuredClone(BLANK) : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { saved, flash } = useSaveState();
  useEffect(() => { if (existing.data && !f) setF(toInput(existing.data)); }, [existing.data, f]);

  const save = useMutation({
    mutationFn: (input: TripInput) => (isNew ? api.admin.createTrip(input) : api.admin.updateTrip(id!, input)),
    onSuccess: (t) => { qc.invalidateQueries(); flash(); if (isNew) navigate(`/admin/trips/${t.id}`, { replace: true }); },
    onError: (e: any) => e?.fields && setErrors(e.fields),
  });

  if (!f) return <LoadingRows />;
  const set = <K extends keyof TripInput>(k: K, v: TripInput[K]) => { setF((x) => ({ ...x!, [k]: v })); if (errors[k as string]) setErrors(({ [k as string]: _, ...r }) => r); };
  const e = (k: string) => errors[k];

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const p = tripInputSchema.safeParse(f);
    if (!p.success) {
      setErrors(Object.fromEntries(p.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    save.mutate(p.data);
  }
  const num = (v: string) => (v === '' ? null : Number(v));
  const hasIncl = (k: string) => f.inclusions!.some((i) => i.key === k);

  return (
    <form onSubmit={submit} noValidate>
      <AdminHeader
        title={isNew ? 'New trip' : f.title || 'Edit trip'}
        intro={isNew ? 'Fill in what you know. Save as a draft, then publish when it’s ready.' : <Link to="/admin/trips" className="font-semibold text-forest">Back to all trips</Link>}
        action={canWrite && <div className="flex items-center gap-3">{saved && <span className="inline-flex items-center gap-1 font-semibold text-forest" role="status"><Check size={16} /> Saved</span>}<Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : isNew ? 'Create trip' : 'Save changes'}</Button></div>}
      />
      {!canWrite && <ReadOnlyNote what="this trip" />}
      {Object.keys(errors).length > 0 && <div className="mb-5"><ErrorBox error={{ message: 'Some fields need fixing', fields: errors }} /></div>}
      {save.error && !Object.keys(errors).length && <div className="mb-5"><ErrorBox error={save.error} /></div>}

      <fieldset disabled={!canWrite} className="grid gap-5">
        <Section title="Basics">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Trip title" htmlFor="t-title" error={e('title')}><Input id="t-title" value={f.title} onChange={(ev) => { set('title', ev.target.value); if (!slugTouched) set('slug', slugify(ev.target.value)); }} invalid={!!e('title')} /></Field>
            <Field label="Web address" htmlFor="t-slug" hint={`joinziptrip.com/trips/${f.slug || '…'}`} error={e('slug')}><Input id="t-slug" value={f.slug} onChange={(ev) => { setSlugTouched(true); set('slug', ev.target.value); }} invalid={!!e('slug')} /></Field>
            <Field label="Destination" htmlFor="t-dest" error={e('destination')}><Input id="t-dest" value={f.destination} onChange={(ev) => set('destination', ev.target.value)} invalid={!!e('destination')} /></Field>
            <Field label="Region" htmlFor="t-region"><Input id="t-region" value={f.region} onChange={(ev) => set('region', ev.target.value)} placeholder="Coorg (Kodagu), Karnataka" /></Field>
            <Field label="Category" htmlFor="t-cat"><Select id="t-cat" value={f.category} onChange={(ev) => set('category', ev.target.value as TripInput['category'])}>{TRIP_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select></Field>
            <Field label="Difficulty" htmlFor="t-diff"><Select id="t-diff" value={f.difficulty} onChange={(ev) => set('difficulty', ev.target.value as TripInput['difficulty'])}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</Select></Field>
          </div>
          <Field label="Short summary" htmlFor="t-summary" hint="One or two sentences for cards and search results" error={e('summary')}><Textarea id="t-summary" className="min-h-20" value={f.summary} onChange={(ev) => set('summary', ev.target.value)} maxLength={280} /></Field>
          <Field label="What makes it special" htmlFor="t-desc" hint="Leave a blank line between paragraphs"><Textarea id="t-desc" className="min-h-40" value={f.description} onChange={(ev) => set('description', ev.target.value)} /></Field>
          <LinesField id="t-highlights" label="Highlights" value={f.highlights!} onChange={(v) => set('highlights', v)} />
        </Section>

        <Section title="Date, price and seats">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Departure date" htmlFor="t-date" error={e('departureDate')}><Input id="t-date" type="date" value={f.departureDate ?? ''} onChange={(ev) => set('departureDate', ev.target.value || null)} /></Field>
            <Field label="Departure time" htmlFor="t-time" hint="Used for the countdown"><Input id="t-time" type="time" value={f.departureTime ?? ''} onChange={(ev) => set('departureTime', ev.target.value || null)} /></Field>
            <Field label="Days" htmlFor="t-days" error={e('durationDays')}><Input id="t-days" type="number" min={1} value={f.durationDays} onChange={(ev) => set('durationDays', Number(ev.target.value) || 1)} /></Field>
            <Field label="Duration label" htmlFor="t-dlabel"><Input id="t-dlabel" value={f.durationLabel} onChange={(ev) => set('durationLabel', ev.target.value)} placeholder="2 days, 1 night" /></Field>
            <Field label="Price per person (₹)" htmlFor="t-price" error={e('priceInr')}><Input id="t-price" type="number" min={0} inputMode="numeric" value={f.priceInr ?? ''} onChange={(ev) => set('priceInr', num(ev.target.value))} /></Field>
            <Field label="Total seats" htmlFor="t-seats" hint="Leave empty for no limit" error={e('seatsTotal')}><Input id="t-seats" type="number" min={1} value={f.seatsTotal ?? ''} onChange={(ev) => set('seatsTotal', num(ev.target.value))} /></Field>
            <Field label="Booking status" htmlFor="t-status" hint="Automatic shows “Filling fast” under 30% seats left and “Sold out” at zero"><Select id="t-status" value={f.statusMode} onChange={(ev) => set('statusMode', ev.target.value as StatusMode)}>{STATUS_MODES.map((m) => <option key={m} value={m}>{STATUS_MODE_LABEL[m]}</option>)}</Select></Field>
          </div>
        </Section>

        <Section title="Pickup and return">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Pickup time" htmlFor="t-ptime"><Input id="t-ptime" value={f.pickupTime} onChange={(ev) => set('pickupTime', ev.target.value)} placeholder="4:00 AM" /></Field>
            <Field label="Pickup city" htmlFor="t-pcity"><Input id="t-pcity" value={f.pickupCity} onChange={(ev) => set('pickupCity', ev.target.value)} /></Field>
            <Field label="Pickup point" htmlFor="t-ppoint"><Input id="t-ppoint" value={f.pickupPoint} onChange={(ev) => set('pickupPoint', ev.target.value)} /></Field>
          </div>
          <Field label="Return schedule" htmlFor="t-return"><Input id="t-return" value={f.returnSchedule} onChange={(ev) => set('returnSchedule', ev.target.value)} /></Field>
        </Section>

        <Section title="Trek details">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Trek distance" htmlFor="t-dist"><Input id="t-dist" value={f.distanceLabel} onChange={(ev) => set('distanceLabel', ev.target.value)} placeholder="Approx. 8 km round trip" /></Field>
            <Field label="Time on the trail" htmlFor="t-tdur"><Input id="t-tdur" value={f.trekDurationLabel} onChange={(ev) => set('trekDurationLabel', ev.target.value)} placeholder="5–6 hours" /></Field>
            <Field label="Summit altitude (m)" htmlFor="t-alt"><Input id="t-alt" type="number" value={f.altitudeM ?? ''} onChange={(ev) => set('altitudeM', num(ev.target.value))} /></Field>
            <Field label="Suitable age group" htmlFor="t-age" optional hint="Leave empty if you don’t set one"><Input id="t-age" value={f.ageGroup ?? ''} onChange={(ev) => set('ageGroup', ev.target.value || null)} /></Field>
          </div>
          <Field label="Fitness you’ll need" htmlFor="t-fit"><Textarea id="t-fit" className="min-h-20" value={f.fitness} onChange={(ev) => set('fitness', ev.target.value)} /></Field>
          <div>
            <p className="mb-2 text-sm font-semibold">Elevation profile <span className="font-normal text-muted">(optional, shows a chart on the trip page)</span></p>
            <RowsEditor rows={f.elevation!} onChange={(r) => set('elevation', r)} blank={{ km: 0, m: 0, label: '' }} addLabel="Add point" render={(r, s, i) => (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input aria-label={`Point ${i + 1} distance in km`} type="number" step="0.1" value={r.km} onChange={(ev) => s({ ...r, km: Number(ev.target.value) })} placeholder="km" />
                <Input aria-label={`Point ${i + 1} altitude in m`} type="number" value={r.m} onChange={(ev) => s({ ...r, m: Number(ev.target.value) })} placeholder="metres" />
                <Input aria-label={`Point ${i + 1} label`} value={r.label ?? ''} onChange={(ev) => s({ ...r, label: ev.target.value })} placeholder="Label" />
              </div>
            )} />
          </div>
        </Section>

        <Section title="Photos and video" intro="Upload JPG, PNG or WebP. The first gallery photo shows largest on the trip page.">
          <div className="flex flex-wrap items-end gap-4">
            <ImageThumb url={f.coverImage.url || null} alt="Cover" className="h-28 w-44" />
            <div className="grid gap-2">
              <p className="text-sm font-semibold">Cover photo</p>
              <UploadButton folder="trips" label="Upload cover" onUploaded={(r) => set('coverImage', { url: r.url, alt: f.coverImage.alt || r.name, kind: 'image' })} />
              <Input aria-label="Cover photo description" value={f.coverImage.alt} onChange={(ev) => set('coverImage', { ...f.coverImage, alt: ev.target.value })} placeholder="Describe the photo for screen readers" />
            </div>
          </div>
          {e('coverImage.url') && <p className="text-sm text-[#9F2D1F]">Add a cover photo</p>}
          <div className="grid gap-3">
            <p className="text-sm font-semibold">Gallery</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {f.gallery!.map((m, i) => (
                <li key={m.url + i} className="flex gap-3 rounded-xl bg-paper p-2 ring-1 ring-line">
                  {m.kind === 'video' ? <span className="grid h-16 w-20 place-items-center rounded-lg bg-ink text-cream"><Video size={18} /></span> : <ImageThumb url={m.url} alt="" className="h-16 w-20" />}
                  <div className="grid min-w-0 flex-1 gap-1">
                    <Input aria-label={`Gallery item ${i + 1} description`} className="h-9 text-sm" value={m.alt} onChange={(ev) => set('gallery', f.gallery!.map((x, j) => (j === i ? { ...x, alt: ev.target.value } : x)))} placeholder="Description" />
                    <button type="button" className="justify-self-start text-sm font-semibold text-[#9F2D1F]" onClick={() => set('gallery', f.gallery!.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <UploadButton folder="trips" multiple label="Add photos" onUploaded={(r) => setF((x) => ({ ...x!, gallery: [...x!.gallery!, { url: r.url, alt: r.name, kind: r.kind } as MediaItem] }))} />
              <UploadButton folder="trips" label="Add video" accept="video/mp4,video/webm" onUploaded={(r) => setF((x) => ({ ...x!, gallery: [...x!.gallery!, { url: r.url, alt: r.name, kind: 'video' } as MediaItem] }))} />
            </div>
          </div>
        </Section>

        <Section title="Itinerary" intro="Use real times where you have them, and phrases like “Morning” where you don’t.">
          <RowsEditor rows={f.itinerary!} onChange={(r) => set('itinerary', r)} blank={{ time: '', title: '', detail: '' }} addLabel="Add step" render={(r, s, i) => (
            <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
              <Input aria-label={`Step ${i + 1} time`} value={r.time} onChange={(ev) => s({ ...r, time: ev.target.value })} placeholder="4:00 AM" />
              <Input aria-label={`Step ${i + 1} title`} value={r.title} onChange={(ev) => s({ ...r, title: ev.target.value })} placeholder="What happens" />
              <Textarea aria-label={`Step ${i + 1} detail`} className="min-h-16 sm:col-span-2" value={r.detail ?? ''} onChange={(ev) => s({ ...r, detail: ev.target.value })} placeholder="Details (optional)" />
            </div>
          )} />
        </Section>

        <Section title="What’s included">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUSION_KEYS.map((k) => {
              const item = f.inclusions!.find((i) => i.key === k);
              return (
                <div key={k} className={cn('flex items-center gap-2 rounded-xl p-2.5 ring-1', hasIncl(k) ? 'bg-sage/60 ring-forest/30' : 'bg-paper ring-line')}>
                  <input id={`inc-${k}`} type="checkbox" className="size-4 accent-[var(--color-forest)]" checked={hasIncl(k)} onChange={(ev) => set('inclusions', ev.target.checked ? [...f.inclusions!, { key: k, label: INCLUSION_LABEL[k] }] : f.inclusions!.filter((i) => i.key !== k))} />
                  {item ? <Input aria-label={`Label for ${INCLUSION_LABEL[k]}`} className="h-9 text-sm" value={item.label} onChange={(ev) => set('inclusions', f.inclusions!.map((i) => (i.key === k ? { ...i, label: ev.target.value } : i)))} /> : <label htmlFor={`inc-${k}`} className="text-sm">{INCLUSION_LABEL[k]}</label>}
                </div>
              );
            })}
          </div>
          <LinesField id="t-excl" label="Not included" value={f.exclusions!} onChange={(v) => set('exclusions', v)} />
        </Section>

        <Section title="Good to know">
          <div className="grid gap-5 md:grid-cols-2">
            <LinesField id="t-carry" label="Things to carry" value={f.thingsToCarry!} onChange={(v) => set('thingsToCarry', v)} />
            <LinesField id="t-safety" label="Safety guidelines" value={f.safety!} onChange={(v) => set('safety', v)} />
            <LinesField id="t-cancel" label="Cancellation policy" value={f.cancellationPolicy!} onChange={(v) => set('cancellationPolicy', v)} />
            <LinesField id="t-terms" label="Booking terms" value={f.bookingTerms!} onChange={(v) => set('bookingTerms', v)} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">FAQs</p>
            <RowsEditor rows={f.faqs!} onChange={(r) => set('faqs', r)} blank={{ q: '', a: '' }} addLabel="Add question" render={(r, s, i) => (
              <div className="grid gap-2">
                <Input aria-label={`Question ${i + 1}`} value={r.q} onChange={(ev) => s({ ...r, q: ev.target.value })} placeholder="Question" />
                <Textarea aria-label={`Answer ${i + 1}`} className="min-h-16" value={r.a} onChange={(ev) => s({ ...r, a: ev.target.value })} placeholder="Answer" />
              </div>
            )} />
          </div>
        </Section>

        <Section title="Trip leaders" intro="Shown as “Meet your travel crew” on the trip page.">
          <div className="grid gap-2 sm:grid-cols-2">
            {leaders.data?.map((l) => (
              <label key={l.id} className="flex items-center gap-3 rounded-xl bg-paper p-3 ring-1 ring-line">
                <input type="checkbox" className="size-4 accent-[var(--color-forest)]" checked={f.leaderIds!.includes(l.id)} onChange={(ev) => set('leaderIds', ev.target.checked ? [...f.leaderIds!, l.id] : f.leaderIds!.filter((x) => x !== l.id))} />
                <ImageThumb url={l.photoUrl} alt="" className="size-9" />
                <span className="min-w-0"><span className="block truncate font-semibold">{l.name}</span><span className="text-sm text-muted">{LEADER_ROLE_LABEL[l.role]}</span></span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Visibility">
          <div className="flex flex-wrap gap-6">
            <Toggle id="t-pub" label="Published on the website" checked={!!f.isPublished} onChange={(v) => set('isPublished', v)} />
            <Toggle id="t-feat" label="Featured on the homepage" checked={!!f.isFeatured} onChange={(v) => set('isFeatured', v)} />
            <Toggle id="t-demo" label="Sample trip (booking off, “Sample” badge)" checked={!!f.isDemo} onChange={(v) => set('isDemo', v)} />
          </div>
        </Section>

        {canWrite && <div className="flex justify-end"><Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? 'Saving…' : isNew ? 'Create trip' : 'Save changes'}</Button></div>}
      </fieldset>
    </form>
  );
}
