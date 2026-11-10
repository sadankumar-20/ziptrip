import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, Mountain, Tent, Camera, Footprints, Users, Route, Bus, Check, Compass } from 'lucide-react';
import { formatDate, formatINR, isBookable, waLink, type TripView } from '@jzt/shared';
import { useTrips, useAlbums, useLeaders, useReviews, useSettings } from '../lib/hooks';
import { CONTOURS, LOGO } from '../lib/images';
import { Seo } from '../lib/seo';
import { cn } from '../lib/cn';
import { IS_DEMO } from '../lib/config';
import { ButtonLink, ButtonA, Select, Skeleton, ErrorState, EmptyState, SectionHeading, SampleTag, Polaroid, PostageStamp, HandNote, Wave, buttonClass } from '../components/ui';
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

// ---------------------------------------------------------------- hero
function Hero({ featured }: { featured?: TripView }) {
  const reduce = useReducedMotion();
  const pop = (delay: number, rotate: number) => (reduce ? {} : { initial: { opacity: 0, y: 30, rotate: rotate * 2 }, animate: { opacity: 1, y: 0, rotate }, transition: { delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] } });
  return (
    <section className="relative overflow-hidden bg-sky">
      <div aria-hidden className="absolute -right-24 -top-24 size-[26rem] rounded-full bg-sun/50 blur-2xl md:size-[34rem]" />
      <svg aria-hidden viewBox="0 0 600 200" className="pointer-events-none absolute bottom-10 left-0 hidden w-[44rem] text-forest/15 lg:block" fill="none"><path d="M0 160 C 120 60, 220 190, 330 110 S 520 40, 600 90" stroke="currentColor" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" /></svg>
      <div className="gutter relative">
        <div className="shell grid items-center gap-10 pb-12 pt-8 md:pb-16 md:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          <div className="relative z-10">
            {featured && <HandNote className="mb-3 text-[1.7rem] md:text-[2rem]">Next stop: {featured.destination}, {formatDate(featured.departureDate, { year: false })}</HandNote>}
            <h1 className="font-display text-[clamp(2.6rem,6.6vw,5.6rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em] text-forest">
              {HEADLINE.map((w, i) => (
                <motion.span key={w} className="mr-[0.22em] inline-block" initial={reduce ? false : { opacity: 0, y: '0.4em' }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>{w}</motion.span>
              ))}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink/75 md:text-xl">Meet new people, discover incredible destinations and turn ordinary weekends into extraordinary adventures.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#upcoming" className={buttonClass('primary', 'lg')}>Explore Upcoming Trips</a>
              <Link to={featured && isBookable(featured) ? `/trips/${featured.slug}/book` : '/trips'} className={buttonClass('forest', 'lg')}>Join Our Next Adventure</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-forest">
              {['Solo-friendly', 'Pickup from Mysuru', 'Guide and first aid included'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={16} className="text-orange" aria-hidden /> {t}</li>)}
            </ul>
          </div>

          {/* Postcard collage, built from the trip poster's own photos */}
          <div className="relative mx-auto h-[23rem] w-full max-w-[30rem] sm:h-[28rem] lg:h-[34rem]">
            <motion.div {...pop(0.25, 6)} className="absolute right-0 top-0 w-[52%]">
              <Polaroid src="asset:sunrise-clouds" alt="Sunrise over a sea of clouds above forested hills" caption="above the clouds" rotate={0} eager />
            </motion.div>
            <motion.div {...pop(0.4, -5)} className="absolute left-0 top-[24%] w-[52%]">
              <Polaroid src="asset:trekker" alt="A trekker in an orange jacket looking out over misty hills" caption={featured?.altitudeM ? `${featured.altitudeM.toLocaleString('en-IN')} m, Coorg's highest` : 'the view from the top'} rotate={0} eager />
            </motion.div>
            <motion.img {...pop(0.6, -10)} src={LOGO} alt="" aria-hidden className="absolute left-[8%] top-[4%] size-20 rounded-full bg-cream p-1 shadow-lg ring-4 ring-white sm:size-24" />
            {featured && (
              <motion.div {...pop(0.7, 8)} className="absolute bottom-[2%] right-[10%]">
                <PostageStamp tone="orange">
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider">{formatDate(featured.departureDate, { weekday: false, year: false })}</span>
                  <span className="font-display text-2xl font-extrabold leading-none tabular">{featured.priceInr != null ? formatINR(featured.priceInr) : ''}</span>
                </PostageStamp>
              </motion.div>
            )}
          </div>
        </div>

        {featured && <NextDeparture trip={featured} />}
        <a href="#upcoming" className="mx-auto mt-6 hidden w-fit flex-col items-center gap-1 pb-4 text-xs font-semibold text-forest/70 md:flex" aria-label="Scroll to upcoming trips">
          <span className="relative h-9 w-5 rounded-full border-2 border-forest/40"><span className="absolute left-1/2 top-1.5 h-2 w-1 -translate-x-1/2 rounded-full bg-forest animate-scroll-cue" /></span>
          Scroll
        </a>
      </div>
      <Wave from="bg-sky" to="text-paper" />
    </section>
  );
}

