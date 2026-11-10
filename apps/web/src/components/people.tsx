import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mountain, BadgeCheck, Languages, Play, ExternalLink } from 'lucide-react';
import { LEADER_ROLE_LABEL, formatDate, isPlaceholder, type Leader, type Review, type MediaItem, type PassportStamp } from '@jzt/shared';
import { cn } from '../lib/cn';
import { img } from '../lib/images';
import { Img, Txt, Stars, SampleTag, Lightbox } from './ui';

// ---------- Leaders ----------
function LeaderPhoto({ leader, className }: { leader: Leader; className?: string }) {
  if (leader.photoUrl) return <Img src={leader.photoUrl} alt={`Portrait of ${leader.name}`} className={className} ratio={4 / 5} />;
  return (
    <div className={cn('relative grid place-items-center overflow-hidden bg-forest text-cream/80', className)} style={{ aspectRatio: '4 / 5' }}>
      <Mountain size={56} strokeWidth={1.2} aria-hidden />
      <span className="absolute bottom-3 rounded-full border border-dashed border-cream/50 px-2.5 py-1 text-xs">Photo coming soon</span>
    </div>
  );
}

export function LeaderStats({ leader, light }: { leader: Leader; light?: boolean }) {
  const stats = [
    leader.yearsExperience != null && { n: leader.yearsExperience, label: leader.yearsExperience === 1 ? 'year leading trips' : 'years leading trips' },
    leader.tripsLed != null && { n: leader.tripsLed, label: leader.tripsLed === 1 ? 'trip led' : 'trips led' },
    leader.destinations.length > 0 && { n: leader.destinations.length, label: leader.destinations.length === 1 ? 'destination explored' : 'destinations explored' },
  ].filter(Boolean) as { n: number; label: string }[];
  if (!stats.length) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="sr-only">{s.label}</dt>
          <dd className="flex items-baseline gap-1.5"><span className="font-display text-2xl font-bold tabular">{s.n}</span><span className={cn('text-sm', light ? 'text-cream/70' : 'text-muted')}>{s.label}</span></dd>
        </div>
      ))}
    </dl>
  );
}

