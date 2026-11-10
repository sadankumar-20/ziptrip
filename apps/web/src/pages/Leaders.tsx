import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Languages, Camera, Mountain } from 'lucide-react';
import { LEADER_ROLE_LABEL, isPlaceholder } from '@jzt/shared';
import { useLeaders, useLeader, useTrips } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { IS_DEMO } from '../lib/config';
import { PageHero } from '../components/layout';
import { Img, Txt, SampleTag, Skeleton, ErrorState, EmptyState, ButtonA, ButtonLink } from '../components/ui';
import { LeaderCard, LeaderStats } from '../components/people';
import { TripCard } from '../components/trips';
import NotFound from './NotFound';

export function Leaders() {
  const { data: leaders, isLoading, isError, refetch } = useLeaders();
  return (
    <>
      <Seo title="Trip leaders" path="/leaders" description="Meet the JoinZipTrip founders, trek leaders and coordinators who travel with every group." />
      <PageHero title="The people who travel with you" intro="Every JoinZipTrip group has a trip leader from our team, along with a local guide on the trail. Get to know them before you go." tone="forest" />
      <section className="gutter">
        <div className="shell py-12">
          {IS_DEMO && <p className="mb-6 rounded-xl bg-cream p-4 text-sm text-muted">These profiles are waiting for real names, photos and details. Experience and trip counts stay hidden until the owner enters verified figures in the admin dashboard.</p>}
          {isLoading && <div className="grid gap-5 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[30rem]" />)}</div>}
          {isError && <ErrorState onRetry={() => refetch()} />}
          {leaders && leaders.length === 0 && <EmptyState title="Profiles coming soon">Our team’s profiles will be added here shortly.</EmptyState>}
          {leaders && leaders.length > 0 && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{leaders.map((l) => <LeaderCard key={l.id} leader={l} />)}</div>}
        </div>
      </section>
    </>
  );
}

export function LeaderDetail() {
  const { slug = '' } = useParams();
  const { data: leader, isLoading, error, refetch } = useLeader(slug);
  const { data: trips } = useTrips();
  if (isLoading) return <div className="gutter"><div className="shell grid gap-6 py-10 md:grid-cols-[22rem_1fr]"><Skeleton className="h-[28rem]" /><Skeleton className="h-80" /></div></div>;
  if ((error as { status?: number })?.status === 404) return <NotFound what="profile" />;
  if (error || !leader) return <div className="gutter"><div className="shell py-16"><ErrorState onRetry={() => refetch()} /></div></div>;
  const assigned = (trips ?? []).filter((t) => t.leaderIds.includes(leader.id) && t.status !== 'departed');
  const pending = isPlaceholder(leader.name);
  return (
    <>
      <Seo title={pending ? LEADER_ROLE_LABEL[leader.role] : `${leader.name}, ${LEADER_ROLE_LABEL[leader.role]}`} path={`/leaders/${leader.slug}`} description={isPlaceholder(leader.intro) ? undefined : leader.intro} noindex={leader.isDemo} />
      <div className="gutter">
        <div className="shell py-10 md:py-14">
          <Link to="/leaders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"><ArrowLeft size={16} /> All trip leaders</Link>
          <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-14">
            <div className="overflow-hidden rounded-[1.6rem]">
              {leader.photoUrl ? <Img src={leader.photoUrl} alt={`Portrait of ${leader.name}`} ratio={4 / 5} eager /> : (
                <div className="grid place-items-center bg-forest text-cream/70" style={{ aspectRatio: '4 / 5' }}><Mountain size={72} strokeWidth={1.1} aria-hidden /></div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ember">{LEADER_ROLE_LABEL[leader.role]}</span>
                {leader.isDemo && <SampleTag className="text-muted">Profile to fill in</SampleTag>}
              </div>
              <h1 className="font-display text-[clamp(2.6rem,6vw,4.6rem)] font-extrabold leading-[0.95]">{pending ? <Txt>{leader.name}</Txt> : leader.name}</h1>
              <Txt as="p" className="max-w-prose text-xl text-muted">{leader.intro}</Txt>
              <LeaderStats leader={leader} />
              {leader.philosophy && <Txt as="p" className="max-w-prose border-l-4 border-orange pl-4 font-display text-2xl italic leading-snug">{leader.philosophy}</Txt>}
              {leader.story && (
                <div>
                  <h2 className="font-display text-2xl font-bold">Travel story</h2>
                  <div className="prose-trip mt-3 max-w-prose text-lg leading-relaxed">{leader.story.split(/\n\n+/).map((p, i) => <Txt as="p" key={i}>{p}</Txt>)}</div>
                </div>
              )}
              <dl className="grid gap-5 sm:grid-cols-2">
                {leader.specializations.length > 0 && <div><dt className="text-sm font-semibold text-muted">Areas of expertise</dt><dd className="mt-2 flex flex-wrap gap-1.5">{leader.specializations.map((s) => <span key={s} className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-forest">{s}</span>)}</dd></div>}
                {leader.destinations.length > 0 && <div><dt className="text-sm font-semibold text-muted">Trekking destinations</dt><dd className="mt-2">{leader.destinations.join(', ')}</dd></div>}
                {leader.languages.length > 0 && <div><dt className="text-sm font-semibold text-muted">Languages</dt><dd className="mt-2 flex items-center gap-1.5"><Languages size={16} aria-hidden /> {leader.languages.join(', ')}</dd></div>}
              </dl>
              {leader.instagram && <ButtonA href={`https://www.instagram.com/${leader.instagram.replace(/^@/, '')}/`} variant="outline" className="self-start"><Camera size={17} /> @{leader.instagram.replace(/^@/, '')}</ButtonA>}
            </div>
          </div>
          <section className="mt-16">
            <h2 className="font-display text-3xl font-bold">Upcoming trips with {pending ? 'this leader' : leader.name.split(' ')[0]}</h2>
            {assigned.length ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{assigned.map((t) => <TripCard key={t.id} trip={t} />)}</div>
            ) : (
              <EmptyState className="mt-6" title="No trips assigned yet" action={<ButtonLink to="/trips" variant="forest" size="sm">See all trips</ButtonLink>} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
