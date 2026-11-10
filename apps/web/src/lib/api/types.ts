import type {
  TripView, Leader, Review, Album, Booking, SiteSettings, AdminUser, AdminOverview, ContactMessage, PassportStamp,
  BookingInput, ReviewInput, ContactInput, TripInput, LeaderInput, AlbumInput, BookingUpdate, ReviewModeration,
  Trip, AdminRole,
} from '@jzt/shared';

export interface PublicSettings extends SiteSettings {
  paymentsEnabled: boolean;
  razorpayKeyId: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

export interface BookingResult { booking: Booking; whatsappUrl: string; message: string }

export interface AdminApi {
  me(): Promise<AdminUser | null>;
  login(email: string, password: string): Promise<AdminUser>;
  logout(): Promise<void>;
  overview(): Promise<AdminOverview>;
  trips(): Promise<TripView[]>;
  trip(id: string): Promise<TripView>;
  createTrip(input: TripInput): Promise<TripView>;
  updateTrip(id: string, input: TripInput): Promise<TripView>;
  patchTrip(id: string, patch: Partial<Pick<Trip, 'statusMode' | 'isPublished' | 'isFeatured' | 'seatsTotal' | 'priceInr'>>): Promise<TripView>;
  deleteTrip(id: string): Promise<void>;
  bookings(filter: { tripId?: string; status?: string; q?: string }): Promise<Booking[]>;
  updateBooking(id: string, u: BookingUpdate): Promise<Booking>;
  exportCsv(filter: { tripId?: string }): Promise<string>;
  leaders(): Promise<Leader[]>;
  createLeader(input: LeaderInput): Promise<Leader>;
  updateLeader(id: string, input: LeaderInput): Promise<Leader>;
  deleteLeader(id: string): Promise<void>;
  albums(): Promise<Album[]>;
  createAlbum(input: AlbumInput): Promise<Album>;
  updateAlbum(id: string, input: AlbumInput): Promise<Album>;
  deleteAlbum(id: string): Promise<void>;
  reviews(status?: string): Promise<Review[]>;
  addReview(input: ReviewInput & { source: 'google' | 'instagram' | 'admin' }): Promise<Review>;
  moderateReview(id: string, m: ReviewModeration): Promise<Review>;
  deleteReview(id: string): Promise<void>;
  messages(): Promise<ContactMessage[]>;
  setMessageHandled(id: string, handled: boolean): Promise<ContactMessage>;
  settings(): Promise<SiteSettings>;
  saveSettings(s: SiteSettings): Promise<SiteSettings>;
  users(): Promise<AdminUser[]>;
  createUser(u: { email: string; name: string; role: AdminRole; password: string }): Promise<AdminUser>;
  updateUser(id: string, u: Partial<{ name: string; role: AdminRole; isActive: boolean; password: string }>): Promise<AdminUser>;
  upload(file: File, folder: string): Promise<{ url: string; kind: 'image' | 'video' }>;
  /** Demo only: preview the dashboard as another role. */
  switchRole?(role: AdminRole): Promise<AdminUser>;
  /** Demo only: wipe local changes. */
  resetDemo?(): Promise<void>;
}

export interface DataSource {
  mode: 'demo' | 'api';
  settings(): Promise<PublicSettings>;
  trips(): Promise<TripView[]>;
  trip(slug: string): Promise<TripView>;
  leaders(): Promise<Leader[]>;
  leader(slug: string): Promise<Leader>;
  reviews(): Promise<Review[]>;
  submitReview(input: ReviewInput): Promise<void>;
  albums(): Promise<Album[]>;
  album(slug: string): Promise<Album>;
  createBooking(input: BookingInput): Promise<BookingResult>;
  sendContact(input: ContactInput): Promise<{ whatsappUrl: string }>;
  passport(phone: string, ref: string): Promise<PassportStamp[]>;
  admin: AdminApi;
}