export function LeaderCard({ leader }: { leader: Leader }) {
  const pending = isPlaceholder(leader.name);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[1.4rem] bg-white ring-1 ring-line">
      <LeaderPhoto leader={leader} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ember">{LEADER_ROLE_LABEL[leader.role]}</span>
          {leader.isDemo && <SampleTag className="text-muted">Profile to fill in</SampleTag>}
        </div>
        <h3 className="font-display text-2xl font-bold leading-tight">
          <Link to={`/leaders/${leader.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {pending ? <Txt>{leader.name}</Txt> : leader.name}
          </Link>
        </h3>
        <Txt as="p" className="text-muted">{leader.intro}</Txt>
        <LeaderStats leader={leader} />
        {leader.specializations.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {leader.specializations.map((s) => <li key={s} className="rounded-full bg-sage px-2.5 py-1 text-xs font-semibold text-forest">{s}</li>)}
          </ul>
        )}
        {leader.languages.length > 0 && <p className="flex items-center gap-1.5 text-sm text-muted"><Languages size={15} aria-hidden /> {leader.languages.join(', ')}</p>}
        {leader.philosophy && <Txt as="p" className="mt-auto border-l-2 border-orange pl-3 font-display text-lg italic leading-snug">{leader.philosophy}</Txt>}
      </div>
    </article>
  );
}

// ---------- Reviews ----------
export function ReviewCard({ review, className }: { review: Review; className?: string }) {
  return (
    <figure className={cn('flex flex-col gap-4 rounded-[1.4rem] p-6', review.isDemo ? 'border border-dashed border-ink/25 bg-white/60' : 'bg-white ring-1 ring-line', className)}>
      <div className="flex items-center justify-between gap-2">
        <Stars value={review.rating} />
        <div className="flex gap-1.5">
          {review.isDemo && <SampleTag className="text-ember">Sample, not a real review</SampleTag>}
          {review.isVerified && <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-xs font-semibold text-forest"><BadgeCheck size={14} aria-hidden /> Verified traveller</span>}
          {review.source === 'google' && <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold ring-1 ring-line">From Google</span>}
        </div>
      </div>
      <blockquote className="font-display text-[1.2rem] leading-snug">“{review.body}”</blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        {review.photoUrl ? (
          <img src={img(review.photoUrl)} alt="" className="size-11 rounded-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-11 place-items-center rounded-full bg-forest font-display text-lg font-bold text-cream" aria-hidden>{review.name.slice(0, 1)}</span>
        )}
        <div>
          <p className="font-semibold">{review.name}</p>
          <p className="text-sm text-muted">{review.tripName}{review.experienceDate ? ` · ${formatDate(review.experienceDate, { weekday: false })}` : ''}</p>
        </div>
      </figcaption>
    </figure>
  );
}

// ---------- Masonry photo wall ----------
export function MemoryWall({ items, columns = 'columns-2 md:columns-3' }: { items: MediaItem[]; columns?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = items.filter((m) => m.kind === 'image');
  return (
    <>
      <ul className={cn(columns, 'gap-3 [&>li]:mb-3')}>
        {items.map((m, i) => {
          const tall = i % 3 === 1;
          if (m.kind === 'video') {
            return (
              <li key={m.url + i} className="break-inside-avoid">
                <figure className="overflow-hidden rounded-2xl bg-ink">
                  {m.externalUrl ? (
                    <a href={m.externalUrl} target="_blank" rel="noopener noreferrer" className="relative block">
                      {m.poster ? <img src={img(m.poster)} alt={m.alt} className="w-full" loading="lazy" /> : <div className="aspect-[9/16] w-full bg-forest" />}
                      <span className="absolute inset-0 grid place-items-center"><span className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 font-semibold text-ink"><Play size={16} /> Watch reel <ExternalLink size={14} /></span></span>
                    </a>
                  ) : (
                    <video src={img(m.url)} poster={m.poster ? img(m.poster) : undefined} controls preload="none" playsInline className="w-full" aria-label={m.alt} />
                  )}
                  {m.caption && <figcaption className="p-3 text-sm text-cream/80">{m.caption}</figcaption>}
                </figure>
              </li>
            );
          }
          const idx = images.indexOf(m);
          return (
            <li key={m.url + i} className="break-inside-avoid">
              <button onClick={() => setOpen(idx)} className="group block w-full overflow-hidden rounded-2xl text-left" aria-label={`Open photo: ${m.alt}`}>
                <Img src={m.url} alt={m.alt} ratio={tall ? 4 / 5 : 4 / 3} imgClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
              </button>
            </li>
          );
        })}
      </ul>
      <Lightbox items={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  );
}

// ---------- Passport stamp ----------
export function PassportStampBadge({ stamp, locked, index = 0 }: { stamp: Pick<PassportStamp, 'destination' | 'date' | 'altitudeM' | 'state'>; locked?: boolean; index?: number }) {
  const rot = [-6, 4, -2, 7, -4][index % 5];
  const color = locked ? '#9AA39C' : stamp.state === 'completed' ? '#103D2B' : '#B0440E';
  const label = stamp.destination.toUpperCase();
  const id = `arc-${index}-${label.replace(/\W/g, '')}`;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 160 160" className="w-36" style={{ transform: `rotate(${rot}deg)` }} role="img" aria-label={`${stamp.destination}${locked ? ', not yet earned' : stamp.state === 'completed' ? ', completed' : ', upcoming'}`}>
        <defs><path id={id} d="M 80 80 m -56 0 a 56 56 0 1 1 112 0" /></defs>
        <circle cx="80" cy="80" r="74" fill="none" stroke={color} strokeWidth="3" strokeDasharray={stamp.state === 'upcoming' && !locked ? '6 5' : undefined} />
        <circle cx="80" cy="80" r="66" fill="none" stroke={color} strokeWidth="1.2" />
        <text fontSize="13" fontWeight="700" letterSpacing="2" fill={color} fontFamily="Anek Latin, sans-serif"><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{label}</textPath></text>
        <path d="M44 104 L66 74 L78 88 L92 64 L116 104 Z" fill={color} opacity={locked ? 0.35 : 0.9} />
        <text x="80" y="124" textAnchor="middle" fontSize="12" fontWeight="700" fill={color} fontFamily="Anek Latin, sans-serif">
          {locked ? 'TO EARN' : stamp.altitudeM ? `${stamp.altitudeM.toLocaleString('en-IN')} M` : stamp.state === 'completed' ? 'DONE' : 'SOON'}
        </text>
      </svg>
      <p className={cn('text-center text-sm font-semibold', locked && 'text-muted')}>{stamp.date && !locked ? formatDate(stamp.date, { weekday: false }) : locked ? 'Not yet' : 'Date TBA'}</p>
    </div>
  );
}