/** Boarding-pass style strip for the next departure. */
function NextDeparture({ trip }: { trip: TripView }) {
  const bookable = isBookable(trip);
  return (
    <div className="shell relative z-10">
      <div className="ticket-notch grid gap-4 rounded-[var(--radius-ticket)] bg-white p-5 shadow-[0_24px_50px_-30px_rgba(23,34,28,.5)] [--notch-at:50%] md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 md:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ember">Next departure</p>
          <p className="font-display text-2xl font-extrabold text-forest">{trip.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-dashed border-line md:border-l md:pl-8">
          <dl className="flex gap-6 text-sm">
            <div><dt className="text-muted">Date</dt><dd className="font-bold">{formatDate(trip.departureDate, { year: false })}</dd></div>
            <div><dt className="text-muted">Pickup</dt><dd className="font-bold">{trip.pickupTime}</dd></div>
            <div><dt className="text-muted">Price</dt><dd className="font-bold tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'}</dd></div>
          </dl>
          <Countdown trip={trip} />
        </div>
        <div className="flex gap-2">
          {bookable && <ButtonLink to={`/trips/${trip.slug}/book`} className="flex-1 md:flex-none">Book your seat</ButtonLink>}
          <ButtonLink to={`/trips/${trip.slug}`} variant="outline" className="flex-1 md:flex-none">Details</ButtonLink>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- upcoming
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
        <div className="shell py-14 md:py-24">
          <SectionHeading title="Upcoming adventures" intro="Pick a date, book your seat on WhatsApp, and meet the group at pickup. Every trip includes transport, a guide and first aid." action={<ButtonLink to="/trips" variant="outline">Find your next adventure</ButtonLink>} />
          {isLoading && <div className="mt-10 grid gap-5 md:grid-cols-3"><Skeleton className="h-96 md:col-span-3" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div>}
          {isError && <ErrorState className="mt-10" onRetry={() => refetch()} />}
          {featured && <div className="mt-10"><FeaturedTrip trip={featured} /></div>}
          {trips && upcoming.length > 1 && (
            <>
              <div className="mt-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label="Filter trips">
                  {FILTERS.map((f) => (
                    <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors', filter === f.id ? 'bg-forest text-cream' : 'bg-white text-ink ring-1 ring-line hover:ring-ink/40')}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
                  Sort by
                  <Select id="home-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 w-48 text-sm">
                    <option value="date">Date: soonest first</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                  </Select>
                </label>
              </div>
              {list.length ? (
                // Swipeable row on phones, grid on larger screens.
                <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-3">
                  {list.map((t) => <TripCard key={t.id} trip={t} className="w-[82%] shrink-0 snap-start sm:w-auto" />)}
                </div>
              ) : (
                <EmptyState className="mt-6" title="No trips in this category yet" action={<button className="font-semibold text-forest underline underline-offset-4" onClick={() => setFilter('all')}>Show all trips</button>}>
                  New dates are announced on Instagram and WhatsApp first.
                </EmptyState>
              )}
            </>
          )}
          {trips && upcoming.length <= 1 && (
            <p className="mt-8 flex items-center gap-2 text-muted"><Compass size={18} className="text-forest" aria-hidden /> More trips are on the way. New dates go up on Instagram and WhatsApp first.</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- solo
function SoloStrip({ featured }: { featured?: TripView }) {
  const steps = [
    { t: 'Book your seat', d: 'Fill in a short form. It opens WhatsApp with your booking details ready to send.' },
    { t: 'Get confirmed', d: 'We reply with payment details. Your seat is confirmed once payment is in.' },
    { t: 'Meet at pickup', d: featured ? `${featured.pickupTime}, ${featured.pickupPoint.replace(/^Near/, 'near')}.` : 'Your trip leader meets the group at the pickup point.' },
    { t: 'Trek together', d: 'A local guide and your trip leader keep the group together from start to summit.' },
  ];
  const tones = ['bg-sun', 'bg-peach', 'bg-sky', 'bg-sage'];
  return (
    <section className="bg-cream">
      <div className="gutter">
        <div className="shell grid gap-10 py-14 md:py-24 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <HandNote className="mb-2">Psst, most great trips start solo</HandNote>
            <h2 className="font-display text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[0.95] text-forest">Coming alone? You’re exactly who we plan for.</h2>
            <p className="mt-5 max-w-lg text-lg text-muted">You don’t need a travel partner to join. Book one seat, show up at pickup, and spend the day with people who signed up for the same reason you did.</p>
            <ButtonLink to="/tribe" variant="forest" className="mt-7">How the group comes together</ButtonLink>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.t} className={cn('relative flex flex-col gap-2 rounded-[1.4rem] p-6', tones[i], i % 2 ? 'sm:translate-y-6' : '')}>
                <span className="grid size-10 -rotate-6 place-items-center rounded-full bg-white font-display text-xl font-extrabold text-forest shadow">{i + 1}</span>
                <span className="mt-1 text-lg font-bold text-ink">{s.t}</span>
                <span className="text-ink/75">{s.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- why us
function WhyUs({ featured }: { featured?: TripView }) {
  const plan = featured?.itinerary.slice(0, 1).concat(featured.itinerary.slice(4, 5), featured.itinerary.slice(-1)) ?? [];
  return (
    <section className="bg-paper">
      <div className="gutter">
        <div className="shell py-14 md:py-24">
          <SectionHeading title="Why JoinZipTrip?" intro="We plan the day, sort the logistics and bring the group together. You bring your shoes." />
          <div className="mt-10 grid gap-4 md:grid-cols-12">
            <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[1.8rem] bg-peach p-7 md:col-span-5 md:row-span-2">
              <div>
                <Users className="text-ember" aria-hidden />
                <h3 className="mt-3 font-display text-4xl font-extrabold leading-none text-forest">Solo-friendly travel</h3>
                <p className="mt-3 max-w-sm text-lg text-ink/75">Come alone, leave with new friends.</p>
              </div>
              <div className="relative mx-auto h-60 w-full max-w-xs">
                <div className="absolute left-0 top-0 w-[48%]"><Polaroid src="asset:trekker" alt="A trekker looking out over misty hills" caption="you, on 22 Nov?" rotate={-6} /></div>
                <div className="absolute right-0 top-6 w-[46%]"><Polaroid src="asset:sunrise-clouds" alt="Sunrise over the clouds" caption="worth the 4 AM" rotate={7} /></div>
              </div>
            </article>
            <article className="flex flex-col justify-between gap-6 rounded-[1.8rem] bg-sky p-7 md:col-span-7">
              <div className="flex -space-x-3" aria-hidden>
                {[Mountain, Tent, Camera, Footprints, Route].map((I, i) => (
                  <span key={i} className={cn('grid size-14 place-items-center rounded-full ring-4 ring-sky', ['bg-forest text-cream', 'bg-orange text-ink', 'bg-white text-forest', 'bg-sun text-ink', 'bg-sage text-forest'][i])} style={{ transform: `rotate(${(i - 2) * 5}deg)` }}><I size={22} /></span>
                ))}
              </div>
              <div>
                <h3 className="font-display text-3xl font-bold text-forest">Like-minded travellers</h3>
                <p className="mt-2 max-w-md text-ink/75">Meet people who love exploring. Trekkers, photographers, first-timers and weekend escapists, all on the same trail.</p>
              </div>
            </article>
            <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[1.8rem] bg-forest p-7 text-cream md:col-span-4">
              <img src={CONTOURS} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[.12]" />
              <Footprints className="relative text-sun" aria-hidden />
              <div className="relative">
                <h3 className="font-display text-3xl font-bold leading-tight">Experienced trek leaders</h3>
                <p className="mt-2 text-cream/80">Enjoy adventures with responsible leaders and local guides.</p>
                <Link to="/leaders" className="mt-4 inline-block font-bold text-sun underline-offset-4 hover:underline">Meet the team</Link>
              </div>
            </article>
            <article className="flex flex-col gap-4 rounded-[1.8rem] bg-white p-7 ring-1 ring-line md:col-span-3">
              <h3 className="font-display text-2xl font-bold leading-tight text-forest">Planned experiences</h3>
              <p className="text-muted">Carefully organised itineraries.</p>
              {plan.length > 0 && (
                <ol className="mt-auto space-y-2 border-l-2 border-dashed border-orange/50 pl-3 text-sm">
                  {plan.map((p) => <li key={p.title}><span className="font-bold text-forest">{p.time}</span> {p.title}</li>)}
                </ol>
              )}
            </article>
            <article className="flex flex-col justify-between gap-6 rounded-[1.8rem] bg-sun p-7 text-ink md:col-span-6">
              <Bus size={30} aria-hidden />
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-display text-3xl font-bold">Hassle-free transportation</h3>
                  <p className="mt-2 max-w-sm">Organised pickup and return, so the only thing you plan is your snacks.</p>
                </div>
                {featured && (
                  <PostageStamp tone="paper" rotate={-4}>
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider">Next pickup</span>
                    <span className="font-display text-2xl font-extrabold tabular">{featured.pickupTime}</span>
                    <span className="text-xs font-semibold">{featured.pickupCity}</span>
                  </PostageStamp>
                )}
              </div>
            </article>
            <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[1.8rem] bg-sage p-7 md:col-span-6">
              <div className="relative h-32" aria-hidden>
                {['asset:trekker', 'asset:sunrise-clouds', 'asset:poster'].map((u, i) => (
                  <div key={u} className="absolute top-0 w-28" style={{ left: `${i * 5.8}rem` }}><Polaroid src={u} alt="" ratio={1} rotate={[-7, 3, -2][i]} className="!pb-6" /></div>
                ))}
              </div>
              <div>
                <h3 className="font-display text-3xl font-bold text-forest">Memories that last</h3>
                <p className="mt-2 max-w-md text-ink/75">Photos, friendships and unforgettable moments. Every trip gets an album you can come back to.</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- past, leaders, reviews
function PastTeaser() {
  const { data: albums, isLoading } = useAlbums();
  const album = albums?.[0];
  return (
    <section className="bg-cream">
      <div className="gutter">
        <div className="shell py-14 md:py-24">
          <SectionHeading title="Past adventures" intro="Every completed trip gets its own album: the group at the summit, the trail, the reels." action={<ButtonLink to="/past-adventures" variant="outline">See all adventures</ButtonLink>} />
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
          ) : !isLoading && (
            <div className="mt-10 flex flex-col items-center gap-6 rounded-[1.8rem] border-2 border-dashed border-ink/15 p-8 text-center md:flex-row md:text-left">
              <div className="flex -space-x-6">
                <div className="w-28"><Polaroid src="asset:trekker" alt="" rotate={-6} ratio={1} /></div>
                <div className="polaroid grid w-28 rotate-6 place-items-center"><div className="grid aspect-square w-full place-items-center rounded-[0.3rem] bg-sky font-hand text-2xl text-forest">your pic?</div></div>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-forest">The first album is on its way</p>
                <p className="mt-1 max-w-md text-muted">Photos from the Thadiyandamol trek land here after 22 November. Be in them.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LeadersTeaser() {
  const { data: leaders, isLoading, isError, refetch } = useLeaders();
  if (leaders && leaders.length === 0) return null;
  return (
    <section className="bg-paper">
      <div className="gutter">
        <div className="shell py-14 md:py-24">
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
    <section className="bg-sky">
      <div className="gutter">
        <div className="shell py-14 md:py-24">
          <SectionHeading
            title="Traveller reviews"
            intro={IS_DEMO ? 'Reviews appear here once real travellers submit them and an admin approves them. The cards below are samples.' : 'In their words, after the trip.'}
            action={<div className="flex flex-wrap gap-2"><ButtonLink to="/reviews" variant="outline">Read all reviews</ButtonLink>{s.googleReviewsUrl && <ButtonA href={s.googleReviewsUrl} variant="ghost">See Google reviews</ButtonA>}</div>}
          />
          {isLoading && <div className="mt-10 grid gap-5 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>}
          {reviews && reviews.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{reviews.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)}</div>}
          {reviews && reviews.length === 0 && (
            <EmptyState className="mt-10 border-ink/15 bg-white/60" title="No reviews yet" action={<ButtonLink to="/reviews#write" variant="forest" size="sm">Write a review</ButtonLink>}>
              Our first travellers head out on 22 November. Been on a trip with us? Tell others what it was like.
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- final call to action
export function FinalCta() {
  const s = useSettings();
  return (
    <section className="bg-cream">
      <div className="gutter">
        <div className="shell py-14 md:py-24">
          <div className="airmail relative overflow-hidden rounded-[2rem] [--airmail-fill:var(--color-sun)]">
            <div className="grid items-center gap-8 p-7 md:grid-cols-[1.4fr_1fr] md:p-12">
              <div>
                <HandNote className="mb-2 text-forest">See you on the trail!</HandNote>
                <h2 className="font-display text-[clamp(2.4rem,6vw,5rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em] text-forest">Your next great story starts here.</h2>
                <p className="mt-4 max-w-xl text-lg text-ink/80">Don’t wait for the perfect travel partner. Find your people along the way.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink to="/trips" variant="forest" size="lg">Explore Trips</ButtonLink>
                  <ButtonA href={waLink(s.whatsappNumber, 'Hi JoinZipTrip! I want to join your next adventure.')} variant="cream" size="lg"><MessageCircle size={18} /> Connect on WhatsApp</ButtonA>
                </div>
              </div>
              <div className="relative mx-auto h-64 w-full max-w-xs md:h-72">
                <div className="absolute right-0 top-0 w-48"><Polaroid src="asset:sunrise-clouds" alt="Sunrise over the clouds" caption="greetings from Coorg" rotate={6} /></div>
                <img src={LOGO} alt="" aria-hidden className="absolute bottom-2 left-2 size-24 -rotate-12 rounded-full bg-cream p-1 shadow-lg ring-4 ring-white" />
              </div>
            </div>
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
