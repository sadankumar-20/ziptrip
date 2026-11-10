import { MessageCircle, Camera, UserRound, UsersRound, HeartHandshake } from 'lucide-react';
import { formatDate, waLink } from '@jzt/shared';
import { useAlbums, useReviews, useSettings, useTrips } from '../lib/hooks';
import { Seo } from '../lib/seo';
import { CONTOURS } from '../lib/images';
import { instaUrl } from '../components/layout';
import { ButtonA, ButtonLink, SampleTag, Skeleton, Polaroid, HandNote, Wave } from '../components/ui';
import { MemoryWall, ReviewCard } from '../components/people';
import { featuredOf } from './Home';

const DAY = [
  { time: 'Before the trip', title: 'A name in the booking list', text: 'You book one seat. So does everyone else. Your trip leader has the full list and checks every name.' },
  { time: '4:00 AM', title: 'Hellos at the pickup point', text: 'Sleepy faces near the station gate. The leader does a quick round of names before the vehicle rolls out.' },
  { time: 'On the road', title: 'The playlist argument', text: 'Somewhere between breakfast and the hills, someone takes over the music. Conversation follows.' },
  { time: 'On the trail', title: 'Trail buddies', text: 'People find their pace and their people. Someone always shares snacks. Someone always waits at the turn.' },
  { time: 'At the top', title: 'The summit photo', text: 'Everyone in one frame. This is usually when strangers become “we”.' },
  { time: 'Ride home', title: 'Numbers get saved', text: 'Photos get swapped, numbers get saved, and someone always asks where the next trip is.' },
];

