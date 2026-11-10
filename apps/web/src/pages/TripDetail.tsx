import { useState, type ReactNode } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, IndianRupee, MapPin, Mountain, Route, Timer, Gauge, HeartPulse, Users, Undo2, Check, X, MessageCircle, ChevronDown, Minus, Plus, ShieldCheck, Backpack, FileText, Ban, Info } from 'lucide-react';
import {
  CATEGORY_LABEL, DIFFICULTY_LABEL, DIFFICULTY_LEVEL, LEADER_ROLE_LABEL, formatDate, formatDateLong, formatINR, isBookable,
  computeTotal, tripEnquiryMessage, waLink, isPlaceholder, dayOfMonth, monthShort, type TripView, type Leader,
} from '@jzt/shared';
import { useTrip, useLeaders, useSettings } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { cn } from '../lib/cn';
import { img } from '../lib/images';
import { SITE_URL } from '../lib/config';
import { Img, Txt, StatusPill, SampleTag, Skeleton, ErrorState, Lightbox, ButtonLink, ButtonA, Button, Polaroid, PostageStamp, Wave, buttonClass } from '../components/ui';
import { SeatMeter, Countdown, ElevationProfile, Itinerary, InclusionGrid } from '../components/trips';
import { LeaderStats } from '../components/people';
import NotFound from './NotFound';

const SECTIONS = [
  ['overview', 'Overview'], ['gallery', 'Gallery'], ['itinerary', 'Itinerary'], ['inclusions', 'What’s included'], ['crew', 'Your crew'], ['info', 'Good to know'],
] as const;

function Section({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-36 border-t border-line pt-10', className)} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-[2rem] font-bold leading-tight md:text-[2.4rem]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <Icon size={20} className="mt-0.5 shrink-0 text-forest" aria-hidden />
      <div className="min-w-0">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="font-semibold leading-snug">{children}</dd>
      </div>
    </div>
  );
}

function Accordion({ icon: Icon, title, children, open }: { icon: typeof Clock; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-2xl bg-white ring-1 ring-line [&_summary::-webkit-details-marker]:hidden" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 font-semibold">
        <Icon size={20} className="text-forest" aria-hidden />
        <span className="flex-1 text-lg">{title}</span>
        <ChevronDown size={20} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

function BulletList({ items, icon: Icon = Check, tone = 'text-forest' }: { items: string[]; icon?: typeof Check; tone?: string }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5"><Icon size={18} className={cn('mt-1 shrink-0', tone)} aria-hidden /><Txt>{t}</Txt></li>
      ))}
    </ul>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="flex items-center rounded-full bg-paper ring-1 ring-line">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className="grid size-10 place-items-center rounded-full disabled:opacity-30" aria-label="One fewer traveller"><Minus size={16} /></button>
      <output className="w-8 text-center font-semibold tabular" aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid size-10 place-items-center rounded-full disabled:opacity-30" aria-label="One more traveller"><Plus size={16} /></button>
    </div>
  );
}

