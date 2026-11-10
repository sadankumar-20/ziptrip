import { Link } from 'react-router-dom';
import {
  CalendarDays, Clock, MapPin, Bus, Coffee, UtensilsCrossed, Soup, Cookie, FileCheck2, IndianRupee, Footprints,
  HeartPulse, BedDouble, Tent, Flame, Camera, Sparkles, type LucideIcon,
} from 'lucide-react';
import {
  CATEGORY_LABEL, formatDate, formatDateLong, formatINR, departureInstant, dayOfMonth, monthShort, isBookable,
  type TripView, type InclusionKey, type ElevationPoint, type ItineraryStep, type Inclusion,
} from '@jzt/shared';
import { cn } from '../lib/cn';
import { useCountdown } from '../lib/useCountdown';
import { Img, StatusPill, SampleTag, PostageStamp, HandNote, buttonClass } from './ui';

// ---------- Seats ----------
export function SeatMeter({ trip, compact, light }: { trip: TripView; compact?: boolean; light?: boolean }) {
  if (trip.seatsTotal == null || trip.seatsLeft == null) return null;
  const total = trip.seatsTotal;
  const left = trip.seatsLeft;
  const showDots = total <= 40;
  const tone = left === 0 ? 'bg-ink/25' : trip.status === 'filling_fast' ? 'bg-orange' : light ? 'bg-cream' : 'bg-forest';
  return (
    <div className="flex flex-col gap-1.5">
      {showDots && (
        <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`${left} of ${total} seats left`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn(compact ? 'h-2 w-[7px]' : 'h-2.5 w-2', 'rounded-[2px]', i < total - left ? (light ? 'bg-cream/20' : 'bg-ink/15') : tone)} />
          ))}
        </div>
      )}
      <p className={cn('text-sm font-semibold tabular', light ? 'text-cream' : left === 0 ? 'text-muted' : trip.status === 'filling_fast' ? 'text-ember' : 'text-forest')}>
        {left === 0 ? 'No seats left' : `${left} of ${total} seats left`}
      </p>
    </div>
  );
}

