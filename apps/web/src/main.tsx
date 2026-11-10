import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { ROUTER_MODE } from './lib/config';
import App from './App';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } });

// The preview build runs inside a host page where the address bar isn't ours, so it routes in memory.
// A plain #name in the link can still open a specific view.
const START: Record<string, string> = {
  trips: '/trips', trek: '/trips/thadiyandamol-trek', book: '/trips/thadiyandamol-trek/book', tribe: '/tribe',
  leaders: '/leaders', reviews: '/reviews', contact: '/contact', about: '/about', passport: '/passport', admin: '/admin',
  adventures: '/past-adventures',
};
const start = START[location.hash.slice(1)] ?? '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        {ROUTER_MODE === 'memory' ? (
          <MemoryRouter initialEntries={[start]}><App /></MemoryRouter>
        ) : (
          <BrowserRouter><App /></BrowserRouter>
        )}
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
);