export default function Tribe() {
  const s = useSettings();
  const { data: albums, isLoading } = useAlbums();
  const { data: reviews } = useReviews();
  const { data: trips } = useTrips();
  const media = (albums ?? []).flatMap((a) => a.media.map((m) => ({ ...m, caption: m.caption ?? a.title })));
  const anyDemo = (albums ?? []).some((a) => a.isDemo);
  const completedTrips = (trips ?? []).filter((t) => t.status === 'departed' && !t.isDemo).length;
  const next = featuredOf(trips);

  return (
    <>
      <Seo title="Our tribe" path="/tribe" description="Strangers on day one. Travel buddies for life. How JoinZipTrip brings solo travellers and friends together on the trail." />
      <section className="relative overflow-hidden bg-peach">
        <div aria-hidden className="absolute -left-24 -top-24 size-96 rounded-full bg-sun/50 blur-2xl" />
        <div className="gutter relative">
          <div className="shell grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <HandNote className="mb-2">Our tribe</HandNote>
              <h1 className="font-display text-[clamp(2.4rem,6.6vw,5.4rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em] text-forest">Strangers on day one. Travel buddies for life.</h1>
              <p className="mt-5 max-w-2xl text-lg text-ink/75 md:text-xl">JoinZipTrip is built for people who want to go, whether or not their friends can make it. Here’s who travels with us and how strangers turn into a crew in a single day.</p>
            </div>
            <div className="relative mx-auto h-72 w-full max-w-sm sm:h-80">
              <div className="absolute left-0 top-4 w-[55%]"><Polaroid src="asset:trekker" alt="A trekker looking out over misty hills" caption="day one" rotate={-6} eager /></div>
              <div className="absolute right-0 top-0 w-[55%]"><Polaroid src="asset:sunrise-clouds" alt="Sunrise over the clouds" caption="crew for life" rotate={6} eager /></div>
            </div>
          </div>
        </div>
        <Wave from="bg-peach" to="text-cream" />
      </section>

      <section className="bg-cream">
        <div className="gutter">
          <div className="shell grid gap-5 py-16 md:grid-cols-3 md:py-24">
            {[
              { icon: UserRound, t: 'People who travel solo', d: 'One seat, no plus-one needed. You’ll be part of the group from the first hello at pickup.' },
              { icon: UsersRound, t: 'Friends who want more friends', d: 'Bring your gang and mix with a bigger one. Groups book together and meet everyone else on the day.' },
              { icon: HeartHandshake, t: 'First-timers', d: 'Never trekked before? Most of our routes are beginner-friendly, and the guide sets a pace the whole group can keep.' },
            ].map(({ icon: Icon, t, d }) => (
              <article key={t} className="rounded-[1.4rem] bg-white p-7 ring-1 ring-line">
                <Icon className="text-ember" size={28} aria-hidden />
                <h2 className="mt-4 font-display text-2xl font-bold">{t}</h2>
                <p className="mt-2 text-muted">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-forest text-cream">
        <img src={CONTOURS} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[.08]" />
        <div className="gutter relative">
          <div className="shell py-20 md:py-28">
            <h2 className="max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[0.95]">How strangers become a crew</h2>
            <p className="mt-4 max-w-2xl text-lg text-cream/80">A typical one-day trek, from booking to the ride home.</p>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-[1.4rem] bg-cream/15 md:grid-cols-3">
              {DAY.map((d) => (
                <li key={d.title} className="flex flex-col gap-2 bg-forest p-6">
                  <span className="text-sm font-bold font-cond text-orange">{d.time}</span>
                  <span className="font-display text-2xl font-bold">{d.title}</span>
                  <span className="text-cream/75">{d.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="gutter">
          <div className="shell py-20 md:py-28">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-display text-[clamp(2rem,4.4vw,3.4rem)] font-bold">Memory wall</h2>
                <p className="mt-2 max-w-2xl text-lg text-muted">Moments from our trips. Tap any photo to see it larger.</p>
              </div>
              {anyDemo && <SampleTag className="self-start text-ember">Stand-in photos until the first trip</SampleTag>}
            </div>
            {isLoading ? <Skeleton className="mt-10 h-96" /> : media.length ? <div className="mt-10"><MemoryWall items={media.slice(0, 12)} columns="columns-2 md:columns-3 lg:columns-4" /></div> : <p className="mt-10 rounded-2xl border border-dashed border-ink/20 p-8 text-lg text-muted">Photos from our first trek on 22 November will be the first on this wall.</p>}
          </div>
        </div>
      </section>

      <section className="bg-sand/60">
        <div className="gutter">
          <div className="shell grid gap-10 py-20 md:grid-cols-[1fr_1.2fr] md:py-28">
            <div>
              <h2 className="font-display text-[clamp(2rem,4.4vw,3.4rem)] font-bold">Community highlights</h2>
              <dl className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white p-5 ring-1 ring-line"><dt className="text-sm text-muted">Trips completed</dt><dd className="font-display text-4xl font-bold tabular">{completedTrips}</dd></div>
                <div className="rounded-2xl bg-white p-5 ring-1 ring-line"><dt className="text-sm text-muted">Next departure</dt><dd className="font-display text-2xl font-bold">{next ? formatDate(next.departureDate, { year: false }) : 'Soon'}</dd><dd className="text-sm text-muted">{next?.title}</dd></div>
              </dl>
              <p className="mt-6 text-muted">These figures come straight from our trip records, so they start small. Come and help them grow.</p>
            </div>
            <div className="grid gap-5">
              {(reviews ?? []).length ? (reviews ?? []).slice(0, 2).map((r) => <ReviewCard key={r.id} review={r} />) : <p className="rounded-2xl bg-white p-6 text-muted ring-1 ring-line">Stories from our first travellers will appear here after the trip.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-cream">
        <div className="gutter">
          <div className="shell flex flex-col items-start gap-6 py-20 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-4xl font-bold">Share your story</h2>
              <p className="mt-3 text-lg text-muted">Tag @{s.instagramHandle} in your trip photos, or write a review and we may feature it here.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonA href={instaUrl(s.instagramHandle)} variant="forest"><Camera size={18} /> Follow on Instagram</ButtonA>
              <ButtonLink to="/reviews#write" variant="outline">Write a review</ButtonLink>
              <ButtonA href={waLink(s.whatsappNumber, 'Hi JoinZipTrip! I want to join the next trip.')} variant="ghost"><MessageCircle size={18} /> WhatsApp</ButtonA>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
