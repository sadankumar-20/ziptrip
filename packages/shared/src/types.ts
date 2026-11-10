// Domain types shared by the web app and the API.
// Money is stored as whole rupees (integers). Dates are ISO strings (YYYY-MM-DD) in IST.

export const TRIP_CATEGORIES = ['trekking', 'weekend_getaway', 'adventure', 'group_trip'] as const;
export type TripCategory = (typeof TRIP_CATEGORIES)[number];

export const DIFFICULTIES = ['easy', 'easy_moderate', 'moderate', 'challenging'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** What the admin chose. `auto` derives the public status from seats and dates. */
export const STATUS_MODES = ['auto', 'open', 'filling_fast', 'sold_out'] as const;
export type StatusMode = (typeof STATUS_MODES)[number];

/** What visitors see. */
export type TripStatus = 'open' | 'filling_fast' | 'sold_out' | 'departed' | 'dates_tba';

export const INCLUSION_KEYS = [
  'transport', 'breakfast', 'lunch', 'dinner', 'snacks', 'permit', 'trek_fee', 'guide',
  'first_aid', 'stay', 'camping_gear', 'bonfire', 'photos', 'other',
] as const;
export type InclusionKey = (typeof INCLUSION_KEYS)[number];

export interface Inclusion { key: InclusionKey; label: string }

export interface MediaItem {
  id?: string;
  url: string;
  alt: string;
  kind: 'image' | 'video';
  caption?: string;
  /** For video: a still image shown before playing. */
  poster?: string;
  /** For Instagram reels or YouTube: link out instead of embedding. */
  externalUrl?: string;
}

export interface ItineraryStep { time: string; title: string; detail?: string }
export interface Faq { q: string; a: string }
/** One point on the trek's elevation profile: distance along the trail and altitude. */
export interface ElevationPoint { km: number; m: number; label?: string }

export interface Trip {
  id: string;
  slug: string;
  title: string;
  destination: string;
  region: string;
  category: TripCategory;
  summary: string;
  description: string;
  highlights: string[];
  difficulty: Difficulty;
  distanceLabel: string;
  trekDurationLabel: string;
  altitudeM: number | null;
  ageGroup: string | null;
  fitness: string;
  pickupPoint: string;
  pickupCity: string;
  pickupTime: string;
  returnSchedule: string;
  departureDate: string | null;
  departureTime: string | null;
  durationDays: number;
  durationLabel: string;
  priceInr: number | null;
  seatsTotal: number | null;
  statusMode: StatusMode;
  isFeatured: boolean;
  isPublished: boolean;
  isDemo: boolean;
  coverImage: MediaItem;
  gallery: MediaItem[];
  itinerary: ItineraryStep[];
  inclusions: Inclusion[];
  exclusions: string[];
  thingsToCarry: string[];
  safety: string[];
  cancellationPolicy: string[];
  bookingTerms: string[];
  faqs: Faq[];
  elevation: ElevationPoint[];
  leaderIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Trip plus figures the server derives from bookings. */
export interface TripView extends Trip {
  seatsBooked: number;
  seatsLeft: number | null;
  status: TripStatus;
}

export const LEADER_ROLES = ['founder', 'trek_leader', 'coordinator'] as const;
export type LeaderRole = (typeof LEADER_ROLES)[number];

export interface Leader {
  id: string;
  slug: string;
  name: string;
  role: LeaderRole;
  photoUrl: string | null;
  intro: string;
  story: string;
  philosophy: string;
  /** Left null until the admin enters a verified figure. Never estimated. */
  yearsExperience: number | null;
  tripsLed: number | null;
  destinations: string[];
  specializations: string[];
  languages: string[];
  instagram: string | null;
  isPublished: boolean;
  isDemo: boolean;
  sortOrder: number;
}

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type BookingChannel = 'whatsapp' | 'razorpay';

export interface Booking {
  id: string;
  ref: string;
  tripId: string;
  tripTitle: string;
  tripSlug: string;
  departureDate: string | null;
  fullName: string;
  phone: string;
  email: string;
  travellers: number;
  emergencyName: string;
  emergencyPhone: string;
  notes: string;
  unitPriceInr: number;
  totalInr: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  channel: BookingChannel;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewSource = 'website' | 'google' | 'instagram' | 'admin';

export interface Review {
  id: string;
  tripId: string | null;
  tripName: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  body: string;
  experienceDate: string | null;
  status: ReviewStatus;
  isFeatured: boolean;
  /** True only when the booking reference matched a completed booking. */
  isVerified: boolean;
  isDemo: boolean;
  source: ReviewSource;
  createdAt: string;
}

export interface Album {
  id: string;
  slug: string;
  title: string;
  location: string;
  tripDate: string | null;
  tripId: string | null;
  leaderId: string | null;
  /** Only filled when the head-count is verified from bookings or the trip roster. */
  participants: number | null;
  story: string;
  coverUrl: string | null;
  media: MediaItem[];
  isPublished: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
  handled: boolean;
  createdAt: string;
}

export interface SiteSettings {
  brandName: string;
  phones: string[];
  /** Digits only, with country code, e.g. 918073271501. */
  whatsappNumber: string;
  instagramHandle: string;
  email: string;
  googleReviewsUrl: string | null;
  baseCity: string;
}

export const ADMIN_ROLES = ['owner', 'manager', 'editor'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface PassportStamp {
  tripTitle: string;
  destination: string;
  region: string;
  date: string | null;
  altitudeM: number | null;
  state: 'completed' | 'upcoming';
  bookingRef: string;
}

export interface AdminOverview {
  upcoming: TripView[];
  pendingBookings: number;
  confirmedTravellers: number;
  pendingReviews: number;
  openMessages: number;
  recentBookings: Booking[];
}