function BookingPanel({ trip }: { trip: TripView }) {
  const s = useSettings();
  const navigate = useNavigate();
  const max = Math.min(20, trip.seatsLeft ?? 20);
  const [n, setN] = useState(1);
  const bookable = isBookable(trip);
  return (
    <div className="ticket-notch rounded-[var(--radius-ticket)] bg-white shadow-[0_20px_50px_-30px_rgba(16,61,43,.55)] ring-1 ring-line [--notch-at:7.4rem]">
      <div className="flex items-start justify-between gap-3 p-6 pb-5">
        <div>
          <p className="text-sm text-muted">{trip.isDemo ? 'Sample price per person' : 'Price per person'}</p>
          <p className="font-display text-[2.6rem] font-extrabold leading-none tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'}</p>
        </div>
        <StatusPill status={trip.status} />
      </div>
      <div className="mx-6 border-t-2 border-dashed border-line" />
      <dl className="grid gap-3 p-6 pb-4 text-[0.95rem]">
        <div className="flex justify-between gap-3"><dt className="text-muted">Departure</dt><dd className="text-right font-semibold">{formatDate(trip.departureDate)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Pickup</dt><dd className="text-right font-semibold">{trip.pickupTime}{trip.pickupCity ? `, ${trip.pickupCity}` : ''}</dd></div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Available seats</dt>
          <dd className="text-right font-semibold">{trip.seatsLeft != null ? `${trip.seatsLeft} of ${trip.seatsTotal}` : 'Confirmed on WhatsApp'}</dd>
        </div>
      </dl>
      {trip.seatsTotal != null && <div className="px-6 pb-4"><SeatMeter trip={trip} /></div>}
      {bookable ? (
        <div className="grid gap-4 border-t border-line p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Travellers</span>
            <Stepper value={n} onChange={setN} max={max} />
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted">Total <span className="text-sm">({formatINR(trip.priceInr!)} × {n})</span></span>
            <span className="font-display text-2xl font-bold tabular">{formatINR(computeTotal(trip.priceInr!, n))}</span>
          </div>
          <Button size="lg" onClick={() => navigate(`/trips/${trip.slug}/book?n=${n}`)}>Book now</Button>
          <ButtonA href={waLink(s.whatsappNumber, tripEnquiryMessage(trip))} variant="ghost" size="sm"><MessageCircle size={16} /> Ask a question first</ButtonA>
        </div>
      ) : (
        <div className="grid gap-3 border-t border-line p-6">
          <p className="text-sm text-muted">
            {trip.isDemo ? 'This is a sample trip, so booking is switched off. Replace it with a real trip in the admin dashboard.' : trip.status === 'sold_out' ? 'This trip is sold out. Message us to join the waitlist.' : trip.status === 'departed' ? 'This trip has already happened.' : 'Booking opens once the date and price are confirmed.'}
          </p>
          <ButtonA href={waLink(s.whatsappNumber, tripEnquiryMessage(trip))} variant="forest"><MessageCircle size={17} /> {trip.status === 'sold_out' ? 'Join the waitlist' : 'Get notified on WhatsApp'}</ButtonA>
        </div>
      )}
    </div>
  );
}

function CrewCard({ leader }: { leader: Leader }) {
  return (
    <article className="relative flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-forest">
        {leader.photoUrl ? <Img src={leader.photoUrl} alt={`Portrait of ${leader.name}`} className="h-full" /> : <div className="grid h-full place-items-center text-cream/70"><Mountain size={30} aria-hidden /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ember">{LEADER_ROLE_LABEL[leader.role]}</p>
        <h3 className="font-display text-xl font-bold leading-tight">
          <Link to={`/leaders/${leader.slug}`} className="after:absolute after:inset-0 after:content-['']">{isPlaceholder(leader.name) ? <Txt>{leader.name}</Txt> : leader.name}</Link>
        </h3>
        <Txt as="p" className="mt-1 text-sm text-muted">{leader.intro}</Txt>
        <div className="mt-2"><LeaderStats leader={leader} /></div>
        <span className="mt-2 inline-block text-sm font-semibold text-forest underline underline-offset-4">View profile</span>
      </div>
    </article>
  );
}

export default function TripDetail() {
  const { slug = '' } = useParams();
  const { data: trip, isLoading, error, refetch } = useTrip(slug);
  const { data: leaders } = useLeaders();
  const s = useSettings();
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (isLoading) {
    return <div className="gutter"><div className="shell grid gap-6 py-10"><Skeleton className="h-[50vh]" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /></div></div>;
  }
  if ((error as { status?: number })?.status === 404) return <NotFound what="trip" />;
  if (error || !trip) return <div className="gutter"><div className="shell py-16"><ErrorState onRetry={() => refetch()} /></div></div>;

  const bookable = isBookable(trip);
  const crew = trip.leaderIds.map((id) => leaders?.find((l) => l.id === id)).filter(Boolean) as Leader[];
  const gallery = trip.gallery.length ? trip.gallery : [trip.coverImage];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: trip.summary,
    touristType: 'Group travellers and solo travellers',
    itinerary: { '@type': 'Place', name: trip.destination, address: trip.region },
    ...(trip.priceInr != null && !trip.isDemo ? { offers: { '@type': 'Offer', price: trip.priceInr, priceCurrency: 'INR', availability: trip.status === 'sold_out' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock', url: `${SITE_URL}/trips/${trip.slug}`, validThrough: trip.departureDate ?? undefined } } : {}),
    provider: { '@type': 'TravelAgency', name: 'JoinZipTrip' },
  };

  return (
    <>
      <Seo title={trip.title} path={`/trips/${trip.slug}`} description={trip.summary} image={img(trip.coverImage.url)} jsonLd={jsonLd} noindex={trip.isDemo} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-sky">
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-sun/45 blur-2xl" />
        <div className="gutter relative">
          <div className="shell grid items-center gap-8 pb-10 pt-6 md:pb-14 md:pt-10 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
            <div className="flex min-w-0 flex-col gap-5">
              <nav aria-label="Breadcrumb" className="text-sm font-semibold text-forest/70">
                <Link to="/trips" className="hover:text-forest">Explore trips</Link> <span aria-hidden>/</span> {CATEGORY_LABEL[trip.category]}
              </nav>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={trip.status} />
                {trip.isDemo && <SampleTag className="text-ember">Sample trip: replace in admin</SampleTag>}
              </div>
              <h1 className="font-display text-[clamp(2.1rem,9vw,4.6rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-forest [overflow-wrap:anywhere]">{trip.destination}</h1>
              <p className="max-w-2xl text-lg text-ink/75 md:text-xl">{trip.summary}</p>
              <ul className="flex flex-wrap gap-2 text-sm font-semibold">
                {[
                  [CalendarDays, formatDateLong(trip.departureDate), 'bg-white'],
                  [Clock, trip.durationLabel, 'bg-sage'],
                  [IndianRupee, trip.priceInr != null ? `${formatINR(trip.priceInr)} per person` : 'Price TBA', 'bg-sun'],
                  ...(trip.altitudeM ? [[Mountain, `${trip.altitudeM.toLocaleString('en-IN')} m`, 'bg-peach']] : []),
                ].map(([Icon, label, bg]) => {
                  const I = Icon as typeof Clock;
                  return <li key={label as string} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5', bg as string)}><I size={15} aria-hidden /> {label as string}</li>;
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-4">
                {bookable ? <ButtonLink to={`/trips/${trip.slug}/book`} size="lg">Book now</ButtonLink> : <ButtonA href={waLink(s.whatsappNumber, tripEnquiryMessage(trip))} size="lg"><MessageCircle size={18} /> Ask on WhatsApp</ButtonA>}
                {trip.status !== 'departed' && <Countdown trip={trip} />}
              </div>
            </div>
            <div className="relative mx-auto h-[20rem] w-full max-w-md sm:h-[26rem]">
              <div className="absolute right-0 top-0 w-[52%]"><Polaroid src={trip.coverImage.url} alt={trip.coverImage.alt} caption={trip.destination} rotate={6} eager /></div>
              {gallery[0] && gallery[0].url !== trip.coverImage.url && (
                <div className="absolute left-0 top-[22%] w-[50%]"><Polaroid src={gallery[0].url} alt={gallery[0].alt} caption={trip.altitudeM ? `${trip.altitudeM.toLocaleString('en-IN')} m up` : trip.title} rotate={-5} eager /></div>
              )}
              {trip.departureDate && (
                <div className="absolute bottom-0 right-[12%]">
                  <PostageStamp tone="orange" rotate={8}>
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider">{monthShort(trip.departureDate)} {trip.departureDate.slice(0, 4)}</span>
                    <span className="font-display text-3xl font-extrabold leading-none tabular">{dayOfMonth(trip.departureDate)}</span>
                  </PostageStamp>
                </div>
              )}
            </div>
          </div>
        </div>
        <Wave from="bg-sky" to="text-cream" />
      </section>

      {/* Section nav */}
      <nav aria-label="On this page" className="sticky top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-30 border-b border-line bg-cream/95 backdrop-blur-sm">
        <div className="gutter">
          <ul className="shell flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {SECTIONS.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }} className="block whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold text-muted hover:bg-sky hover:text-forest">{label}</a></li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="gutter">
        <div className="shell grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
          <div className="flex min-w-0 flex-col gap-14">
            <Section id="overview" title="What makes it special" className="border-t-0 pt-0">
              <div className="prose-trip max-w-prose text-lg leading-relaxed">{trip.description.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
              {trip.highlights.length > 0 && (
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {trip.highlights.map((h) => <li key={h} className="flex gap-3 rounded-2xl bg-sage/60 p-4"><Check size={20} className="mt-0.5 shrink-0 text-forest" aria-hidden /><span className="font-medium">{h}</span></li>)}
                </ul>
              )}
              <dl className="mt-8 grid gap-3 sm:grid-cols-2">
                <Fact icon={Gauge} label="Difficulty">
                  <span className="flex items-center gap-2">{DIFFICULTY_LABEL[trip.difficulty]}
                    <span className="flex gap-0.5" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn('h-2 w-4 rounded-sm', i <= DIFFICULTY_LEVEL[trip.difficulty] ? 'bg-forest' : 'bg-ink/10')} />)}</span>
                  </span>
                </Fact>
                {trip.distanceLabel && <Fact icon={Route} label="Trek distance">{trip.distanceLabel}</Fact>}
                {trip.trekDurationLabel && <Fact icon={Timer} label="Time on the trail">{trip.trekDurationLabel}</Fact>}
                {trip.altitudeM && <Fact icon={Mountain} label="Summit altitude">{trip.altitudeM.toLocaleString('en-IN')} m ({Math.round(trip.altitudeM * 3.28084).toLocaleString('en-IN')} ft)</Fact>}
                {trip.ageGroup && <Fact icon={Users} label="Suitable for">{trip.ageGroup}</Fact>}
                <Fact icon={MapPin} label="Pickup">{trip.pickupTime}, {trip.pickupPoint}{trip.pickupCity && !trip.pickupPoint.includes(trip.pickupCity) ? `, ${trip.pickupCity}` : ''}</Fact>
                <Fact icon={Undo2} label="Return">{trip.returnSchedule}</Fact>
                {trip.fitness && <div className="sm:col-span-2"><Fact icon={HeartPulse} label="Fitness you’ll need">{trip.fitness}</Fact></div>}
              </dl>
              {trip.elevation.length > 1 && <ElevationProfile points={trip.elevation} className="mt-8" />}
            </Section>

            <Section id="gallery" title="Photos">
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {gallery.map((m, i) => (
                  <li key={m.url + i} className={cn(i === 0 && 'col-span-2 row-span-2')}>
                    <button onClick={() => setLightbox(i)} className="group relative block h-full w-full overflow-hidden rounded-2xl" aria-label={`Enlarge photo: ${m.alt}`}>
                      <Img src={m.url} alt={m.alt} ratio={i === 0 ? undefined : 1} className={cn(i === 0 && 'h-full min-h-64')} imgClassName={cn('transition-transform duration-700 group-hover:scale-[1.04]', m.url === 'asset:poster' && 'object-top')} />
                      {m.caption && <span className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-cream">{m.caption}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <Lightbox items={gallery} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
            </Section>

            {trip.itinerary.length > 0 && (
              <Section id="itinerary" title="The day, step by step">
                <Itinerary steps={trip.itinerary} />
                <p className="mt-6 flex gap-2 rounded-xl bg-cream p-4 text-sm text-muted"><Info size={18} className="shrink-0 text-forest" aria-hidden /> Timings after pickup are approximate. Your trip leader shares the exact plan with the group before departure.</p>
              </Section>
            )}

            <Section id="inclusions" title="Package includes">
              <InclusionGrid items={trip.inclusions} />
              {trip.exclusions.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold">Not included</h3>
                  <div className="mt-3"><BulletList items={trip.exclusions} icon={X} tone="text-ember" /></div>
                </div>
              )}
            </Section>

            <Section id="crew" title="Meet your travel crew">
              <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
                <div className="grid gap-3">
                  {crew.length ? crew.map((l) => <CrewCard key={l.id} leader={l} />) : <p className="rounded-2xl bg-white p-5 text-muted ring-1 ring-line">Your trip leader will be announced before departure.</p>}
                </div>
                <div className="flex flex-col gap-3 rounded-2xl bg-forest p-5 text-cream">
                  <p className="font-display text-xl font-bold">The group</p>
                  <ul className="grid gap-2.5 text-[0.95rem]">
                    <li className="flex gap-2"><Users size={18} className="mt-0.5 shrink-0 text-orange" aria-hidden />{trip.seatsBooked > 0 ? `${trip.seatsBooked} traveller${trip.seatsBooked === 1 ? '' : 's'} confirmed so far` : 'Be one of the first to confirm'}</li>
                    <li className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0 text-orange" aria-hidden />Solo travellers welcome</li>
                    <li className="flex gap-2"><MapPin size={18} className="mt-0.5 shrink-0 text-orange" aria-hidden />Everyone meets at {trip.pickupTime}, {trip.pickupPoint.replace(/^Near/, 'near')}</li>
                  </ul>
                  {trip.seatsTotal != null && <SeatMeter trip={trip} light />}
                </div>
              </div>
            </Section>

            <Section id="info" title="Good to know">
              <div className="grid gap-3">
                <Accordion icon={Backpack} title="Things to carry" open><BulletList items={trip.thingsToCarry} /></Accordion>
                <Accordion icon={ShieldCheck} title="Safety guidelines"><BulletList items={trip.safety} icon={ShieldCheck} /></Accordion>
                <Accordion icon={Ban} title="Cancellation policy"><BulletList items={trip.cancellationPolicy} icon={Info} /></Accordion>
                <Accordion icon={FileText} title="Booking terms"><BulletList items={trip.bookingTerms} icon={Info} /></Accordion>
              </div>
              {trip.faqs.length > 0 && (
                <div className="mt-10">
                  <h3 className="font-display text-2xl font-bold">Questions people ask</h3>
                  <div className="mt-4 divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                    {trip.faqs.map((f) => (
                      <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold">{f.q}<ChevronDown size={20} className="mt-0.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden /></summary>
                        <p className="mt-3 text-muted">{f.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>

          <aside className="hidden lg:block" aria-label="Book this trip">
            <div className="sticky top-[calc(9rem+env(safe-area-inset-top,0px))]"><BookingPanel trip={trip} /></div>
          </aside>
          <div className="lg:hidden" id="book"><BookingPanel trip={trip} /></div>
        </div>
      </div>

      <div className="h-16 lg:hidden" aria-hidden />
      {/* Mobile sticky booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur-sm lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="gutter flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-none tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'} <span className="font-sans text-sm font-normal text-muted">/ person</span></p>
            <p className="truncate text-sm text-muted">{formatDate(trip.departureDate, { year: false })} · {trip.seatsLeft != null ? `${trip.seatsLeft} seats left` : trip.pickupCity}</p>
          </div>
          {bookable ? <Link to={`/trips/${trip.slug}/book`} className={buttonClass('primary', 'md')}>Book now</Link> : <a href={waLink(s.whatsappNumber, tripEnquiryMessage(trip))} target="_blank" rel="noopener noreferrer" className={buttonClass('forest', 'md')}><MessageCircle size={17} /> Ask</a>}
        </div>
      </div>
    </>
  );
}
