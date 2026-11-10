import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { LayoutDashboard, Mountain, Ticket, Users, Images, Star, Settings, LogOut, ExternalLink, Upload, Trash2, Plus, ArrowUp, ArrowDown, Menu, X, RotateCcw, Loader2 } from 'lucide-react';
import { can, ROLE_LABEL, ADMIN_ROLES, type AdminUser, type Permission, type AdminRole } from '@jzt/shared';
import { api, ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { img, LOGO } from '../../lib/images';
import { IS_DEMO } from '../../lib/config';
import { Seo } from '../../lib/seo';
import { Button, Field, Input, Select, Skeleton } from '../../components/ui';

// ---------------------------------------------------------------- session
const AdminCtx = createContext<AdminUser | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;
export const useCan = (p: Permission) => can(useAdmin()?.role, p);

const NAV: { to: string; label: string; icon: typeof Mountain; perm?: Permission }[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/trips', label: 'Trips', icon: Mountain },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket, perm: 'bookings:read' },
  { to: '/admin/leaders', label: 'Trip leaders', icon: Users },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminRoot() {
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me, retry: false });
  if (me.isLoading) return <div className="grid min-h-screen place-items-center bg-paper"><Loader2 className="animate-spin text-forest" /></div>;
  if (!me.data) return <Login />;
  return (
    <AdminCtx.Provider value={me.data}>
      <Seo title="Admin" noindex />
      <AdminLayout />
    </AdminCtx.Provider>
  );
}

function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => api.admin.login(email, password), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
  return (
    <div className="grid min-h-screen bg-forest-deep md:grid-cols-2">
      <Seo title="Team sign in" noindex />
      <div className="relative hidden md:block">
        <img src={img('asset:summit-clouds')} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="gutter flex items-center bg-paper">
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="mx-auto grid w-full max-w-sm gap-5 py-16">
          <Link to="/" className="flex items-center gap-2.5"><img src={LOGO} alt="" className="size-11 rounded-full" /><span className="font-display text-2xl font-bold text-forest">JoinZipTrip</span></Link>
          <div>
            <h1 className="font-display text-3xl font-bold">Team sign in</h1>
            <p className="mt-1 text-muted">Manage trips, bookings, leaders, photos and reviews.</p>
          </div>
          {IS_DEMO ? (
            <>
              <p className="rounded-xl bg-cream p-4 text-sm text-muted">This preview runs on sample data in your browser, so no password is needed. On the live site, team members sign in with their own email and password, and access depends on their role.</p>
              <Button size="lg" onClick={() => m.mutate()} type="button" disabled={m.isPending}>{m.isPending ? 'Opening…' : 'Open the demo dashboard'}</Button>
            </>
          ) : (
            <>
              <Field label="Email" htmlFor="l-email"><Input id="l-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
              <Field label="Password" htmlFor="l-password"><Input id="l-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></Field>
              {m.isError && <p className="font-medium text-[#9F2D1F]" role="alert">{(m.error as Error).message}</p>}
              <Button size="lg" type="submit" disabled={m.isPending}>{m.isPending ? 'Signing in…' : 'Sign in'}</Button>
            </>
          )}
          <Link to="/" className="text-sm font-semibold text-forest">Back to the website</Link>
        </form>
      </div>
    </div>
  );
}

function AdminLayout() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const logout = useMutation({ mutationFn: api.admin.logout, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
  const nav = NAV.filter((n) => !n.perm || can(me.role, n.perm));
  const side = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-1 p-4">
      <Link to="/admin" className="mb-6 flex items-center gap-2.5 px-2"><img src={LOGO} alt="" className="size-10 rounded-full bg-cream" /><span className="font-display text-xl font-bold">JoinZipTrip</span></Link>
      {nav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/admin'} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium', isActive ? 'bg-cream text-forest' : 'text-cream/80 hover:bg-cream/10 hover:text-cream')}>
          <n.icon size={18} aria-hidden /> {n.label}
        </NavLink>
      ))}
      <div className="mt-auto grid gap-1 border-t border-cream/15 pt-4">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-cream/80 hover:bg-cream/10"><ExternalLink size={18} aria-hidden /> View website</Link>
        <button onClick={() => logout.mutate()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-cream/80 hover:bg-cream/10"><LogOut size={18} aria-hidden /> Sign out</button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen bg-forest-deep text-cream lg:block">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-forest-deep text-cream" style={{ paddingTop: 'env(safe-area-inset-top)' }}>{side}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="gutter flex h-16 items-center justify-between gap-3">
            <button className="grid size-10 place-items-center rounded-xl hover:bg-ink/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu"><Menu /></button>
            <div className="ml-auto flex items-center gap-3">
              {IS_DEMO && api.admin.switchRole && <DemoControls />}
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight">{me.name}</p>
                <p className="text-xs text-muted">{ROLE_LABEL[me.role]}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="gutter py-8"><div className="mx-auto max-w-6xl"><Outlet /></div></main>
      </div>
    </div>
  );
}

