import { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, TRIP_CATEGORIES, DIFFICULTIES, formatINR, type TripCategory, type Difficulty } from '@jzt/shared';
import { useTrips } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { cn } from '../lib/cn';
import { PageHero } from '../components/layout';
import { Select, Skeleton, ErrorState, EmptyState } from '../components/ui';
import { TripCard } from '../components/trips';
import { sortTrips, type SortKey } from './Home';
import { FinalCta } from './Home';

type Duration = 'any' | 'one-day' | 'weekend';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn('h-10 rounded-full px-4 text-sm font-semibold transition-colors', active ? 'bg-forest text-cream' : 'bg-white ring-1 ring-line hover:ring-ink/40')}>
      {children}
    </button>
  );
}

export default function Trips() {
  const { data: trips, isLoading, isError, refetch } = useTrips();
  const [cats, setCats] = useState<TripCategory[]>([]);
  const [diffs, setDiffs] = useState<Difficulty[]>([]);
  const [duration, setDuration] = useState<Duration>('any');
  const [sort, setSort] = useState<SortKey>('date');
  const [showPast, setShowPast] = useState(false);
  const maxPrice = useMemo(() => Math.max(1000, ...(trips ?? []).map((t) => t.priceInr ?? 0)), [trips]);
  const [budget, setBudget] = useState<number | null>(null);
  const cap = budget ?? maxPrice;

  const toggle = <T,>(list: T[], v: T, set: (x: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const reset = () => { setCats([]); setDiffs([]); setDuration('any'); setBudget(null); setSort('date'); };

  const results = useMemo(() => {
    const list = (trips ?? []).filter((t) =>
      (showPast || t.status !== 'departed') &&
      (!cats.length || cats.includes(t.category)) &&
      (!diffs.length || diffs.includes(t.difficulty)) &&
      (duration === 'any' || (duration === 'one-day' ? t.durationDays === 1 : t.durationDays >= 2)) &&
      (t.priceInr == null || t.priceInr <= cap));
    return sortTrips(list, sort);
  }, [trips, cats, diffs, duration, cap, sort, showPast]);

  const active = cats.length + diffs.length + (duration !== 'any' ? 1 : 0) + (budget != null ? 1 : 0);

  return (
    <>
      <Seo title="Explore trips" path="/trips" description="Find your next trek, weekend getaway or group trip from Mysuru. Filter by interest, duration, budget and difficulty." />
      <PageHero title="Find your next adventure" intro="Filter by what you’re into, how long you can get away, what you want to spend and how hard you want to push." />
      <section className="gutter">
        <div className="shell grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-12">
          <aside aria-label="Trip filters" className="flex flex-col gap-7 lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={18} aria-hidden /> Filters {active > 0 && <span className="rounded-full bg-orange px-2 text-xs text-ink">{active}</span>}</p>
              {active > 0 && <button onClick={reset} className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><RotateCcw size={14} /> Reset</button>}
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-muted">Interest</legend>
              <div className="flex flex-wrap gap-2">
                {TRIP_CATEGORIES.map((c) => <Chip key={c} active={cats.includes(c)} onClick={() => toggle(cats, c, setCats)}>{CATEGORY_LABEL[c]}</Chip>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-muted">Duration</legend>
              <div className="flex flex-wrap gap-2">
                {([['any', 'Any length'], ['one-day', 'One day'], ['weekend', '2+ days']] as const).map(([v, l]) => <Chip key={v} active={duration === v} onClick={() => setDuration(v)}>{l}</Chip>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 flex w-full items-baseline justify-between text-sm font-semibold text-muted">Budget per person <span className="text-ink tabular">up to {formatINR(cap)}</span></legend>
              <input id="budget" type="range" min={500} max={maxPrice} step={100} value={cap} onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-[var(--color-forest)]" aria-label="Maximum price per person" />
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-muted">Difficulty</legend>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => <Chip key={d} active={diffs.includes(d)} onClick={() => toggle(diffs, d, setDiffs)}>{DIFFICULTY_LABEL[d]}</Chip>)}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="size-4 accent-[var(--color-forest)]" /> Include completed trips
            </label>
          </aside>
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted" aria-live="polite">{isLoading ? 'Loading trips…' : `${results.length} trip${results.length === 1 ? '' : 's'}`}</p>
              <label className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
                Sort by
                <Select id="trips-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 w-48 text-sm">
                  <option value="date">Date: soonest first</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </Select>
              </label>
            </div>
            {isLoading && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[30rem]" />)}</div>}
            {isError && <ErrorState onRetry={() => refetch()} />}
            {trips && (results.length ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{results.map((t) => <TripCard key={t.id} trip={t} />)}</div>
            ) : (
              <EmptyState title="Nothing matches those filters" action={<button onClick={reset} className="font-semibold text-forest underline underline-offset-4">Clear filters</button>}>
                Try a higher budget or a different trip length. New trips are announced on Instagram first.
              </EmptyState>
            ))}
          </div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
