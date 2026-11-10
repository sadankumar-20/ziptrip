import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, MessageCircle, Minus, Plus, Lock, CreditCard, Pencil } from 'lucide-react';
import { bookingInputSchema, computeTotal, formatDateLong, formatINR, isBookable, tripEnquiryMessage, waLink, type BookingInput } from '@jzt/shared';
import { api, ApiError, type BookingResult } from '../lib/api';
import { useTrip, useSettings } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { cn } from '../lib/cn';
import { payWithRazorpay } from '../lib/razorpay';
import { Field, Input, Textarea, Button, ButtonA, ButtonLink, Skeleton, ErrorState, CopyButton, Img, StatusPill } from '../components/ui';
import NotFound from './NotFound';

type Form = Omit<BookingInput, 'tripSlug' | 'travellers' | 'consent'> & { travellers: number; consent: boolean };
const EMPTY: Form = { fullName: '', phone: '', email: '', travellers: 1, emergencyName: '', emergencyPhone: '', notes: '', consent: false, website: '' };
const STEPS = ['Your details', 'Review', 'Send'] as const;

export default function Book() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { data: trip, isLoading, error, refetch } = useTrip(slug);
  const s = useSettings();
  const qc = useQueryClient();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, travellers: Math.max(1, Math.min(20, Number(params.get('n')) || 1)) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BookingResult | null>(null);
  const [payState, setPayState] = useState<'idle' | 'paying' | 'paid' | 'error'>('idle');
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [step]);

  const mutation = useMutation({
    mutationFn: (input: BookingInput) => api.createBooking(input),
    onSuccess: (r) => {
      setResult(r);
      setStep(2);
      qc.invalidateQueries();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setStep(0); }
    },
  });

  if (isLoading) return <div className="gutter"><div className="shell grid gap-6 py-12"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-96" /></div></div>;
  if ((error as { status?: number })?.status === 404) return <NotFound what="trip" />;
  if (error || !trip) return <div className="gutter"><div className="shell py-16"><ErrorState onRetry={() => refetch()} /></div></div>;

  const maxSeats = Math.min(20, trip.seatsLeft ?? 20);
  const total = computeTotal(trip.priceInr ?? 0, form.travellers);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors(({ [k as string]: _, ...rest }) => rest);
  };

  function review(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bookingInputSchema.safeParse({ ...form, tripSlug: trip!.slug });
    if (!parsed.success) {
      const errs = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]));
      setErrors(errs);
      const first = Object.keys(errs)[0];
      setTimeout(() => document.getElementById(`b-${first}`)?.focus(), 30);
      return;
    }
    if (form.travellers > maxSeats) {
      setErrors({ travellers: `Only ${maxSeats} seat${maxSeats === 1 ? '' : 's'} left` });
      return;
    }
    setStep(1);
  }

  if (!isBookable(trip) && step !== 2) {
    return (
      <div className="gutter">
        <div className="shell max-w-2xl py-16">
          <h1 className="font-display text-4xl font-bold">{trip.title} isn’t open for booking</h1>
          <p className="mt-4 text-lg text-muted">{trip.isDemo ? 'This is a sample trip. Booking is switched off until a real trip replaces it.' : trip.status === 'sold_out' ? 'All seats are taken. Message us to join the waitlist.' : 'Booking opens once the date and price are confirmed.'}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonA href={waLink(s.whatsappNumber, tripEnquiryMessage(trip))} variant="forest"><MessageCircle size={17} /> Message us on WhatsApp</ButtonA>
            <ButtonLink to="/trips" variant="outline">See other trips</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];

  return (
    <>
      <Seo title={`Book ${trip.title}`} path={`/trips/${trip.slug}/book`} noindex />
      <div ref={topRef} className="scroll-mt-24 bg-cream">
        <div className="gutter">
          <div className="shell py-8 md:py-10">
            <Link to={`/trips/${trip.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"><ArrowLeft size={16} /> Back to trip</Link>
            <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-none">Book {trip.title}</h1>
            <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Booking steps">
              {STEPS.map((label, i) => (
                <li key={label} className={cn('flex items-center gap-2 text-sm font-semibold', i === step ? 'text-ink' : i < step ? 'text-forest' : 'text-muted')} aria-current={i === step ? 'step' : undefined}>
                  <span className={cn('grid size-7 place-items-center rounded-full text-xs tabular', i === step ? 'bg-orange text-ink' : i < step ? 'bg-forest text-cream' : 'bg-ink/10')}>{i < step ? '✓' : i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="gutter">
        <div className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <div className="min-w-0">
            {mutation.isError && !(mutation.error instanceof ApiError && Object.keys(mutation.error.fields).length) && (
              <div role="alert" className="mb-6 rounded-2xl border border-[#9F2D1F]/30 bg-[#9F2D1F]/5 p-4 font-medium text-[#7A2318]">
                {(mutation.error as Error).message}
              </div>
            )}

            {step === 0 && (
              <form onSubmit={review} noValidate className="grid gap-6">
                <fieldset className="grid gap-5 sm:grid-cols-2">
                  <legend className="mb-4 font-display text-2xl font-bold">Trip</legend>
                  <Field label="Selected trip" htmlFor="b-trip"><Input id="b-trip" value={trip.title} readOnly disabled /></Field>
                  <Field label="Departure date" htmlFor="b-date"><Input id="b-date" value={formatDateLong(trip.departureDate)} readOnly disabled /></Field>
                  <Field label="Number of travellers" htmlFor="b-travellers" error={err('travellers')} hint={trip.seatsLeft != null ? `${trip.seatsLeft} seats left` : 'Up to 20 per booking'}>
                    <div className="flex items-center gap-2">
                      <button type="button" className="grid size-12 place-items-center rounded-xl bg-white ring-1 ring-line disabled:opacity-40" onClick={() => set('travellers', Math.max(1, form.travellers - 1))} disabled={form.travellers <= 1} aria-label="One fewer traveller"><Minus size={18} /></button>
                      <Input id="b-travellers" type="number" inputMode="numeric" min={1} max={maxSeats} value={form.travellers} onChange={(e) => set('travellers', Math.max(1, Math.min(maxSeats, Number(e.target.value) || 1)))} className="w-20 text-center tabular" invalid={!!err('travellers')} />
                      <button type="button" className="grid size-12 place-items-center rounded-xl bg-white ring-1 ring-line disabled:opacity-40" onClick={() => set('travellers', Math.min(maxSeats, form.travellers + 1))} disabled={form.travellers >= maxSeats} aria-label="One more traveller"><Plus size={18} /></button>
                    </div>
                  </Field>
                </fieldset>

                <fieldset className="grid gap-5 sm:grid-cols-2">
                  <legend className="mb-4 font-display text-2xl font-bold">You</legend>
                  <Field label="Full name" htmlFor="b-fullName" error={err('fullName')} className="sm:col-span-2">
                    <Input id="b-fullName" autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} invalid={!!err('fullName')} placeholder="As on your photo ID" />
                  </Field>
                  <Field label="Mobile number" htmlFor="b-phone" error={err('phone')} hint="We’ll confirm your seat on WhatsApp">
                    <div className="flex">
                      <span className="grid h-12 place-items-center rounded-l-xl border border-r-0 border-line bg-paper px-3 text-muted">+91</span>
                      <Input id="b-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={(e) => set('phone', e.target.value)} invalid={!!err('phone')} className="rounded-l-none" placeholder="98XXX XXXXX" />
                    </div>
                  </Field>
                  <Field label="Email address" htmlFor="b-email" error={err('email')}>
                    <Input id="b-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} invalid={!!err('email')} placeholder="you@example.com" />
                  </Field>
                </fieldset>

                <fieldset className="grid gap-5 sm:grid-cols-2">
                  <legend className="mb-1 font-display text-2xl font-bold">Emergency contact</legend>
                  <p className="text-muted sm:col-span-2">Someone not on the trip we can call if needed.</p>
                  <Field label="Their name" htmlFor="b-emergencyName" error={err('emergencyName')}>
                    <Input id="b-emergencyName" value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} invalid={!!err('emergencyName')} />
                  </Field>
                  <Field label="Their mobile number" htmlFor="b-emergencyPhone" error={err('emergencyPhone')}>
                    <Input id="b-emergencyPhone" type="tel" inputMode="numeric" value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} invalid={!!err('emergencyPhone')} />
                  </Field>
                </fieldset>

                <Field label="Additional requirements" htmlFor="b-notes" optional hint="Dietary needs, medical conditions, or anything the trip leader should know" error={err('notes')}>
                  <Textarea id="b-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={600} />
                </Field>

                <div className="hidden" aria-hidden><label htmlFor="b-website">Website</label><input id="b-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} /></div>

                <div>
                  <label className="flex items-start gap-3">
                    <input id="b-consent" type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-forest)]" aria-invalid={!!err('consent') || undefined} />
                    <span>I’ve read the <Link to={`/trips/${trip.slug}#info`} className="font-semibold text-forest underline underline-offset-4">booking terms and safety guidelines</Link>, and the details above are correct.</span>
                  </label>
                  {err('consent') && <p className="mt-2 text-sm font-medium text-[#9F2D1F]" role="alert">{err('consent')}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" size="lg">Review booking</Button>
                  <span className="text-sm text-muted">Nothing is charged at this step.</span>
                </div>
              </form>
            )}

            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6">
                <h2 className="font-display text-3xl font-bold">Check your booking</h2>
                <dl className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                  {[
                    ['Trip', trip.title],
                    ['Date', formatDateLong(trip.departureDate)],
                    ['Pickup', `${trip.pickupTime}, ${trip.pickupPoint}`],
                    ['Travellers', String(form.travellers)],
                    ['Name', form.fullName],
                    ['Mobile', `+91 ${form.phone.replace(/\D/g, '').slice(-10)}`],
                    ['Email', form.email],
                    ['Emergency contact', `${form.emergencyName}, +91 ${form.emergencyPhone.replace(/\D/g, '').slice(-10)}`],
                    ...(form.notes ? [['Additional requirements', form.notes]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]"><dt className="text-muted">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>
                  ))}
                </dl>
                <div className="rounded-2xl bg-cream p-5">
                  <p className="font-semibold">What happens when you send</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                    <li>We save your booking and give you a booking reference.</li>
                    <li>WhatsApp opens with your details filled in. Tap send.</li>
                    <li>The JoinZipTrip team replies with payment details. Your seat is confirmed once payment is received.</li>
                  </ol>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => mutation.mutate({ ...form, tripSlug: trip.slug, consent: true })} disabled={mutation.isPending}>
                    {mutation.isPending ? 'Saving your booking…' : <><MessageCircle size={18} /> Send booking on WhatsApp</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setStep(0)} disabled={mutation.isPending}><Pencil size={16} /> Edit details</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && result && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid gap-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 size={40} className="shrink-0 text-forest" aria-hidden />
                  <div>
                    <h2 className="font-display text-3xl font-bold">Booking saved. One more tap.</h2>
                    <p className="mt-2 text-lg text-muted">Send the message on WhatsApp so the team can share payment details and confirm your seat.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-forest p-5 text-cream">
                  <div>
                    <p className="text-sm text-cream/70">Booking reference</p>
                    <p className="font-display text-3xl font-bold tracking-wide tabular">{result.booking.ref}</p>
                  </div>
                  <p className="text-sm text-cream/80 sm:ml-auto sm:max-w-56">Keep this. You’ll need it for your Adventure Passport and to leave a review.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonA href={result.whatsappUrl} size="lg"><MessageCircle size={18} /> Open WhatsApp to send</ButtonA>
                  <CopyButton text={result.message} label="Copy message" className="h-13 px-6" />
                  {s.paymentsEnabled && payState !== 'paid' && (
                    <Button variant="forest" size="lg" disabled={payState === 'paying'} onClick={async () => {
                      setPayState('paying');
                      try { setPayState((await payWithRazorpay(result.booking.ref, result.booking.phone)) === 'paid' ? 'paid' : 'idle'); } catch { setPayState('error'); }
                    }}><CreditCard size={18} /> Pay {formatINR(result.booking.totalInr)} online</Button>
                  )}
                </div>
                {payState === 'paid' && <p className="rounded-xl bg-sage p-4 font-semibold text-forest" role="status">Payment received. Your seat is confirmed.</p>}
                {payState === 'error' && <p className="rounded-xl bg-[#9F2D1F]/5 p-4 font-medium text-[#7A2318]" role="alert">The payment didn’t go through. You can still confirm on WhatsApp.</p>}
                <details className="rounded-2xl bg-white ring-1 ring-line">
                  <summary className="cursor-pointer p-4 font-semibold">Preview the WhatsApp message</summary>
                  <pre id="copy-fallback" className="overflow-x-auto whitespace-pre-wrap px-4 pb-4 font-sans text-sm text-muted">{result.message}</pre>
                </details>
                <p className="text-sm text-muted">WhatsApp didn’t open? Copy the message and send it to +91 {s.whatsappNumber.slice(2, 7)} {s.whatsappNumber.slice(7)}.</p>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink to={`/trips/${trip.slug}`} variant="outline">Back to the trip</ButtonLink>
                  <ButtonLink to="/tribe" variant="ghost">See how the group comes together</ButtonLink>
                </div>
              </motion.div>
            )}
          </div>

          {/* Live summary */}
          <aside aria-label="Booking summary" className="lg:sticky lg:top-24 lg:self-start">
            <div className="ticket-notch overflow-hidden rounded-[var(--radius-ticket)] bg-white ring-1 ring-line [--notch-at:11rem]">
              <Img src={trip.coverImage.url} alt={trip.coverImage.alt} ratio={16 / 9} />
              <div className="p-5">
                <div className="flex items-center justify-between gap-2"><p className="font-display text-2xl font-bold leading-tight">{trip.title}</p><StatusPill status={trip.status} /></div>
                <p className="mt-1 text-sm text-muted">{formatDateLong(trip.departureDate)}</p>
              </div>
              <div className="mx-5 border-t-2 border-dashed border-line" />
              <dl className="grid gap-2 p-5 text-[0.95rem]">
                <div className="flex justify-between"><dt className="text-muted">Price per person</dt><dd className="tabular">{formatINR(trip.priceInr ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Travellers</dt><dd className="tabular">× {form.travellers}</dd></div>
                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3"><dt className="font-semibold">Total</dt><dd className="font-display text-3xl font-bold tabular" aria-live="polite">{formatINR(total)}</dd></div>
              </dl>
              <p className="flex items-center gap-2 border-t border-line bg-paper px-5 py-3 text-xs text-muted"><Lock size={14} aria-hidden /> Price is confirmed by our server when you send.</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
