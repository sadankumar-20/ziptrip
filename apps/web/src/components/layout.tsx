import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, MessageCircle, Camera, Phone, Mail, ArrowUpRight } from 'lucide-react';
import { waLink } from '@jzt/shared';
import { cn } from '../lib/cn';
import { LOGO } from '../lib/images';
import { useSettings } from '../lib/hooks';
import { IS_DEMO, ADMIN_ENABLED } from '../lib/config';
import { ButtonLink, ButtonA, buttonClass, Wave } from './ui';

export const NAV = [
  { to: '/', label: 'Home' },
  { to: '/trips', label: 'Explore Trips' },
  { to: '/past-adventures', label: 'Past Adventures' },
  { to: '/tribe', label: 'Our Tribe' },
  { to: '/leaders', label: 'Trip Leaders' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
];

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)} aria-label="JoinZipTrip home">
      <img src={LOGO} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full bg-cream ring-2 ring-cream/70 transition-transform duration-300 group-hover:-rotate-6" />
      <span className={cn('font-display text-[1.45rem] font-bold leading-none tracking-[-0.01em]', light ? 'text-cream' : 'text-forest')}>JoinZipTrip</span>
    </Link>
  );
}

export const instaUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

function Header() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  const transparent = false;

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-300',
          transparent ? 'bg-gradient-to-b from-ink/50 to-transparent text-cream' : scrolled ? 'bg-cream/95 text-ink shadow-[0_1px_0_var(--color-line)] backdrop-blur-sm' : 'bg-sky text-ink',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="gutter">
          <div className="shell flex h-[4.5rem] items-center justify-between gap-4">
            <Logo light={transparent} />
            <nav aria-label="Main" className="hidden xl:block">
              <ul className="flex items-center gap-1">
                {NAV.slice(1).map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      className={({ isActive }) => cn('rounded-full px-3 py-2 text-[0.95rem] font-medium transition-colors', isActive ? (transparent ? 'bg-cream/15' : 'bg-forest/10 text-forest') : transparent ? 'hover:bg-cream/10' : 'hover:bg-ink/5')}
                    >
                      {n.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block"><ButtonLink to="/trips" size="md">Book your adventure</ButtonLink></div>
              <button
                onClick={() => setOpen((v) => !v)}
                className={cn('grid size-11 place-items-center rounded-full xl:hidden', transparent ? 'hover:bg-cream/10' : 'hover:bg-ink/5')}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? 'Close menu' : 'Open menu'}
              >
                {open ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </header>
      <AnimatePresence>{open && <MobileMenu onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k); };
  }, [onClose]);
  return (
    <motion.div
      id="mobile-menu"
      className="fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-40 overflow-y-auto bg-cream xl:hidden"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <nav aria-label="Mobile" className="gutter pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-4">
        <ul className="shell divide-y divide-line">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => cn('flex items-center justify-between py-4 font-display text-[1.7rem] font-bold', isActive ? 'text-forest' : 'text-ink')}>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="shell mt-6 grid gap-3 sm:grid-cols-2">
          <ButtonLink to="/trips" size="lg">Book your adventure</ButtonLink>
          <ButtonA href={waLink(s.whatsappNumber, 'Hi JoinZipTrip!')} variant="forest" size="lg"><MessageCircle size={18} /> Chat on WhatsApp</ButtonA>
        </div>
      </nav>
    </motion.div>
  );
}

