import { z } from 'zod';
import {
  TRIP_CATEGORIES, DIFFICULTIES, STATUS_MODES, INCLUSION_KEYS, LEADER_ROLES,
  BOOKING_STATUSES, PAYMENT_STATUSES, REVIEW_STATUSES, ADMIN_ROLES,
} from './types';

/** Indian mobile: 10 digits starting 6-9, optional +91 / 91 / 0 prefix, spaces or dashes allowed. */
export const indianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(v), 'Enter a 10-digit Indian mobile number')
  .transform((v) => v.slice(-10));

const trimmed = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const bookingInputSchema = z
  .object({
    tripSlug: z.string().min(1),
    fullName: trimmed(80).min(2, 'Enter your full name'),
    phone: indianMobile,
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(120),
    travellers: z.coerce.number({ invalid_type_error: 'Choose the number of travellers' }).int().min(1, 'At least 1 traveller').max(20, 'For groups above 20, message us on WhatsApp'),
    emergencyName: trimmed(80).min(2, "Enter your emergency contact's name"),
    emergencyPhone: indianMobile,
    notes: trimmed(600).default(''),
    consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the booking terms' }) }),
    /** Honeypot. Real people never see or fill this field. */
    website: z.string().max(0).optional().default(''),
  })
  .refine((v) => v.phone !== v.emergencyPhone, {
    message: 'Emergency contact should be someone other than you',
    path: ['emergencyPhone'],
  });
export type BookingInput = z.input<typeof bookingInputSchema>;
export type BookingInputParsed = z.output<typeof bookingInputSchema>;

export const reviewInputSchema = z.object({
  name: trimmed(60).min(2, 'Enter your name'),
  tripName: trimmed(120).min(2, 'Which trip did you join?'),
  tripId: z.string().uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  body: trimmed(1200).min(20, 'Tell us a little more (at least 20 characters)'),
  experienceDate: isoDate.nullable().optional(),
  bookingRef: trimmed(20).optional().default(''),
  photoUrl: z.string().url().nullable().optional(),
  website: z.string().max(0).optional().default(''),
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

export const contactInputSchema = z.object({
  name: trimmed(80).min(2, 'Enter your name'),
  phone: indianMobile,
  email: z.union([z.string().trim().toLowerCase().email('Enter a valid email address'), z.literal('')]).default(''),
  topic: z.enum(['trip', 'group', 'custom', 'other']).default('trip'),
  message: trimmed(1500).min(10, 'Add a short message (at least 10 characters)'),
  website: z.string().max(0).optional().default(''),
});
export type ContactInput = z.input<typeof contactInputSchema>;

export const passportLookupSchema = z.object({
  phone: indianMobile,
  ref: z.string().trim().toUpperCase().regex(/^JZT-[A-Z0-9]{5}$/, 'Booking reference looks like JZT-7K3QX'),
});

const mediaSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  alt: trimmed(200).default(''),
  kind: z.enum(['image', 'video']).default('image'),
  caption: trimmed(200).optional(),
  poster: z.string().optional(),
  externalUrl: z.string().url().optional(),
});

