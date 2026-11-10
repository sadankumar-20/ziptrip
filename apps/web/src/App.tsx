import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SiteLayout, ScrollToTop } from './components/layout';
import Home from './pages/Home';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import Book from './pages/Book';
import { PastAdventures, AlbumDetail } from './pages/Adventures';
import Tribe from './pages/Tribe';
import { Leaders, LeaderDetail } from './pages/Leaders';
import { Reviews, About, Contact, Passport } from './pages/Info';
import NotFound from './pages/NotFound';
import { ADMIN_ENABLED } from './lib/config';

// The dashboard is only loaded for the team, so visitors from Instagram download less.
const AdminRoot = lazy(() => import('./pages/admin/shell').then((m) => ({ default: m.AdminRoot })));
const Overview = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.Overview })));
const TripsAdmin = lazy(() => import('./pages/admin/trips').then((m) => ({ default: m.TripsAdmin })));
const TripEditor = lazy(() => import('./pages/admin/trips').then((m) => ({ default: m.TripEditor })));
const BookingsAdmin = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.BookingsAdmin })));
const LeadersAdmin = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.LeadersAdmin })));
const LeaderEditor = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.LeaderEditor })));
const GalleryAdmin = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.GalleryAdmin })));
const AlbumEditor = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.AlbumEditor })));
const ReviewsAdmin = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.ReviewsAdmin })));
const SettingsAdmin = lazy(() => import('./pages/admin/manage').then((m) => ({ default: m.SettingsAdmin })));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6">
        <div className="max-w-md">
          <p className="font-display text-3xl font-bold">Something went wrong on this page.</p>
          <p className="mt-2 text-muted">Reload to try again. If it keeps happening, message us on WhatsApp at +91 80732 71501.</p>
          <button className="mt-5 rounded-full bg-orange px-5 py-2.5 font-semibold" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}

const Spinner = () => <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-forest" aria-label="Loading" /></div>;

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="trips" element={<Trips />} />
            <Route path="trips/:slug" element={<TripDetail />} />
            <Route path="trips/:slug/book" element={<Book />} />
            <Route path="past-adventures" element={<PastAdventures />} />
            <Route path="past-adventures/:slug" element={<AlbumDetail />} />
            <Route path="tribe" element={<Tribe />} />
            <Route path="leaders" element={<Leaders />} />
            <Route path="leaders/:slug" element={<LeaderDetail />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="passport" element={<Passport />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          {ADMIN_ENABLED && <Route path="admin" element={<AdminRoot />}>
            <Route index element={<Overview />} />
            <Route path="trips" element={<TripsAdmin />} />
            <Route path="trips/:id" element={<TripEditor />} />
            <Route path="bookings" element={<BookingsAdmin />} />
            <Route path="leaders" element={<LeadersAdmin />} />
            <Route path="leaders/:id" element={<LeaderEditor />} />
            <Route path="gallery" element={<GalleryAdmin />} />
            <Route path="gallery/:id" element={<AlbumEditor />} />
            <Route path="reviews" element={<ReviewsAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </Route>}
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