function Footer() {
  const s = useSettings();
  return (
    <footer className="bg-forest-deep text-cream">
      <div className="gutter">
        <div className="shell grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-5 font-display text-2xl font-bold leading-tight">Don’t just travel. Find your tribe.</p>
            <p className="mt-3 text-cream/70">Treks, weekend getaways and group trips from {s.baseCity}. Book on your own and travel with people who love the outdoors as much as you do.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cream/60">Explore</h3>
            <ul className="mt-4 space-y-2.5">
              {NAV.slice(1, 5).map((n) => <li key={n.to}><Link className="hover:text-orange" to={n.to}>{n.label}</Link></li>)}
              {ADMIN_ENABLED && <li><Link className="hover:text-orange" to="/passport">Adventure Passport</Link></li>}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cream/60">JoinZipTrip</h3>
            <ul className="mt-4 space-y-2.5">
              {NAV.slice(5).map((n) => <li key={n.to}><Link className="hover:text-orange" to={n.to}>{n.label}</Link></li>)}
              <li><Link className="hover:text-orange" to="/reviews#write">Write a review</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cream/60">Talk to us</h3>
            <ul className="mt-4 space-y-3">
              {s.phones.map((p) => (
                <li key={p}><a className="inline-flex items-center gap-2 tabular hover:text-orange" href={`tel:+91${p}`}><Phone size={16} aria-hidden /> +91 {p.slice(0, 5)} {p.slice(5)}</a></li>
              ))}
              <li><a className="inline-flex items-center gap-2 hover:text-orange" href={waLink(s.whatsappNumber, 'Hi JoinZipTrip!')} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden /> WhatsApp</a></li>
              <li><a className="inline-flex items-center gap-2 hover:text-orange" href={instaUrl(s.instagramHandle)} target="_blank" rel="noopener noreferrer"><Camera size={16} aria-hidden /> @{s.instagramHandle}</a></li>
              <li><a className="inline-flex items-center gap-2 break-all hover:text-orange" href={`mailto:${s.email}`}><Mail size={16} aria-hidden /> {s.email}</a></li>
            </ul>
          </div>
        </div>
        <div className="shell flex flex-col gap-3 border-t border-cream/15 py-6 text-sm text-cream/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} JoinZipTrip · ZipTrip Travels, {s.baseCity}</p>
          <div className="flex gap-5">
            <Link to="/contact#faq" className="hover:text-cream">FAQs</Link>
            {ADMIN_ENABLED && <Link to="/admin" className="hover:text-cream">Team login</Link>}
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Sticky contact: a bottom bar on phones, a floating WhatsApp button on larger screens. Trip pages show their own booking bar. */
function StickyContact() {
  const s = useSettings();
  const { pathname } = useLocation();
  // The desktop button waits until the visitor scrolls, so it never covers the hero's booking buttons.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const on = () => setShown(window.scrollY > 700);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (pathname.startsWith('/trips/')) return null;
  const wa = waLink(s.whatsappNumber, 'Hi JoinZipTrip! I have a question about your trips.');
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur-sm md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="gutter grid grid-cols-2 gap-2 py-2.5">
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass('forest', 'md')}><MessageCircle size={17} /> WhatsApp</a>
          <Link to="/trips" className={buttonClass('primary', 'md')}>Explore trips</Link>
        </div>
      </div>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('group fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full bg-forest py-3 pl-3 pr-4 font-semibold text-cream shadow-[0_10px_30px_-10px_rgba(10,42,29,.6)] transition-all duration-300 hover:-translate-y-0.5 md:inline-flex', shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}
        style={{ right: 'max(1.5rem, env(safe-area-inset-right, 0px))' }}
      >
        <span className="grid size-9 place-items-center rounded-full bg-orange text-ink"><MessageCircle size={18} /></span>
        Questions? WhatsApp us
      </a>
    </>
  );
}

function DemoRibbon() {
  if (!IS_DEMO) return null;
  return (
    <div className="bg-ink text-cream">
      <div className="gutter">
        <p className="shell flex flex-wrap items-center gap-x-2 py-2 text-[0.82rem]">
          <span className="font-semibold text-orange">Preview</span>
          Running on sample data in your browser. Items marked “Sample” and text in dashed boxes are placeholders to replace.
          <Link to="/admin" className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2">Open the admin dashboard <ArrowUpRight size={14} /></Link>
        </p>
      </div>
    </div>
  );
}

export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); return; }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-orange focus:px-4 focus:py-2 focus:font-semibold">Skip to content</a>
      <Header />
      <main id="main" className="flex-1 pb-20 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] md:pb-0">
        <DemoRibbon />
        <Outlet />
      </main>
      <Footer />
      <StickyContact />
    </div>
  );
}

export function PageHero({ title, intro, children, note }: { title: ReactNode; intro?: ReactNode; children?: ReactNode; image?: string; tone?: 'cream' | 'forest'; note?: string }) {
  return (
    <section className="relative overflow-hidden bg-sky text-ink">
      <div aria-hidden className="absolute -right-20 -top-28 size-80 rounded-full bg-sun/45 blur-2xl" />
      <div className="gutter relative">
        <div className="shell py-12 md:py-16">
          {note && <p className="mb-2 -rotate-2 font-hand text-[1.7rem] leading-tight text-ember">{note}</p>}
          <h1 className="max-w-4xl font-display text-[clamp(2.4rem,6.4vw,4.8rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-forest">{title}</h1>
          {intro && <p className="mt-4 max-w-2xl text-lg text-ink/75 md:text-xl">{intro}</p>}
          {children}
        </div>
      </div>
      <Wave from="bg-sky" to="text-cream" />
    </section>
  );
}
