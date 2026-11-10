import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Phone, MessageCircle, Camera, Mail, ChevronDown, CheckCircle2, Star, Search } from 'lucide-react';
import { reviewInputSchema, passportLookupSchema, waLink, type ReviewInput, type PassportStamp } from '@jzt/shared';
import { api, ApiError } from '../lib/api';
import { useReviews, useSettings, useTrips } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { img, LOGO } from '../lib/images';
import { IS_DEMO } from '../lib/config';
import { PageHero, instaUrl } from '../components/layout';
import { Field, Input, Textarea, Button, ButtonA, ButtonLink, Skeleton, ErrorState, EmptyState, CopyButton, Img } from '../components/ui';
import { ReviewCard, PassportStampBadge } from '../components/people';
import { FinalCta } from './Home';

function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fromZod = (issues: { path: (string | number)[]; message: string }[]) => setErrors(Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message])));
  const clear = (k: string) => errors[k] && setErrors(({ [k]: _, ...r }) => r);
  return { errors, setErrors, fromZod, clear };
}

// ---------------------------------------------------------------- Reviews
export function Reviews() {
  const { data: reviews, isLoading, isError, refetch } = useReviews();
  const s = useSettings();
  const [shown, setShown] = useState(6);
  const real = (reviews ?? []).filter((r) => !r.isDemo);
  const avg = real.length ? real.reduce((a, r) => a + r.rating, 0) / real.length : null;
  return (
    <>
      <Seo title="Traveller reviews" path="/reviews" description="What travellers say after trekking with JoinZipTrip. Every review is from a real traveller and approved before it appears." />
      <PageHero title="Traveller reviews" intro="Reviews are written by people who travelled with us. We read every one before it goes live, and we never edit what people say.">
        <div className="mt-8 flex flex-wrap items-center gap-6">
          {avg != null ? (
            <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-extrabold tabular">{avg.toFixed(1)}</span><span className="text-muted">average from {real.length} review{real.length === 1 ? '' : 's'}</span></p>
          ) : (
            <p className="text-muted">No ratings yet. Our first group travels soon.</p>
          )}
          {s.googleReviewsUrl && <ButtonA href={s.googleReviewsUrl} variant="outline">See our Google reviews</ButtonA>}
        </div>
      </PageHero>
      <section className="gutter">
        <div className="shell py-12">
          {IS_DEMO && <p className="mb-6 rounded-xl bg-cream p-4 text-sm text-muted">Sample cards are marked. Real reviews submitted below go to Admin → Reviews for approval.</p>}
          {isLoading && <div className="grid gap-5 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}</div>}
          {isError && <ErrorState onRetry={() => refetch()} />}
          {reviews && reviews.length === 0 && <EmptyState title="Be the first to review">Travelled with us? Your review helps the next person decide.</EmptyState>}
          {reviews && reviews.length > 0 && (
            <>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{reviews.slice(0, shown).map((r) => <ReviewCard key={r.id} review={r} />)}</div>
              {reviews.length > shown && <Button variant="outline" className="mt-8" onClick={() => setShown((n) => n + 6)}>Show more reviews</Button>}
            </>
          )}
        </div>
      </section>
      <ReviewForm />
    </>
  );
}

function ReviewForm() {
  const { data: trips } = useTrips();
  const { errors, fromZod, clear } = useFieldErrors();
  const [form, setForm] = useState<ReviewInput & { rating: number }>({ name: '', tripName: '', rating: 0, body: '', experienceDate: null, bookingRef: '', website: '' });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm((f) => ({ ...f, [k]: v })); clear(k as string); };
  const m = useMutation({ mutationFn: api.submitReview });
  const tripNames = Array.from(new Set((trips ?? []).filter((t) => !t.isDemo).map((t) => t.title)));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = reviewInputSchema.safeParse({ ...form, rating: form.rating || undefined, experienceDate: form.experienceDate || null });
    if (!p.success) return fromZod(p.error.issues);
    m.mutate(p.data);
  }
  return (
    <section id="write" className="scroll-mt-24 bg-cream">
      <div className="gutter">
        <div className="shell grid gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:py-24">
          <div>
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight">Travelled with us? Write a review.</h2>
            <p className="mt-4 text-lg text-muted">Add your booking reference and we’ll mark your review as from a verified traveller. Reviews appear after a quick check by our team.</p>
          </div>
          {m.isSuccess ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-white p-8 ring-1 ring-line" role="status">
              <CheckCircle2 className="text-forest" size={36} />
              <p className="font-display text-2xl font-bold">Thanks, your review is in.</p>
              <p className="text-muted">It will appear on the site once our team approves it.</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl bg-white p-6 ring-1 ring-line md:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your name" htmlFor="r-name" error={errors.name}><Input id="r-name" value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} autoComplete="name" /></Field>
                <Field label="Trip you joined" htmlFor="r-tripName" error={errors.tripName}>
                  <Input id="r-tripName" list="r-trips" value={form.tripName} onChange={(e) => set('tripName', e.target.value)} invalid={!!errors.tripName} />
                  <datalist id="r-trips">{tripNames.map((t) => <option key={t} value={t} />)}</datalist>
                </Field>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold">Your rating</legend>
                <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => set('rating', n)} className="rounded-lg p-1 text-orange">
                      <Star size={30} fill={n <= form.rating ? 'currentColor' : 'none'} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
                {errors.rating && <p className="mt-1 text-sm font-medium text-[#9F2D1F]" role="alert">Choose a rating from 1 to 5 stars</p>}
              </fieldset>
              <Field label="Your review" htmlFor="r-body" error={errors.body}><Textarea id="r-body" value={form.body} onChange={(e) => set('body', e.target.value)} invalid={!!errors.body} maxLength={1200} placeholder="What was the best part? Who should do this trip?" /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Date of your trip" htmlFor="r-date" optional error={errors.experienceDate}><Input id="r-date" type="date" value={form.experienceDate ?? ''} onChange={(e) => set('experienceDate', e.target.value || null)} /></Field>
                <Field label="Booking reference" htmlFor="r-ref" optional hint="Looks like JZT-7K3QX" error={errors.bookingRef}><Input id="r-ref" value={form.bookingRef} onChange={(e) => set('bookingRef', e.target.value.toUpperCase())} /></Field>
              </div>
              <div className="hidden" aria-hidden><input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} /></div>
              {m.isError && <p className="font-medium text-[#9F2D1F]" role="alert">{(m.error as Error).message}</p>}
              <Button type="submit" size="lg" disabled={m.isPending} className="justify-self-start">{m.isPending ? 'Sending…' : 'Submit review'}</Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- About
