import { Seo } from '../lib/seo';
import { LOGO } from '../lib/images';
import { ButtonLink, HandNote } from '../components/ui';

export default function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <section className="relative overflow-hidden bg-sky">
      <Seo title="Not found" noindex />
      <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-sun/45 blur-2xl" />
      <div className="gutter relative">
        <div className="shell flex min-h-[60svh] flex-col items-start justify-center gap-5 py-16">
          <img src={LOGO} alt="" aria-hidden className="size-24 -rotate-12 rounded-full bg-cream p-1 shadow-lg ring-4 ring-white" />
          <HandNote>Oops, wrong turn</HandNote>
          <h1 className="max-w-2xl font-display text-[clamp(2.4rem,6vw,4.4rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-forest">This {what} wandered off the trail.</h1>
          <p className="max-w-lg text-lg text-ink/75">The link may be old, or the {what} may have been removed. Upcoming trips are a good place to pick the path back up.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/trips">See upcoming trips</ButtonLink>
            <ButtonLink to="/" variant="outline">Go to the homepage</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
