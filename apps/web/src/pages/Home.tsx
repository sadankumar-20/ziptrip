import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, Mountain, Tent, Camera, Footprints, Users, Route, Bus, Images } from 'lucide-react';
import { formatDate, formatINR, isBookable, waLink, type TripView } from '@jzt/shared';
import { useTrips, useAlbums, useLeaders, useReviews, useSettings } from '../lib/hooks';
import { CONTOURS, img } from '../lib/images';
import { Seo } from '../lib/seo';
import { cn } from '../lib/cn';
import { IS_DEMO } from '../lib/config';
import { ButtonLink, ButtonA, Select, Skeleton, ErrorState, EmptyState, SectionHeading, SampleTag, buttonClass } from '../components/ui';
import { TripCard, FeaturedTrip, Countdown } from '../components/trips';
import { LeaderCard, ReviewCard, MemoryWall } from '../components/people';

export const FILTERS = [
  { id: 'all', label: 'All Trips', test: () => true },
  { id: 'trekking', label: 'Trekking', test: (t: TripView) => t.category === 'trekking' },
  { id: 'weekend', label: 'Weekend Getaways', test: (t: TripView) => t.category === 'weekend_getaway' },
  { id: 'adventure', label: 'Adventure', test: (t: TripView) => t.category === 'adventure' },
  { id: 'one-day', label: 'One-Day Trips', test: (t: TripView) => t.durationDays === 1 },
] as const;
export type SortKey = 'date' | 'price-asc' | 'price-desc';
export function sortTrips(list: TripView[], sort: SortKey) {
  const byDate = (a: TripView, b: TripView) => (a.departureDate ?? '9999').localeCompare(b.departureDate ?? '9999');
  const price = (t: TripView) => t.priceInr ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort(sort === 'date' ? byDate : sort === 'price-asc' ? (a, b) => price(a) - price(b) || byDate(a, b) : (a, b) => price(b) - price(a) || byDate(a, b));
}
export const featuredOf = (trips: TripView[] | undefined) =>
  trips?.find((t) => t.isFeatured && t.status !== 'departed') ?? trips?.find((t) => t.status === 'open' || t.status === 'filling_fast');

const HEADLINE = ['The', 'world', 'is', 'better', 'when', 'explored', 'together.'];

function Hero({ featured }: { featured?: TripView }) {
  const reduce = useReducedMotion();
  return (
    <section className="relative isolate overflow-hidden bg-forest-deep text-cream">
      <img src={img('asset:hero-sunrise')} alt="Sunrise over layered ridges of the Western Ghats, with a group of trekkers on the nearest ridge" className="absolute inset-0 -z-20 h-full w-full object-cover" fetchPriority="high" />
      {/* Peak marker, drawn in the image's own coordinates so it stays on the summit at any crop. */}
      <svg viewBox="0 0 1920 1134" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block" aria-hidden>
        <line x1="1300" y1="512" x2="1300" y2="392" stroke="#FFF8E9" strokeWidth="1.5" strokeDasharray="3 4" />
        <circle cx="1300" cy="512" r="7" fill="#F46A27" stroke="#FFF8E9" strokeWidth="2.5" />
        <text x="1316" y="378" fill="#FFF8E9" fontSize="26" fontWeight="700" fontFamily="Eczar, serif">{featured?.destination ?? 'Thadiyandamol'}</text>
        <text x="1316" y="406" fill="#FFF8E9" fillOpacity="0.85" fontSize="18" fontFamily="Anek Latin, sans-serif">{featured?.altitudeM ? `${featured.altitudeM.toLocaleString('en-IN')} m · highest peak in Coorg` : ''}</text>
      </svg>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,42,29,.35)_0%,rgba(10,42,29,0)_30%,rgba(10,42,29,.25)_55%,rgba(10,42,29,.92)_100%)]" />

      <div className="gutter">
        <div className="shell flex min-h-[max(38rem,92svh)] flex-col justify-end gap-8 pb-14 pt-32 lg:flex-row lg:items-end lg:justify-between lg:pb-20">
          <div className="max-w-3xl">
            <h1 className="font-display text-[clamp(3rem,8vw,7rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em]">
              {HEADLINE.map((w, i) => (
                <motion.span key={w} className="mr-[0.22em] inline-block" initial={reduce ? false : { opacity: 0, y: '0.35em' }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                  {w}
                </motion.span>
              ))}
            </h1>
            <motion.p className="mt-6 max-w-xl text-lg text-cream/90 md:text-xl" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}>
              Meet new people, discover incredible destinations and turn ordinary weekends into extraordinary adventures.
            </motion.p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#upcoming" className={buttonClass('primary', 'lg')}>Explore Upcoming Trips</a>
              <ButtonLink to={featured && isBookable(featured) ? `/trips/${featured.slug}/book` : '/trips'} variant="outline-light" size="lg">Join Our Next Adventure</ButtonLink>
            </div>
          </div>
          {featured && <HeroTicket trip={featured} />}
        </div>
      </div>
      <a href="#upcoming" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs text-cream/75 md:flex" aria-label="Scroll to upcoming trips">
        <span className="relative h-9 w-5 rounded-full border-2 border-cream/60"><span className="absolute left-1/2 top-1.5 h-2 w-1 -translate-x-1/2 rounded-full bg-cream animate-scroll-cue" /></span>
        Scroll
      </a>
    </section>
  );
}

