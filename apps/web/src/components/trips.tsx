import { Link } from 'react-router-dom';
import {
  CalendarDays, Clock, MapPin, Bus, Coffee, UtensilsCrossed, Soup, Cookie, FileCheck2, IndianRupee, Footprints,
  HeartPulse, BedDouble, Tent, Flame, Camera, Sparkles, Mountain, type LucideIcon,
} from 'lucide-react';
import {
  CATEGORY_LABEL, formatDate, formatINR, departureInstant, dayOfMonth, monthShort, weekdayLong, isBookable,
  type TripView, type InclusionKey, type ElevationPoint, type ItineraryStep, type Inclusion,
} from '@jzt/shared';
import { cn } from '../lib/cn';
import { useCountdown } from '../lib/useCountdown';
import { Img, StatusPill, SampleTag, buttonClass } from './ui';

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
        <div key={label} className={cn('flex min-w-[3.6rem] flex-col items-center rounded-xl px-2 py-1.5', light ? 'bg-cream/10' : 'bg-forest/[.07]')}>
          <span className="font-display text-2xl font-bold leading-none tabular">{String(n).padStart(2, '0')}</span>
          <span className={cn('mt-1 text-[0.7rem] font-medium', light ? 'text-cream/70' : 'text-muted')}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Trip card ----------
export function TripCard({ trip, className }: { trip: TripView; className?: string }) {
  return (
    <article className={cn('group relative flex flex-col overflow-hidden rounded-[1.4rem] bg-white ring-1 ring-line transition-shadow duration-300 hover:shadow-[0_24px_50px_-28px_rgba(16,61,43,.45)]', className)}>
      <div className="relative">
        <Img src={trip.coverImage.url} alt={trip.coverImage.alt} ratio={4 / 3} imgClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <StatusPill status={trip.status} />
          <span className="rounded-full bg-ink/60 px-2.5 py-1 text-xs font-semibold text-cream backdrop-blur-sm">{CATEGORY_LABEL[trip.category]}</span>
        </div>
        {trip.departureDate && (
          <div className="absolute bottom-3 left-3 flex flex-col items-center rounded-xl bg-cream px-3 py-1.5 text-forest shadow">
            <span className="font-display text-2xl font-bold leading-none tabular">{dayOfMonth(trip.departureDate)}</span>
            <span className="text-[0.7rem] font-semibold">{monthShort(trip.departureDate)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[1.6rem] font-bold leading-tight">
              <Link to={`/trips/${trip.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{trip.title}</Link>
            </h3>
            {trip.isDemo && <SampleTag className="text-ember" />}
          </div>
          <p className="mt-1 text-muted">{trip.destination}{trip.region ? `, ${trip.region}` : ''}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 text-[0.93rem]">
          <dt className="text-muted"><CalendarDays size={16} aria-label="Date" /></dt>
          <dd>{formatDate(trip.departureDate)}</dd>
          <dt className="text-muted"><Clock size={16} aria-label="Duration" /></dt>
          <dd>{trip.durationLabel}</dd>
          <dt className="text-muted"><MapPin size={16} aria-label="Pickup" /></dt>
          <dd className="min-w-0">{trip.pickupTime ? `${trip.pickupTime}, ` : ''}{trip.pickupCity || trip.pickupPoint}</dd>
        </dl>
        <SeatMeter trip={trip} compact />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-xs text-muted">{trip.isDemo ? 'Sample price' : 'Price per person'}</p>
            <p className="font-display text-[1.7rem] font-bold leading-none tabular">{trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'}</p>
          </div>
          <span className={buttonClass('outline', 'sm', 'relative group-hover:border-ink')} aria-hidden>View details</span>
        </div>
      </div>
    </article>
  );
}

// ---------- Featured ticket (wide) ----------
export function FeaturedTrip({ trip }: { trip: TripView }) {
  const bookable = isBookable(trip);
  return (
    <article className="group relative grid overflow-hidden rounded-[1.6rem] bg-forest text-cream md:grid-cols-[1.15fr_1fr_auto]">
      <div className="relative min-h-64">
        <div className="absolute inset-0"><Img src={trip.coverImage.url} alt={trip.coverImage.alt} className="h-full" imgClassName="transition-transform duration-700 group-hover:scale-[1.03]" /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest/70 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-forest/40" />
        <span className="absolute left-4 top-4 rounded-full bg-cream px-3 py-1 text-xs font-bold text-forest">Our first official trip</span>
      </div>
      <div className="relative flex flex-col gap-5 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={trip.status} />
          <span className="text-sm text-cream/70">{CATEGORY_LABEL[trip.category]} · {trip.durationLabel}</span>
        </div>
        <div>
          <h3 className="font-display text-[clamp(2.2rem,4vw,3.2rem)] font-extrabold leading-[0.95]">
            <Link to={`/trips/${trip.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none md:after:right-[-12rem]">{trip.title}</Link>
          </h3>
          <p className="mt-3 max-w-md text-cream/80">{trip.summary}</p>
        </div>
        <ul className="grid gap-2 text-[0.95rem]">
          {trip.altitudeM && <li className="flex items-center gap-2"><Mountain size={17} className="text-orange" aria-hidden /> {trip.altitudeM.toLocaleString('en-IN')} m summit</li>}
          <li className="flex items-center gap-2"><MapPin size={17} className="text-orange" aria-hidden /> Pickup {trip.pickupTime}, {trip.pickupPoint.replace(/^Near /, 'near ')}</li>
          <li className="flex items-center gap-2"><IndianRupee size={17} className="text-orange" aria-hidden /> {trip.priceInr != null ? formatINR(trip.priceInr) : 'TBA'} per person, all inclusive</li>
        </ul>
        <div className="relative z-10 mt-auto flex flex-wrap gap-2.5">
          {bookable && <Link to={`/trips/${trip.slug}/book`} className={buttonClass('primary', 'md')}>Book your seat</Link>}
          <Link to={`/trips/${trip.slug}`} className={buttonClass('outline-light', 'md')}>View details</Link>
        </div>
      </div>
      {trip.departureDate && (
        <div className="relative flex items-center justify-between gap-4 border-t border-dashed border-cream/30 bg-cream px-6 py-5 text-forest md:w-44 md:flex-col md:justify-center md:border-l md:border-t-0 md:px-4">
          <span className="absolute -left-3 top-1/2 hidden size-6 -translate-y-1/2 rounded-full bg-paper md:block" aria-hidden />
          <div className="md:text-center">
            <p className="text-sm font-semibold">{weekdayLong(trip.departureDate)}</p>
            <p className="font-display text-6xl font-extrabold leading-none tabular">{dayOfMonth(trip.departureDate)}</p>
            <p className="font-display text-xl font-bold">{monthShort(trip.departureDate)} {trip.departureDate.slice(0, 4)}</p>
          </div>
          <div className="md:mt-4 md:text-center">
            <p className="text-xs text-muted">Pickup</p>
            <p className="font-semibold tabular">{trip.pickupTime}</p>
          </div>
        </div>
      )}
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
