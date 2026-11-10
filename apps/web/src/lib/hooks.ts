import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { DEFAULT_SETTINGS } from '@jzt/shared';
import { api, type PublicSettings } from './api';

export const qk = {
  settings: ['settings'] as const,
  trips: ['trips'] as const,
  trip: (slug: string) => ['trip', slug] as const,
  leaders: ['leaders'] as const,
  leader: (slug: string) => ['leader', slug] as const,
  reviews: ['reviews'] as const,
  albums: ['albums'] as const,
  album: (slug: string) => ['album', slug] as const,
  admin: ['admin'] as const,
};

const FALLBACK_SETTINGS: PublicSettings = { ...DEFAULT_SETTINGS, paymentsEnabled: false, razorpayKeyId: null };

export function useSettings() {
  const q = useQuery({ queryKey: qk.settings, queryFn: api.settings, staleTime: 5 * 60_000 });
  return q.data ?? FALLBACK_SETTINGS;
}
export const useTrips = () => useQuery({ queryKey: qk.trips, queryFn: api.trips });
export const useTrip = (slug: string) => useQuery({ queryKey: qk.trip(slug), queryFn: () => api.trip(slug), retry: (n, e: any) => e?.status !== 404 && n < 2 });
export const useLeaders = () => useQuery({ queryKey: qk.leaders, queryFn: api.leaders });
export const useLeader = (slug: string) => useQuery({ queryKey: qk.leader(slug), queryFn: () => api.leader(slug), retry: (n, e: any) => e?.status !== 404 && n < 2 });
export const useReviews = () => useQuery({ queryKey: qk.reviews, queryFn: api.reviews });
export const useAlbums = () => useQuery({ queryKey: qk.albums, queryFn: api.albums });
export const useAlbum = (slug: string) => useQuery({ queryKey: qk.album(slug), queryFn: () => api.album(slug), retry: (n, e: any) => e?.status !== 404 && n < 2 });

/** Admin data lives under one key prefix so a save can refresh every admin and public view at once. */
export function useAdminQuery<T>(key: QueryKey, fn: () => Promise<T>, enabled = true) {
  return useQuery({ queryKey: [...qk.admin, ...key], queryFn: fn, enabled });
}
export function useAdminMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(),
  });
}