function HeroTicket({ trip }: { trip: TripView }) {
  const bookable = isBookable(trip);
  return (
    <motion.aside
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="ticket-notch w-full max-w-sm shrink-0 rounded-[var(--radius-ticket)] bg-cream text-ink shadow-[0_30px_60px_-25px_rgba(0,0,0,.6)] [--notch-at:58%]"
      aria-label="Next departure"
    >
      <div className="p-5 pb-4">
        <p className="text-sm font-semibold text-ember">Next departure</p>
        <p className="mt-1 font-display text-[2rem] font-extrabold leading-none">{trip.title}</p>
        <p className="mt-1.5 text-sm text-muted">{trip.region}</p>
      </div>
      <div className="mx-5 border-t-2 border-dashed border-line" />
      <dl className="grid grid-cols-3 gap-2 p-5 pb-3 text-sm">
        <div><dt className="text-muted">Date</dt><dd className="font-semibold">{formatDate(trip.departureDate, { year: false })}</dd></div>
        <div><dt className="text-muted">Pickup</dt><dd className="font-semibold">{trip.pickupTime}, {trip.pickupCity}</dd></div>
        <div><dt className="text-muted">Per person</dt><dd className="font-semibold tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'}</dd></div>
      </dl>
      <div className="px-5"><Countdown trip={trip} /></div>
      <div className="flex gap-2 p-5 pt-4">
        {bookable && <ButtonLink to={`/trips/${trip.slug}/book`} className="flex-1">Book your seat</ButtonLink>}
        <ButtonLink to={`/trips/${trip.slug}`} variant="outline" className={bookable ? '' : 'flex-1'}>Trip details</ButtonLink>
      </div>
    </motion.aside>
  );
}

