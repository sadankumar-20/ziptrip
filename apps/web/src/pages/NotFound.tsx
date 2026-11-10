import { Seo } from '../lib/seo';
import { img } from '../lib/images';
import { ButtonLink } from '../components/ui';

export default function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-forest-deep text-cream">
      <Seo title="Not found" noindex />
      <img src={img('asset:shola-forest')} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
      <div className="gutter">
        <div className="shell flex min-h-[60svh] flex-col items-start justify-center gap-5 py-20">
          <p className="font-display text-7xl font-extrabold text-orange">404</p>
          <h1 className="max-w-2xl font-display text-[clamp(2.4rem,6vw,4.4rem)] font-extrabold leading-[0.95]">This {what} wandered off the trail.</h1>
          <p className="max-w-lg text-lg text-cream/85">The link may be old, or the {what} may have been removed. Upcoming trips are a good place to pick the path back up.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/trips">See upcoming trips</ButtonLink>
            <ButtonLink to="/" variant="outline-light">Go to the homepage</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
