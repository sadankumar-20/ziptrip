import { forwardRef, useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X, ChevronLeft, ChevronRight, Copy, Check, RefreshCw, Compass } from 'lucide-react';
import { STATUS_LABEL, isPlaceholder, type TripStatus, type MediaItem } from '@jzt/shared';
import { cn } from '../lib/cn';
import { img, ratioOf } from '../lib/images';

// ---------- Button ----------
type Variant = 'primary' | 'forest' | 'cream' | 'outline' | 'outline-light' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-orange text-ink hover:bg-orange-deep shadow-[0_1px_0_rgba(23,34,28,.25)]',
  forest: 'bg-forest text-cream hover:bg-forest-deep',
  cream: 'bg-cream text-forest hover:bg-white',
  outline: 'border border-ink/20 text-ink hover:border-ink hover:bg-ink/[.03]',
  'outline-light': 'border border-cream/40 text-cream hover:border-cream hover:bg-cream/10',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-[#9F2D1F] text-white hover:bg-[#82241A]',
};
const SIZE = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-5 text-[0.95rem] gap-2', lg: 'h-13 px-7 text-base gap-2.5' };

interface BtnBase { variant?: Variant; size?: keyof typeof SIZE; className?: string; children: ReactNode }
export function buttonClass(variant: Variant = 'primary', size: keyof typeof SIZE = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none select-none',
    VARIANT[variant], SIZE[size], extra,
  );
}
export const Button = forwardRef<HTMLButtonElement, BtnBase & ButtonHTMLAttributes<HTMLButtonElement>>(function Button({ variant, size, className, children, ...rest }, ref) {
  return <button ref={ref} className={buttonClass(variant, size, className)} {...rest}>{children}</button>;
});
export function ButtonLink({ to, variant, size, className, children, ...rest }: BtnBase & { to: string; onClick?: () => void; 'aria-label'?: string }) {
  return <Link to={to} className={buttonClass(variant, size, className)} {...rest}>{children}</Link>;
}
/** External links (WhatsApp, Instagram, Google) always open in a new tab. */
export function ButtonA({ href, variant, size, className, children, ...rest }: BtnBase & { href: string; 'aria-label'?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} {...rest}>{children}</a>;
}