function DemoControls() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="hidden items-center gap-2 rounded-full bg-cream py-1 pl-3 pr-1 text-sm md:flex">
      <label htmlFor="demo-role" className="font-semibold text-muted">View as</label>
      <select id="demo-role" value={me.role} onChange={async (e) => { await api.admin.switchRole!(e.target.value as AdminRole); qc.invalidateQueries(); }} className="rounded-full bg-white px-2 py-1 font-semibold ring-1 ring-line">
        {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      {confirm ? (
        <>
          <button className="rounded-full bg-[#9F2D1F] px-3 py-1 font-semibold text-white" onClick={async () => { await api.admin.resetDemo!(); setConfirm(false); qc.invalidateQueries(); }}>Reset all</button>
          <button className="rounded-full px-2 py-1" onClick={() => setConfirm(false)} aria-label="Cancel reset"><X size={14} /></button>
        </>
      ) : (
        <button className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold text-forest hover:bg-white" onClick={() => setConfirm(true)}><RotateCcw size={14} /> Reset demo</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- page bits
export function AdminHeader({ title, intro, action }: { title: string; intro?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-white ring-1 ring-line', className)}>{children}</div>;
}
export function LoadingRows() {
  return <div className="grid gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
}
export function ReadOnlyNote({ what }: { what: string }) {
  return <p className="mb-6 rounded-xl bg-cream p-4 text-sm text-muted">Your role can view {what} but not change it.</p>;
}

export function Toggle({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id: string }) {
  return (
    <label htmlFor={id} className={cn('inline-flex items-center gap-2.5', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-forest' : 'bg-ink/20')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5')} />
      </button>
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

/** Two-step delete so nothing is removed by a stray click. */
export function ConfirmDelete({ onConfirm, label = 'Delete', disabled, pending }: { onConfirm: () => void; label?: string; disabled?: boolean; pending?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button size="sm" variant="danger" onClick={() => { onConfirm(); setArmed(false); }} disabled={pending}>Confirm {label.toLowerCase()}</Button>
        <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Cancel</Button>
      </span>
    );
  }
  return <Button size="sm" variant="ghost" onClick={() => setArmed(true)} disabled={disabled} className="text-[#9F2D1F]"><Trash2 size={15} /> {label}</Button>;
}

/** One item per line. */
export function LinesField({ label, value, onChange, id, hint, error }: { label: string; value: string[]; onChange: (v: string[]) => void; id: string; hint?: string; error?: string }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <Field label={label} htmlFor={id} hint={hint ?? 'One item per line. Wrap text in [square brackets] to mark it as a placeholder.'} error={error}>
      <textarea id={id} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)); }} className="min-h-32 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15" />
    </Field>
  );
}

/** Editable list of rows with add, remove and reorder. */
export function RowsEditor<T>({ rows, onChange, blank, render, addLabel }: { rows: T[]; onChange: (r: T[]) => void; blank: T; render: (row: T, set: (r: T) => void, i: number) => ReactNode; addLabel: string }) {
  const move = (i: number, d: number) => { const r = [...rows]; [r[i], r[i + d]] = [r[i + d], r[i]]; onChange(r); };
  return (
    <div className="grid gap-3">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 rounded-xl bg-paper p-3 ring-1 ring-line">
          <div className="min-w-0 flex-1">{render(row, (r) => onChange(rows.map((x, j) => (j === i ? r : x))), i)}</div>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg hover:bg-ink/5 disabled:opacity-30" aria-label="Move up"><ArrowUp size={15} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="grid size-8 place-items-center rounded-lg hover:bg-ink/5 disabled:opacity-30" aria-label="Move down"><ArrowDown size={15} /></button>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-[#9F2D1F] hover:bg-[#9F2D1F]/10" aria-label="Remove"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...rows, structuredClone(blank)])}><Plus size={15} /> {addLabel}</Button>
    </div>
  );
}

/** Upload button that returns a hosted URL (Supabase Storage or Cloudinary on the live site). */
export function UploadButton({ folder, onUploaded, label = 'Upload photo', multiple, accept = 'image/jpeg,image/png,image/webp,image/avif' }: { folder: string; onUploaded: (r: { url: string; kind: 'image' | 'video'; name: string }) => void; label?: string; multiple?: boolean; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="inline-flex flex-col gap-1">
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="sr-only" tabIndex={-1} aria-hidden onChange={async (e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        setBusy(true);
        setError(null);
        try {
          for (const f of files) {
            const r = await api.admin.upload(f, folder);
            onUploaded({ ...r, name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
          }
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Upload failed. Try a smaller file.');
        } finally {
          setBusy(false);
        }
      }} />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {busy ? 'Uploading…' : label}</Button>
      {error && <span className="text-sm text-[#9F2D1F]" role="alert">{error}</span>}
    </div>
  );
}

export function ImageThumb({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  return url ? <img src={img(url)} alt={alt} className={cn('rounded-lg object-cover', className)} loading="lazy" /> : <span className={cn('grid place-items-center rounded-lg bg-sage text-forest', className)}><Mountain size={18} /></span>;
}

export function useSaveState() {
  const [saved, setSaved] = useState(false);
  return { saved, flash: () => { setSaved(true); setTimeout(() => setSaved(false), 2200); } };
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as ApiError;
  const fields = e.fields ? Object.entries(e.fields) : [];
  return (
    <div role="alert" className="rounded-xl border border-[#9F2D1F]/30 bg-[#9F2D1F]/5 p-4 text-[#7A2318]">
      <p className="font-semibold">{e.message}</p>
      {fields.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{fields.map(([k, v]) => <li key={k}><span className="font-semibold">{k}</span>: {v}</li>)}</ul>}
    </div>
  );
}

export { Select };