function Upcoming() {
  const { data: trips, isLoading, isError, refetch } = useTrips();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const upcoming = useMemo(() => (trips ?? []).filter((t) => t.status !== 'departed'), [trips]);
  const featured = featuredOf(upcoming);
  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    return sortTrips(upcoming.filter((t) => f.test(t) && !(filter === 'all' && t.id === featured?.id)), sort);
  }, [upcoming, filter, sort, featured]);

  return (
    <section id="upcoming" className="scroll-mt-20 bg-paper">
      <div className="gutter">
        <div className="shell py-20 md:py-28">
          <SectionHeading title="Upcoming adventures" intro="Pick a date, book your seat on WhatsApp, and meet the group at pickup. Every trip includes transport, a guide and first aid." action={<ButtonLink to="/trips" variant="outline">Find your next adventure</ButtonLink>} />
          {isLoading && <div className="mt-10 grid gap-5 md:grid-cols-3"><Skeleton className="h-96 md:col-span-3" /><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div>}
          {isError && <ErrorState className="mt-10" onRetry={() => refetch()} />}
          {featured && <div className="mt-10"><FeaturedTrip trip={featured} /></div>}
          {trips && upcoming.length > 1 && (
            <>
              <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label="Filter trips">
                  {FILTERS.map((f) => (
                    <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors', filter === f.id ? 'bg-forest text-cream' : 'bg-white text-ink ring-1 ring-line hover:ring-ink/40')}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0">Sort by</span>
                  <Select id="home-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 w-48 text-sm">
                    <option value="date">Date: soonest first</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                  </Select>
                </label>
              </div>
              {list.length ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((t) => <TripCard key={t.id} trip={t} />)}</div>
              ) : (
                <EmptyState className="mt-6" title="No trips in this category yet" action={<button className="font-semibold text-forest underline underline-offset-4" onClick={() => setFilter('all')}>Show all trips</button>}>
                  New dates are announced on Instagram and WhatsApp first.
                </EmptyState>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SoloStrip({ featured }: { featured?: TripView }) {
  const steps = [
    { t: 'Book your seat', d: 'Fill in a short form. It opens WhatsApp with your booking details ready to send.' },
    { t: 'Get confirmed', d: 'We reply with payment details. Your seat is confirmed once payment is in.' },
    { t: 'Meet at pickup', d: featured ? `${featured.pickupTime}, ${featured.pickupPoint.replace(/^Near/, 'near')}, for ${featured.title}.` : 'Your trip leader meets the group at the pickup point.' },
    { t: 'Trek together', d: 'A local guide and your trip leader keep the group together from start to summit.' },
  ];
  return (
    <section className="relative overflow-hidden bg-forest text-cream">
      <img src={CONTOURS} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[.09]" />
      <div className="gutter relative">
        <div className="shell grid gap-12 py-20 md:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <h2 className="font-display text-[clamp(2.4rem,5vw,4.2rem)] font-extrabold leading-[0.95]">Coming alone? You’re exactly who we plan for.</h2>
            <p className="mt-5 max-w-lg text-lg text-cream/80">You don’t need a travel partner to join a JoinZipTrip. Book one seat, show up at pickup, and you’ll spend the day with people who signed up for the same reason you did.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/tribe" variant="cream">How the group comes together</ButtonLink>
            </div>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-[1.4rem] bg-cream/15 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.t} className="flex flex-col gap-2 bg-forest p-6">
                <span className="font-display text-4xl font-extrabold text-orange tabular">{i + 1}</span>
                <span className="text-lg font-semibold">{s.t}</span>
                <span className="text-cream/75">{s.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function WhyUs({ featured }: { featured?: TripView }) {
  const plan = featured?.itinerary.slice(0, 1).concat(featured.itinerary.slice(4, 5), featured.itinerary.slice(-1)) ?? [];
  return (
    <section className="bg-cream">
      <div className="gutter">
        <div className="shell py-20 md:py-28">
          <SectionHeading title="Why JoinZipTrip?" intro="We plan the day, sort the logistics and bring the group together. You bring your shoes." />
          <div className="mt-12 grid auto-rows-[minmax(15rem,auto)] gap-4 md:grid-cols-12">
            <article className="relative flex flex-col justify-end overflow-hidden rounded-[1.6rem] p-7 text-cream md:col-span-5 md:row-span-2">
              <img src={img('asset:tribe-sunrise')} alt="" aria-hidden className="absolute inset-0 -z-0 h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest-deep/20 to-transparent" />
              <div className="relative">
                <Users className="text-orange" aria-hidden />
                <h3 className="mt-3 font-display text-4xl font-extrabold leading-none">Solo-friendly travel</h3>
                <p className="mt-3 max-w-sm text-lg text-cream/85">Come alone, leave with new friends.</p>
              </div>
            </article>
            <article className="flex flex-col justify-between gap-6 rounded-[1.6rem] bg-white p-7 ring-1 ring-line md:col-span-7">
              <div className="flex -space-x-3" aria-hidden>
                {[Mountain, Tent, Camera, Footprints, Route].map((I, i) => (
                  <span key={i} className={cn('grid size-14 place-items-center rounded-full ring-4 ring-white', ['bg-forest text-cream', 'bg-orange text-ink', 'bg-sage text-forest', 'bg-ink text-cream', 'bg-sand text-forest'][i])}><I size={22} /></span>
                ))}
              </div>
              <div>
                <h3 className="font-display text-3xl font-bold">Like-minded travellers</h3>
                <p className="mt-2 max-w-md text-muted">Meet people who love exploring. Trekkers, photographers, first-timers and weekend escapists, all on the same trail.</p>
              </div>
            </article>
            <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[1.6rem] bg-forest p-7 text-cream md:col-span-4">
              <img src={CONTOURS} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[.12]" />
              <Footprints className="relative text-orange" aria-hidden />
              <div className="relative">
                <h3 className="font-display text-3xl font-bold leading-tight">Experienced trek leaders</h3>
                <p className="mt-2 text-cream/80">Enjoy adventures with responsible leaders and local guides.</p>
                <Link to="/leaders" className="mt-4 inline-block font-semibold text-orange underline-offset-4 hover:underline">Meet the team</Link>
              </div>
            </article>
            <article className="flex flex-col gap-4 rounded-[1.6rem] bg-paper p-7 ring-1 ring-line md:col-span-3">
              <h3 className="font-display text-2xl font-bold leading-tight">Planned experiences</h3>
              <p className="text-muted">Carefully organised itineraries.</p>
              {plan.length > 0 && (
                <ol className="mt-auto space-y-2 border-l-2 border-forest/20 pl-3 text-sm">
                  {plan.map((p) => <li key={p.title}><span className="font-bold font-cond text-forest">{p.time}</span> {p.title}</li>)}
                </ol>
              )}
            </article>
            <article className="flex flex-col justify-between gap-6 rounded-[1.6rem] bg-orange p-7 text-ink md:col-span-6">
              <Bus size={30} aria-hidden />
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-display text-3xl font-bold">Hassle-free transportation</h3>
                  <p className="mt-2 max-w-sm">Organised pickup and return, so the only thing you plan is your snacks.</p>
                </div>
                {featured && (
                  <div className="rounded-xl bg-ink px-4 py-3 text-cream">
                    <p className="text-xs text-cream/60">Next pickup</p>
                    <p className="font-display text-2xl font-bold tabular">{featured.pickupTime}</p>
                    <p className="text-sm">{featured.pickupCity}, {formatDate(featured.departureDate, { year: false })}</p>
                  </div>
                )}
              </div>
            </article>
            <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[1.6rem] bg-ink p-7 text-cream md:col-span-6">
              <div className="relative h-28" aria-hidden>
                {['asset:summit-clouds', 'asset:grassland-trail', 'asset:camping-night'].map((u, i) => (
                  <img key={u} src={img(u)} alt="" loading="lazy" className="absolute top-0 h-28 w-40 rounded-lg border-4 border-cream object-cover shadow-lg" style={{ left: `${i * 5.5}rem`, transform: `rotate(${[-6, 3, -2][i]}deg)` }} />
                ))}
              </div>
              <div>
                <Images className="mb-3 text-orange" aria-hidden />
                <h3 className="font-display text-3xl font-bold">Memories that last</h3>
                <p className="mt-2 max-w-md text-cream/80">Photos, friendships and unforgettable moments. Every trip gets an album you can come back to.</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function PastTeaser() {
  const { data: albums, isLoading } = useAlbums();
  const album = albums?.[0];
  return (
    <section className="bg-paper">
      <div className="gutter">
        <div className="shell py-20 md:py-28">
          <SectionHeading
            title="Past adventures"
            intro="Every completed trip gets its own album: the group at the summit, the trail, the reels. Our first one will be written on the trail to Thadiyandamol."
            action={<ButtonLink to="/past-adventures" variant="outline">See all adventures</ButtonLink>}
          />
          {isLoading && <Skeleton className="mt-10 h-96" />}
          {album ? (
            <div className="mt-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h3 className="font-display text-2xl font-bold">{album.title}</h3>
                {album.isDemo && <SampleTag className="text-ember">Sample album, stand-in photos</SampleTag>}
                <span className="text-muted">{album.location}{album.tripDate ? ` · ${formatDate(album.tripDate, { weekday: false })}` : ''}</span>
              </div>
              <MemoryWall items={album.media.slice(0, 6)} columns="columns-2 md:columns-3" />
              <ButtonLink to={`/past-adventures/${album.slug}`} variant="forest" className="mt-6">View full adventure</ButtonLink>
            </div>
          ) : (
            !isLoading && <EmptyState className="mt-10" title="The first album is on its way">Photos from our first trek will appear here after the trip.</EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}

function LeadersTeaser() {
  const { data: leaders, isLoading, isError, refetch } = useLeaders();
  return (
    <section className="bg-sand/60">
      <div className="gutter">
        <div className="shell py-20 md:py-28">
          <SectionHeading title="Meet your trip leaders" intro="The people who check you in at 4 AM, keep the group together on the trail, and make sure everyone gets home." action={<ButtonLink to="/leaders" variant="outline">Meet the team</ButtonLink>} />
          {isLoading && <div className="mt-10 grid gap-5 md:grid-cols-3"><Skeleton className="h-[30rem]" /><Skeleton className="h-[30rem]" /><Skeleton className="h-[30rem]" /></div>}
          {isError && <ErrorState className="mt-10" onRetry={() => refetch()} />}
          {leaders && <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{leaders.slice(0, 3).map((l) => <LeaderCard key={l.id} leader={l} />)}</div>}
        </div>
      </div>
    </section>
  );
}

function ReviewsTeaser() {
  const { data: reviews, isLoading } = useReviews();
  const s = useSettings();
  return (
    <section className="bg-paper">
      <div className="gutter">
        <div className="shell py-20 md:py-28">
          <SectionHeading
            title="Traveller reviews"
            intro={IS_DEMO ? 'Reviews appear here once real travellers submit them and an admin approves them. The cards below are samples.' : 'In their words, after the trip.'}
            action={
              <div className="flex flex-wrap gap-2">
                <ButtonLink to="/reviews" variant="outline">Read all reviews</ButtonLink>
                {s.googleReviewsUrl && <ButtonA href={s.googleReviewsUrl} variant="ghost">See Google reviews</ButtonA>}
              </div>
            }
          />
          {isLoading && <div className="mt-10 grid gap-5 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>}
          {reviews && reviews.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{reviews.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)}</div>}
          {reviews && reviews.length === 0 && (
            <EmptyState className="mt-10" title="No reviews yet" action={<ButtonLink to="/reviews#write" variant="forest" size="sm">Write a review</ButtonLink>}>
              Our first travellers head out soon. Been on a trip with us? Tell others what it was like.
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const s = useSettings();
  return (
    <section className="relative isolate overflow-hidden bg-forest-deep text-cream">
      <img src={img('asset:predawn-ridges')} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-forest-deep/70 via-forest-deep/30 to-forest-deep/80" />
      <div className="gutter">
        <div className="shell flex flex-col items-start gap-6 py-24 md:py-36">
          <h2 className="max-w-4xl font-display text-[clamp(2.8rem,7.4vw,6.4rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.02em]">Your next great story starts here.</h2>
          <p className="max-w-xl text-lg text-cream/85 md:text-xl">Don’t wait for the perfect travel partner. Find your people along the way.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/trips" size="lg">Explore Trips</ButtonLink>
            <ButtonA href={waLink(s.whatsappNumber, 'Hi JoinZipTrip! I want to join your next adventure.')} variant="outline-light" size="lg"><MessageCircle size={18} /> Connect on WhatsApp</ButtonA>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { data: trips } = useTrips();
  const featured = featuredOf(trips);
  return (
    <>
      <Seo
        path="/"
        description="Group treks and weekend trips from Mysuru. Book solo, travel together. Next up: Thadiyandamol, Coorg's highest peak, on Sunday 22 November for ₹1,699."
        jsonLd={{ '@context': 'https://schema.org', '@type': 'TravelAgency', name: 'JoinZipTrip', alternateName: 'ZipTrip Travels', areaServed: 'Karnataka, India', telephone: ['+918073271501', '+918660840458'], address: { '@type': 'PostalAddress', addressLocality: 'Mysuru', addressRegion: 'Karnataka', addressCountry: 'IN' } }}
      />
      <Hero featured={featured} />
      <Upcoming />
      <SoloStrip featured={featured} />
      <WhyUs featured={featured} />
      <PastTeaser />
      <LeadersTeaser />
      <ReviewsTeaser />
      <FinalCta />
    </>
  );
}