// ---------- Status ----------
const STATUS_STYLE: Record<TripStatus, string> = {
  open: 'bg-forest text-cream',
  filling_fast: 'bg-orange text-ink',
  sold_out: 'bg-ink text-cream/80',
  departed: 'bg-sand text-ink',
  dates_tba: 'bg-cream text-forest ring-1 ring-forest/25',
};
export function StatusPill({ status, className }: { status: TripStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none', STATUS_STYLE[status], className)}>
      {status === 'filling_fast' && <span className="size-1.5 rounded-full bg-ink animate-pulse-dot" aria-hidden />}
      {status === 'open' && <span className="size-1.5 rounded-full bg-[#7FD49B]" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}
export function SampleTag({ className, children = 'Sample' }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-dashed border-current px-2 py-0.5 text-[0.7rem] font-semibold leading-none', className)} title="Sample content for the preview. Replace it in the admin dashboard.">
      {children}
    </span>
  );
}

// ---------- Text that may still be a [placeholder] ----------
export function Txt({ children, className, as: As = 'span' }: { children: string | null | undefined; className?: string; as?: 'span' | 'p' | 'li' | 'h3' }) {
  if (!children) return null;
  if (isPlaceholder(children)) {
    return (
      <As className={cn(className, 'rounded-md border border-dashed border-current/40 bg-current/[.03] px-1.5 italic opacity-70')} title="Placeholder: fill this in from the admin dashboard">
        {children.replace(/^\s*\[|\]\s*$/g, '')}
      </As>
    );
  }
  return <As className={className}>{children}</As>;
}

// ---------- Images ----------
export function Img({ src, alt, className, ratio, eager, sizes, imgClassName }: { src: string; alt: string; className?: string; ratio?: number | 'natural'; eager?: boolean; sizes?: string; imgClassName?: string }) {
  const [loaded, setLoaded] = useState(false);
  const r = ratio === 'natural' ? ratioOf(src) : ratio;
  return (
    <div className={cn('relative overflow-hidden bg-sage', className)} style={r ? { aspectRatio: String(r) } : undefined}>
      <img
        src={img(src)}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', imgClassName)}
      />
    </div>
  );
}

// ---------- Lightbox ----------
export function Lightbox({ items, index, onClose, onIndex }: { items: MediaItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [index, items.length, onClose, onIndex]);
  const item = index != null ? items[index] : null;
  return (
    <AnimatePresence>
      {item && (
        <motion.div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[80] flex flex-col bg-ink/95 text-cream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="gutter flex items-center justify-between py-3" style={{ paddingTop: 'max(.75rem, env(safe-area-inset-top))' }}>
            <span className="text-sm tabular text-cream/70">{index! + 1} / {items.length}</span>
            <button onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-cream/10" aria-label="Close photo viewer"><X /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            <motion.img key={item.url} src={img(item.url)} alt={item.alt} className="max-h-full max-w-full rounded-lg object-contain" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} />
            {items.length > 1 && (
              <>
                <button onClick={() => onIndex((index! - 1 + items.length) % items.length)} className="absolute left-2 grid size-12 place-items-center rounded-full bg-ink/60 hover:bg-ink" aria-label="Previous photo"><ChevronLeft /></button>
                <button onClick={() => onIndex((index! + 1) % items.length)} className="absolute right-2 grid size-12 place-items-center rounded-full bg-ink/60 hover:bg-ink" aria-label="Next photo"><ChevronRight /></button>
              </>
            )}
          </div>
          {(item.caption || item.alt) && <p className="gutter pb-6 text-center text-sm text-cream/75">{item.caption ? `${item.caption} · ` : ''}{item.alt}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Form fields ----------
export function Field({ label, hint, error, children, htmlFor, className, optional }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string; className?: string; optional?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {error ? <p id={`${htmlFor}-error`} className="text-sm font-medium text-[#9F2D1F]" role="alert">{error}</p> : hint ? <p id={`${htmlFor}-hint`} className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
const inputBase = 'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.98rem] text-ink placeholder:text-muted/60 transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 aria-[invalid=true]:border-[#9F2D1F] disabled:bg-paper disabled:text-muted';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${p.id}-error` : undefined} className={cn(inputBase, 'h-12', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...p }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(inputBase, 'min-h-28 resize-y', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...p }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={cn(inputBase, 'h-12 appearance-none bg-[length:16px] bg-[right_.9rem_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2317221C' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>;
});

// ---------- Stars ----------
export function Stars({ value, className, size = 16 }: { value: number; className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex gap-0.5 text-orange', className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} width={size} height={size} fill={i <= value ? 'currentColor' : 'none'} strokeWidth={1.6} aria-hidden />)}
    </span>
  );
}

// ---------- States ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-ink/[.07]', className)} aria-hidden />;
}
export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-2xl border border-line bg-white p-6', className)} role="alert">
      <p className="font-semibold">This section didn’t load.</p>
      <p className="text-muted">{message ?? 'Check your connection and try again.'}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw size={15} /> Try again</Button>}
    </div>
  );
}
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-2xl border border-dashed border-ink/20 p-6 md:p-8', className)}>
      <Compass className="text-forest" aria-hidden />
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <div className="max-w-prose text-muted">{children}</div>}
      {action}
    </div>
  );
}

// ---------- Copy ----------
export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); }).catch(() => window.getSelection()?.selectAllChildren(document.getElementById('copy-fallback') ?? document.body));
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? 'Copied' : label}
    </Button>
  );
}

// ---------- Section heading ----------
export function SectionHeading({ title, intro, action, className, light }: { title: ReactNode; intro?: ReactNode; action?: ReactNode; className?: string; light?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-2xl">
        <h2 className={cn('font-display text-[clamp(2rem,4.4vw,3.4rem)] font-extrabold tracking-[-0.03em]', light ? 'text-cream' : 'text-forest')}>{title}</h2>
        {intro && <p className={cn('mt-3 text-lg', light ? 'text-cream/80' : 'text-muted')}>{intro}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Postcard pieces ----------
/** A photo in a white polaroid frame with a handwritten caption. */
export function Polaroid({ src, alt, caption, className, rotate = 0, ratio = 4 / 5, eager }: { src: string; alt: string; caption?: string; className?: string; rotate?: number; ratio?: number; eager?: boolean }) {
  return (
    <figure className={cn('polaroid relative', className)} style={{ transform: `rotate(${rotate}deg)` }}>
      <Img src={src} alt={alt} ratio={ratio} eager={eager} className="rounded-[0.3rem]" />
      {caption && <figcaption className="absolute inset-x-3 bottom-2 truncate text-center font-hand text-[1.35rem] leading-tight text-ink/80">{caption}</figcaption>}
    </figure>
  );
}

/** A postage stamp with perforated edges. */
export function PostageStamp({ children, className, rotate = 0, tone = 'sun' }: { children: ReactNode; className?: string; rotate?: number; tone?: 'sun' | 'orange' | 'forest' | 'paper' }) {
  const bg = { sun: 'bg-sun text-ink', orange: 'bg-orange text-ink', forest: 'bg-forest text-cream', paper: 'bg-paper text-forest' }[tone];
  return (
    <div className={cn('stamp drop-shadow-[0_8px_14px_rgba(23,34,28,.18)]', bg, className)} style={{ transform: `rotate(${rotate}deg)` }}>
      <div className={cn('flex flex-col items-center justify-center rounded-sm border-2 border-dashed px-3 py-2 text-center', tone === 'forest' ? 'border-cream/40' : 'border-ink/25')}>{children}</div>
    </div>
  );
}

/** Soft wave between two sections. `from` is the section above, `to` the one below. */
export function Wave({ from, to, flip }: { from: string; to: string; flip?: boolean }) {
  return (
    <div aria-hidden className={cn(from, to, 'leading-[0]')}>
      <svg viewBox="0 0 1440 56" preserveAspectRatio="none" className={cn('block h-7 w-full md:h-12', flip && '-scale-y-100')}>
        <path d="M0 28 C 180 56, 360 0, 540 24 S 900 56, 1080 26 S 1320 4, 1440 22 V56 H0 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Handwritten note. */
export function HandNote({ children, className, rotate = -2 }: { children: ReactNode; className?: string; rotate?: number }) {
  return <p className={cn('font-hand text-[1.6rem] leading-tight text-ember', className)} style={{ transform: `rotate(${rotate}deg)` }}>{children}</p>;
}