// ---------- Countdown ----------
export function Countdown({ trip, light, className }: { trip: TripView; light?: boolean; className?: string }) {
  const c = useCountdown(departureInstant(trip));
  if (!c || c.done) return null;
  const parts: [number, string][] = [[c.days, 'days'], [c.hours, 'hrs'], [c.minutes, 'min'], [c.seconds, 'sec']];
  return (
    <div className={cn('flex items-stretch gap-1.5', className)} role="timer" aria-label={`${c.days} days and ${c.hours} hours until departure`}>
      {parts.map(([n, label]) => (
        <div key={label} className={cn('flex min-w-[3.6rem] flex-col items-center rounded-xl px-2 py-1.5', light ? 'bg-cream/10' : 'bg-sky ring-1 ring-sky-deep')}>
          <span className="font-display text-2xl font-extrabold leading-none tabular">{String(n).padStart(2, '0')}</span>
          <span className={cn('mt-1 text-[0.7rem] font-medium', light ? 'text-cream/70' : 'text-muted')}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Trip card ----------
export function TripCard({ trip, className }: { trip: TripView; className?: string }) {
  return (
    <article className={cn('group relative flex flex-col rounded-[1.6rem] bg-white p-3 shadow-[0_1px_0_rgba(23,34,28,.05),0_20px_40px_-28px_rgba(23,34,28,.45)] ring-1 ring-line/70 transition-transform duration-300 hover:-translate-y-1', className)}>
      <div className="relative">
        <Img src={trip.coverImage.url} alt={trip.coverImage.alt} ratio={4 / 3} className="rounded-[1.1rem]" imgClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="absolute left-3 top-3 -rotate-3"><StatusPill status={trip.status} className="shadow-md" /></div>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-forest">{CATEGORY_LABEL[trip.category]}</span>
        {trip.departureDate && (
          <div className="absolute -bottom-5 right-4 rotate-3">
            <PostageStamp tone="paper" className="[--r:4px]">
              <span className="font-display text-2xl font-extrabold leading-none tabular">{dayOfMonth(trip.departureDate)}</span>
              <span className="text-[0.7rem] font-bold uppercase tracking-wider">{monthShort(trip.departureDate)}</span>
            </PostageStamp>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 px-2 pb-2 pt-5">
        <div className="pr-16">
          <h3 className="font-display text-[1.55rem] font-bold leading-tight text-forest">
            <Link to={`/trips/${trip.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{trip.title}</Link>
          </h3>
          <p className="mt-1 text-sm text-muted">{trip.destination}{trip.region ? `, ${trip.region}` : ''}</p>
          {trip.isDemo && <SampleTag className="mt-2 text-ember" />}
        </div>
        <ul className="flex flex-wrap gap-1.5 text-[0.82rem] font-semibold">
          <li className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-1"><CalendarDays size={14} aria-hidden /> {formatDate(trip.departureDate, { year: false })}</li>
          <li className="inline-flex items-center gap-1 rounded-full bg-sage px-2.5 py-1"><Clock size={14} aria-hidden /> {trip.durationLabel}</li>
          <li className="inline-flex items-center gap-1 rounded-full bg-peach px-2.5 py-1"><MapPin size={14} aria-hidden /> {trip.pickupCity || trip.pickupPoint}</li>
        </ul>
        <SeatMeter trip={trip} compact />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-line pt-4">
          <div>
            <p className="text-xs font-semibold text-muted">{trip.isDemo ? 'Sample price' : 'Per person'}</p>
            <p className="font-display text-[1.7rem] font-extrabold leading-none text-ink tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'}</p>
          </div>
          <span className={buttonClass('primary', 'sm', 'relative')} aria-hidden>View details</span>
        </div>
      </div>
    </article>
  );
}

// ---------- Featured postcard ----------
export function FeaturedTrip({ trip }: { trip: TripView }) {
  const bookable = isBookable(trip);
  return (
    <article className="airmail relative overflow-hidden rounded-[1.8rem] shadow-[0_30px_60px_-40px_rgba(23,34,28,.6)]">
      <div className="grid gap-0 md:grid-cols-[1fr_1.15fr]">
        <div className="relative p-4 pb-0 md:p-6 md:pr-0">
          <Img src={trip.coverImage.url} alt={trip.coverImage.alt} className="h-64 rounded-[1.2rem] md:h-full md:min-h-[24rem]" eager />
          <HandNote className="absolute bottom-4 left-8 rounded-lg bg-white/90 px-3 py-1 text-[1.4rem] md:bottom-8 md:left-10">Wish you were here!</HandNote>
        </div>
        <div className="relative flex flex-col gap-5 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="self-start rounded-full bg-forest px-3 py-1 text-xs font-bold text-cream">Our first official trip</span>
              <div className="flex flex-wrap items-center gap-2"><StatusPill status={trip.status} /><span className="text-sm font-semibold text-muted">{CATEGORY_LABEL[trip.category]} · {trip.durationLabel}</span></div>
            </div>
            <PostageStamp rotate={4} className="shrink-0">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider">Per person</span>
              <span className="font-display text-2xl font-extrabold leading-none tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'}</span>
            </PostageStamp>
          </div>
          <div>
            <h3 className="font-display text-[clamp(2.2rem,4vw,3.4rem)] font-extrabold leading-[0.95] text-forest">
              <Link to={`/trips/${trip.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{trip.title}</Link>
            </h3>
            <p className="mt-3 max-w-md text-muted">{trip.summary}</p>
          </div>
          <dl className="grid gap-0 text-[0.95rem]">
            {[
              ['When', formatDateLong(trip.departureDate)],
              ['Pickup', `${trip.pickupTime}, ${trip.pickupPoint.replace(/^Near /, 'near ')}`],
              ...(trip.altitudeM ? [['Summit', `${trip.altitudeM.toLocaleString('en-IN')} m`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[5rem_1fr] gap-3 border-b border-dashed border-ink/20 py-2"><dt className="font-hand text-xl leading-6 text-ember">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
          <Countdown trip={trip} />
          <div className="relative z-10 mt-auto flex flex-wrap gap-2.5">
            {bookable && <Link to={`/trips/${trip.slug}/book`} className={buttonClass('primary', 'lg')}>Book your seat</Link>}
            <Link to={`/trips/${trip.slug}`} className={buttonClass('outline', 'lg')}>View details</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

// ---------- Elevation profile ----------
export function ElevationProfile({ points, className }: { points: ElevationPoint[]; className?: string }) {
  if (points.length < 2) return null;
  const pts = [...points].sort((a, b) => a.km - b.km);
  const W = 640, H = 240, padL = 48, padR = 24, padT = 34, padB = 34;
  const maxKm = pts[pts.length - 1].km;
  const minM = Math.floor((Math.min(...pts.map((p) => p.m)) - 100) / 200) * 200;
  const maxM = Math.ceil((Math.max(...pts.map((p) => p.m)) + 50) / 200) * 200;
  const x = (km: number) => padL + (km / maxKm) * (W - padL - padR);
  const y = (m: number) => padT + (1 - (m - minM) / (maxM - minM)) * (H - padT - padB);
  // Smooth curve through the points (Catmull-Rom → Bézier).
  const P = pts.map((p) => [x(p.km), y(p.m)] as const);
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const area = `${d} L${P[P.length - 1][0]},${H - padB} L${P[0][0]},${H - padB} Z`;
  const yTicks: number[] = [];
  for (let m = minM; m <= maxM; m += 200) yTicks.push(m);
  const xTicks = Array.from({ length: Math.floor(maxKm) + 1 }, (_, i) => i);
  return (
    <figure className={cn('rounded-2xl bg-cream p-4 ring-1 ring-line md:p-5', className)}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">Trail elevation, one way</span>
        <span className="text-sm text-muted">Approximate, from published trail data</span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[30rem]" role="img" aria-label={`Elevation rises from ${pts[0].m} m to ${pts[pts.length - 1].m} m over about ${maxKm} km`}>
          <defs>
            <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#103D2B" stopOpacity="0.35" />
              <stop offset="1" stopColor="#103D2B" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {yTicks.map((m) => (
            <g key={m}>
              <line x1={padL} x2={W - padR} y1={y(m)} y2={y(m)} stroke="#17221C" strokeOpacity="0.08" />
              <text x={padL - 8} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#56645B" className="tabular">{m.toLocaleString('en-IN')}</text>
            </g>
          ))}
          {xTicks.map((k) => (
            <text key={k} x={x(k)} y={H - padB + 18} textAnchor="middle" fontSize="11" fill="#56645B">{k} km</text>
          ))}
          <path d={area} fill="url(#elev-fill)" />
          <path d={d} fill="none" stroke="#103D2B" strokeWidth="2.5" strokeLinejoin="round" />
          {pts.map((p, i) => {
            const last = i === pts.length - 1;
            return (
              <g key={p.km}>
                <circle cx={x(p.km)} cy={y(p.m)} r={last ? 6 : 4.5} fill={last ? '#F46A27' : '#FFF8E9'} stroke="#103D2B" strokeWidth="2" />
                <text x={x(p.km)} y={y(p.m) - 13} textAnchor={i === 0 ? 'start' : last ? 'end' : 'middle'} fontSize="12" fontWeight="600" fill="#17221C">
                  {p.label ? `${p.label} · ` : ''}{p.m.toLocaleString('en-IN')} m
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

// ---------- Itinerary ----------
export function Itinerary({ steps }: { steps: ItineraryStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => (
        <li key={i} className="relative grid grid-cols-[5.5rem_1.5rem_1fr] gap-x-3 pb-7 last:pb-0 sm:grid-cols-[7.5rem_1.5rem_1fr]">
          <span className="pt-0.5 text-right text-[0.95rem] font-bold font-cond leading-tight text-forest">{s.time}</span>
          <span className="relative flex justify-center" aria-hidden>
            <span className={cn('relative z-10 mt-1 size-3.5 rounded-full border-2 border-forest', i === 0 ? 'bg-orange' : 'bg-cream')} />
            {i < steps.length - 1 && <span className="absolute top-5 bottom-[-1.75rem] w-px bg-forest/25" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{s.title}</p>
            {s.detail && <p className="mt-1 text-muted">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------- Inclusions ----------
export const INCLUSION_ICON: Record<InclusionKey, LucideIcon> = {
  transport: Bus, breakfast: Coffee, lunch: UtensilsCrossed, dinner: Soup, snacks: Cookie, permit: FileCheck2,
  trek_fee: IndianRupee, guide: Footprints, first_aid: HeartPulse, stay: BedDouble, camping_gear: Tent, bonfire: Flame,
  photos: Camera, other: Sparkles,
};
export function InclusionGrid({ items }: { items: Inclusion[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => {
        const Icon = INCLUSION_ICON[it.key] ?? Sparkles;
        return (
          <li key={it.key + it.label} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-line">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest text-cream"><Icon size={19} aria-hidden /></span>
            <span className="font-semibold leading-tight">{it.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