export function About() {
  return (
    <>
      <Seo title="About us" path="/about" description="JoinZipTrip (ZipTrip Travels) runs treks, weekend getaways and group trips from Mysuru for people who want to travel together." />
      <section className="bg-cream">
        <div className="gutter">
          <div className="shell grid items-center gap-12 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
            <div>
              <h1 className="font-display text-[clamp(2.8rem,7vw,5.4rem)] font-extrabold leading-[0.95] tracking-[-0.02em]">Don’t just travel. Find your tribe.</h1>
              <p className="mt-6 max-w-xl text-xl text-muted">JoinZipTrip organises treks, weekend getaways and group trips where you can book on your own and travel with strangers, friends or like-minded people.</p>
            </div>
            <div className="relative mx-auto w-full max-w-sm">
              <Img src="asset:poster" alt="The JoinZipTrip poster for the first official trip, a one-day trek to Thadiyandamol" ratio="natural" className="rotate-2 rounded-2xl shadow-[0_30px_60px_-30px_rgba(16,61,43,.6)]" imgClassName="object-top" />
              <img src={LOGO} alt="" aria-hidden className="absolute -bottom-6 -left-6 size-24 -rotate-6 rounded-full ring-4 ring-cream" />
            </div>
          </div>
        </div>
      </section>
      <section className="gutter">
        <div className="shell grid gap-12 py-16 md:grid-cols-2 md:py-24">
          <div>
            <h2 className="font-display text-4xl font-bold">Why we started</h2>
            <div className="prose-trip mt-5 max-w-prose text-lg leading-relaxed text-ink/85">
              <p>Our goal isn’t simply to sell travel packages. We want to build a community where people meet new friends, explore new places, try new adventures and come home with stories worth telling.</p>
              <p>Too many good trips never happen because nobody else is free that weekend. So we plan the route, the transport, the meals and the permits, and we bring the people. All you have to do is say yes.</p>
            </div>
          </div>
          <div className="grid gap-4 self-start">
            {[
              ['New destinations', 'Treks and trips across the Western Ghats and beyond, starting from Mysuru.'],
              ['New people', 'Every trip is open to solo travellers. Most groups are a mix of people meeting for the first time.'],
              ['Unforgettable stories', 'We plan the day so you can be present for it, then share the photos after.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-6 ring-1 ring-line"><p className="font-display text-2xl font-bold">{t}</p><p className="mt-1 text-muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-forest text-cream">
        <div className="gutter">
          <div className="shell grid gap-8 py-16 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-orange">Where it begins</p>
              <h2 className="mt-2 font-display text-4xl font-bold">Our first official trip: Thadiyandamol, Sunday 22 November 2026</h2>
              <p className="mt-3 max-w-2xl text-cream/80">A one-day trek to the highest peak in Coorg, with pickup from Mysuru at 4:00 AM. ₹1,699 per person, all inclusive.</p>
            </div>
            <ButtonLink to="/trips/thadiyandamol-trek" size="lg">See the trip</ButtonLink>
          </div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}

// ---------------------------------------------------------------- Contact
const FAQ = [
  ['Can I join a trip alone?', 'Yes. Our trips are designed for solo travellers as much as for friends and groups. Book one seat and you’ll meet the group at pickup.'],
  ['How do I book?', 'Open any trip, tap Book now and fill in a short form. It opens WhatsApp with your details ready to send. We reply with payment details and confirm your seat once payment is received.'],
  ['Where do trips start?', 'Most trips start from Mysuru. Each trip page shows the exact pickup point and time.'],
  ['Can you organise a trip for my group or company?', 'Yes. Tap “Group booking” or “Custom trip” on this page and tell us your dates and group size on WhatsApp.'],
  ['Do I need trekking experience?', 'Not for most trips. Each trip page lists the difficulty and the fitness you’ll need.'],
];

const ENQUIRIES = [
  { label: 'Ask about an upcoming trip', text: 'Hi JoinZipTrip! I have a question about an upcoming trip.' },
  { label: 'Group booking', text: 'Hi JoinZipTrip! I’d like to book for a group. Group size: \nPreferred trip and date: ' },
  { label: 'Custom trip', text: 'Hi JoinZipTrip! I’m interested in a custom trip. Destination: \nDates: \nNumber of people: ' },
  { label: 'Something else', text: 'Hi JoinZipTrip!' },
];

export function Contact() {
  const s = useSettings();
  return (
    <>
      <Seo title="Contact" path="/contact" description="WhatsApp JoinZipTrip on 8073271501 for trips, group bookings and custom trips, or follow us on Instagram for new dates." />
      <PageHero title="Talk to us" intro="All enquiries go through WhatsApp, so you get a reply from the team directly. Pick what it’s about and the message is started for you." />
      <section className="gutter">
        <div className="shell grid gap-10 py-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-5 rounded-[1.6rem] bg-forest p-6 text-cream md:p-8">
            <MessageCircle size={32} className="text-orange" aria-hidden />
            <h2 className="font-display text-3xl font-bold md:text-4xl">Enquire on WhatsApp</h2>
            <p className="max-w-md text-cream/80">Choose a topic. WhatsApp opens with a message ready to send to +91 {s.whatsappNumber.slice(2, 7)} {s.whatsappNumber.slice(7)}.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ENQUIRIES.map((e, i) => (
                <ButtonA key={e.label} href={waLink(s.whatsappNumber, e.text)} variant={i === 0 ? 'primary' : 'cream'} size="lg" className="justify-start whitespace-normal text-left">
                  <MessageCircle size={18} className="shrink-0" /> {e.label}
                </ButtonA>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <a href={instaUrl(s.instagramHandle)} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-[1.6rem] bg-ink p-7 text-cream">
              <img src={img('asset:grassland-trail')} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-700 group-hover:scale-105" />
              <div className="relative">
                <Camera size={30} className="text-orange" aria-hidden />
                <p className="mt-4 font-display text-3xl font-bold">Follow @{s.instagramHandle}</p>
                <p className="mt-2 max-w-sm text-cream/85">New trips, dates and photos from the trail land on Instagram first.</p>
                <span className="mt-5 inline-flex rounded-full bg-orange px-5 py-2.5 font-semibold text-ink">Open Instagram</span>
              </div>
            </a>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.phones.map((p) => (
                <div key={p} className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-line">
                  <Phone className="text-forest" size={22} aria-hidden />
                  <p className="font-display text-2xl font-bold tabular select-all">+91 {p.slice(0, 5)} {p.slice(5)}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`tel:+91${p}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-3.5 text-sm font-semibold text-cream"><Phone size={14} /> Call</a>
                    <CopyButton text={`+91${p}`} />
                  </div>
                </div>
              ))}
            </div>
            <p className="flex items-center gap-2 text-muted"><Mail size={18} aria-hidden /> <a className="select-all font-semibold text-ink" href={`mailto:${s.email}`}>{s.email}</a></p>
          </div>
        </div>
      </section>
      <section id="faq" className="scroll-mt-24 bg-cream">
        <div className="gutter">
          <div className="shell grid gap-8 py-16 md:grid-cols-[1fr_1.6fr] md:py-24">
            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight">Frequently asked questions</h2>
            <div className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold">{q}<ChevronDown size={20} className="mt-1 shrink-0 transition-transform group-open:rotate-180" aria-hidden /></summary>
                  <p className="mt-3 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- Passport
export function Passport() {
  const { data: trips } = useTrips();
  const { errors, fromZod, clear } = useFieldErrors();
  const [phone, setPhone] = useState('');
  const [ref, setRef] = useState('');
  const m = useMutation({ mutationFn: (v: { phone: string; ref: string }) => api.passport(v.phone, v.ref) });
  const destinations = Array.from(new Map((trips ?? []).filter((t) => !t.isDemo).map((t) => [t.destination, t])).values());
  const stamps: PassportStamp[] = m.data ?? [];
  const earned = new Set(stamps.map((s) => s.destination));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passportLookupSchema.safeParse({ phone, ref });
    if (!p.success) return fromZod(p.error.issues);
    m.mutate(p.data);
  }
  return (
    <>
      <Seo title="Adventure Passport" path="/passport" description="Your digital record of JoinZipTrip adventures, with a stamp for every destination." noindex />
      <PageHero tone="forest" title="Adventure Passport" intro="A stamp for every peak, falls and campsite you reach with us. Open yours with the mobile number and booking reference from any trip." />
      <section className="gutter">
        <div className="shell grid gap-10 py-12 lg:grid-cols-[22rem_1fr]">
          <form onSubmit={submit} noValidate className="grid h-fit gap-5 rounded-2xl bg-white p-6 ring-1 ring-line">
            <Field label="Mobile number" htmlFor="p-phone" error={errors.phone}><Input id="p-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => { setPhone(e.target.value); clear('phone'); }} invalid={!!errors.phone} /></Field>
            <Field label="Booking reference" htmlFor="p-ref" error={errors.ref} hint="From your booking confirmation, like JZT-7K3QX"><Input id="p-ref" value={ref} onChange={(e) => { setRef(e.target.value.toUpperCase()); clear('ref'); }} invalid={!!errors.ref} /></Field>
            {m.isError && <p className="font-medium text-[#9F2D1F]" role="alert">{(m.error as ApiError).message}</p>}
            <Button type="submit" disabled={m.isPending}><Search size={17} /> {m.isPending ? 'Opening…' : 'Open my passport'}</Button>
            <p className="text-sm text-muted">Stamps appear once a booking is confirmed. They turn solid after the trip.</p>
          </form>
          <div className="min-w-0 rounded-[1.6rem] bg-cream p-6 ring-1 ring-line md:p-10">
            {m.isPending && <Skeleton className="h-64" />}
            {!m.data && !m.isPending && (
              <div>
                <p className="font-display text-2xl font-bold">Stamps to collect</p>
                <p className="mt-1 text-muted">Destinations on our trip list right now.</p>
                <div className="mt-8 flex flex-wrap gap-8">{destinations.map((t, i) => <PassportStampBadge key={t.id} index={i} locked stamp={{ destination: t.destination, date: t.departureDate, altitudeM: t.altitudeM, state: 'upcoming' }} />)}</div>
              </div>
            )}
            {m.data && (
              <div>
                <p className="font-display text-3xl font-bold">{stamps.length ? `${stamps.filter((s) => s.state === 'completed').length} completed, ${stamps.filter((s) => s.state === 'upcoming').length} upcoming` : 'No confirmed trips yet'}</p>
                {stamps.length === 0 && <p className="mt-2 text-muted">Your booking is saved. Stamps appear once the team confirms your seat.</p>}
                <div className="mt-8 flex flex-wrap gap-8">
                  {stamps.map((s, i) => <PassportStampBadge key={s.bookingRef} index={i} stamp={s} />)}
                  {destinations.filter((t) => !earned.has(t.destination)).map((t, i) => <PassportStampBadge key={t.id} index={i + stamps.length} locked stamp={{ destination: t.destination, date: null, altitudeM: t.altitudeM, state: 'upcoming' }} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

