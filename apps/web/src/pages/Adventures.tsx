import { Link, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Users, Mountain, ArrowLeft } from 'lucide-react';
import { formatDate, isPlaceholder } from '@jzt/shared';
import { useAlbums, useAlbum, useLeaders, useReviews } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { img } from '../lib/images';
import { PageHero } from '../components/layout';
import { Img, Txt, SampleTag, Skeleton, ErrorState, EmptyState, ButtonLink } from '../components/ui';
import { MemoryWall, ReviewCard } from '../components/people';
import NotFound from './NotFound';

export function PastAdventures() {
  const { data: albums, isLoading, isError, refetch } = useAlbums();
  return (
    <>
      <Seo title="Past adventures" path="/past-adventures" description="Photos, reels and stories from completed JoinZipTrip treks and group trips." />
      <PageHero title="Past adventures" intro="Look through earlier trips before you book your next one. Each album has the story, the trip leader and the group’s photos." />
      <section className="gutter">
        <div className="shell py-12">
          {isLoading && <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>}
          {isError && <ErrorState onRetry={() => refetch()} />}
          {albums && albums.length === 0 && (
            <EmptyState title="Our first adventure is coming up" action={<ButtonLink to="/trips" variant="forest" size="sm">See upcoming trips</ButtonLink>}>
              Albums are added after each trip. The first one will be from Thadiyandamol.
            </EmptyState>
          )}
          {albums && albums.length > 0 && (
            <ul className="grid gap-6 md:grid-cols-2">
              {albums.map((a) => (
                <li key={a.id}>
                  <article className="group relative overflow-hidden rounded-[1.6rem] bg-forest text-cream">
                    <Img src={a.coverUrl ?? a.media[0]?.url ?? 'asset:summit-clouds'} alt={a.media[0]?.alt ?? a.title} ratio={4 / 3} imgClassName="transition-transform duration-700 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-forest-deep via-forest-deep/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6">
                      {a.isDemo && <SampleTag className="self-start text-cream">Sample album</SampleTag>}
                      <h2 className="font-display text-3xl font-bold"><Link to={`/past-adventures/${a.slug}`} className="after:absolute after:inset-0 after:content-['']">{a.title}</Link></h2>
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-cream/80">
                        <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {a.location}</span>
                        <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden /> {a.tripDate ? formatDate(a.tripDate, { weekday: false }) : 'Date not set'}</span>
                        <span>{a.media.length} photos & videos</span>
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

export function AlbumDetail() {
  const { slug = '' } = useParams();
  const { data: a, isLoading, error, refetch } = useAlbum(slug);
  const { data: leaders } = useLeaders();
  const { data: reviews } = useReviews();
  if (isLoading) return <div className="gutter"><div className="shell grid gap-6 py-10"><Skeleton className="h-80" /><Skeleton className="h-96" /></div></div>;
  if ((error as { status?: number })?.status === 404) return <NotFound what="album" />;
  if (error || !a) return <div className="gutter"><div className="shell py-16"><ErrorState onRetry={() => refetch()} /></div></div>;
  const leader = leaders?.find((l) => l.id === a.leaderId);
  const tripReviews = (reviews ?? []).filter((r) => a.tripId && r.tripId === a.tripId);
  return (
    <>
      <Seo title={a.title} path={`/past-adventures/${a.slug}`} description={a.story.slice(0, 155)} image={img(a.coverUrl ?? '')} noindex={a.isDemo} />
      <section className="relative isolate overflow-hidden bg-forest-deep text-cream">
        <img src={img(a.coverUrl ?? a.media[0]?.url)} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
        <div className="gutter">
          <div className="shell py-16 md:py-24">
            <Link to="/past-adventures" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream/85 hover:text-cream"><ArrowLeft size={16} /> All adventures</Link>
            {a.isDemo && <SampleTag className="ml-3 text-cream">Sample album with stand-in photos</SampleTag>}
            <h1 className="mt-5 font-display text-[clamp(2.8rem,7vw,5.6rem)] font-extrabold leading-[0.95]">{a.title}</h1>
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              <div><dt className="text-sm text-cream/70">Location</dt><dd className="flex items-center gap-1.5 font-semibold"><MapPin size={16} aria-hidden /> {a.location}</dd></div>
              <div><dt className="text-sm text-cream/70">Date</dt><dd className="flex items-center gap-1.5 font-semibold"><CalendarDays size={16} aria-hidden /> {a.tripDate ? formatDate(a.tripDate) : 'Not set'}</dd></div>
              {a.participants != null && <div><dt className="text-sm text-cream/70">Travellers</dt><dd className="flex items-center gap-1.5 font-semibold"><Users size={16} aria-hidden /> {a.participants}</dd></div>}
              {leader && <div><dt className="text-sm text-cream/70">Trip leader</dt><dd className="flex items-center gap-1.5 font-semibold"><Mountain size={16} aria-hidden /> <Link className="underline underline-offset-4" to={`/leaders/${leader.slug}`}>{isPlaceholder(leader.name) ? 'Profile' : leader.name}</Link></dd></div>}
            </dl>
          </div>
        </div>
      </section>
      <div className="gutter">
        <div className="shell grid gap-12 py-14">
          <Txt as="p" className="max-w-prose text-lg leading-relaxed">{a.story}</Txt>
          <div>
            <h2 className="mb-5 font-display text-3xl font-bold">Photos and videos</h2>
            <MemoryWall items={a.media} columns="columns-2 md:columns-3 lg:columns-4" />
          </div>
          {tripReviews.length > 0 && (
            <div>
              <h2 className="mb-5 font-display text-3xl font-bold">From the travellers</h2>
              <div className="grid gap-5 md:grid-cols-2">{tripReviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-3"><ButtonLink to="/trips">Book the next one</ButtonLink><ButtonLink to="/past-adventures" variant="outline">More adventures</ButtonLink></div>
        </div>
      </div>
    </>
  );
}