export const tripInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens'),
  title: trimmed(120).min(3),
  destination: trimmed(120).min(2),
  region: trimmed(120).default(''),
  category: z.enum(TRIP_CATEGORIES),
  summary: trimmed(280).default(''),
  description: trimmed(5000).default(''),
  highlights: z.array(trimmed(200)).max(12).default([]),
  difficulty: z.enum(DIFFICULTIES),
  distanceLabel: trimmed(80).default(''),
  trekDurationLabel: trimmed(80).default(''),
  altitudeM: z.coerce.number().int().min(0).max(9000).nullable().default(null),
  ageGroup: trimmed(80).nullable().default(null),
  fitness: trimmed(400).default(''),
  pickupPoint: trimmed(200).default(''),
  pickupCity: trimmed(80).default(''),
  pickupTime: trimmed(40).default(''),
  returnSchedule: trimmed(200).default(''),
  departureDate: isoDate.nullable().default(null),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  durationDays: z.coerce.number().int().min(1).max(30),
  durationLabel: trimmed(40).default(''),
  priceInr: z.coerce.number().int().min(0).max(1_000_000).nullable().default(null),
  seatsTotal: z.coerce.number().int().min(1).max(500).nullable().default(null),
  statusMode: z.enum(STATUS_MODES).default('auto'),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  isDemo: z.boolean().default(false),
  coverImage: mediaSchema,
  gallery: z.array(mediaSchema).max(60).default([]),
  itinerary: z.array(z.object({ time: trimmed(40), title: trimmed(120).min(1), detail: trimmed(600).optional() })).max(40).default([]),
  inclusions: z.array(z.object({ key: z.enum(INCLUSION_KEYS), label: trimmed(80).min(1) })).max(30).default([]),
  exclusions: z.array(trimmed(200)).max(30).default([]),
  thingsToCarry: z.array(trimmed(200)).max(40).default([]),
  safety: z.array(trimmed(300)).max(30).default([]),
  cancellationPolicy: z.array(trimmed(400)).max(20).default([]),
  bookingTerms: z.array(trimmed(400)).max(20).default([]),
  faqs: z.array(z.object({ q: trimmed(200).min(3), a: trimmed(1200).min(1) })).max(30).default([]),
  elevation: z.array(z.object({ km: z.number().min(0), m: z.number().min(0), label: trimmed(60).optional() })).max(40).default([]),
  leaderIds: z.array(z.string()).max(10).default([]),
});
export type TripInput = z.input<typeof tripInputSchema>;

export const leaderInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens'),
  name: trimmed(80).min(2),
  role: z.enum(LEADER_ROLES),
  photoUrl: z.string().nullable().default(null),
  intro: trimmed(400).default(''),
  story: trimmed(4000).default(''),
  philosophy: trimmed(300).default(''),
  yearsExperience: z.coerce.number().int().min(0).max(60).nullable().default(null),
  tripsLed: z.coerce.number().int().min(0).max(5000).nullable().default(null),
  destinations: z.array(trimmed(80)).max(60).default([]),
  specializations: z.array(trimmed(80)).max(20).default([]),
  languages: z.array(trimmed(40)).max(12).default([]),
  instagram: trimmed(60).nullable().default(null),
  isPublished: z.boolean().default(true),
  isDemo: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});
export type LeaderInput = z.input<typeof leaderInputSchema>;

export const albumInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens'),
  title: trimmed(120).min(3),
  location: trimmed(120).default(''),
  tripDate: isoDate.nullable().default(null),
  tripId: z.string().nullable().default(null),
  leaderId: z.string().nullable().default(null),
  participants: z.coerce.number().int().min(1).max(1000).nullable().default(null),
  story: trimmed(5000).default(''),
  coverUrl: z.string().nullable().default(null),
  media: z.array(mediaSchema).max(200).default([]),
  isPublished: z.boolean().default(false),
  isDemo: z.boolean().default(false),
});
export type AlbumInput = z.input<typeof albumInputSchema>;

export const bookingUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  adminNotes: trimmed(2000).optional(),
});
export type BookingUpdate = z.infer<typeof bookingUpdateSchema>;

export const reviewModerationSchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  isFeatured: z.boolean().optional(),
});
export type ReviewModeration = z.infer<typeof reviewModerationSchema>;

export const settingsSchema = z.object({
  brandName: trimmed(60).min(2),
  phones: z.array(z.string().trim().regex(/^[6-9]\d{9}$/, 'Use 10-digit mobile numbers')).min(1).max(4),
  whatsappNumber: z.string().trim().regex(/^91[6-9]\d{9}$/, 'Use 91 followed by the 10-digit number'),
  instagramHandle: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/, 'Handle without @'),
  email: z.string().trim().email(),
  googleReviewsUrl: z.string().url().nullable().default(null),
  baseCity: trimmed(60).default('Mysuru'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export const adminUserInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: trimmed(80).min(2),
  role: z.enum(ADMIN_ROLES),
  password: z.string().min(12, 'Use at least 12 characters').max(200).optional(),
  isActive: z.boolean().default(true),
});
