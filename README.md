# JoinZipTrip

Website, booking system and admin dashboard for **JoinZipTrip (ZipTrip Travels)**: treks, weekend getaways and group trips from Mysuru, where people book on their own and travel together.

> Don't just travel. Find your tribe.

The first official trip, **Thadiyandamol, Sunday 22 November 2026, ₹1,699 per person, pickup 4:00 AM near Mysuru Railway Station front gate**, is seeded exactly as it appears on the poster.

---

## What's in here

```
joinziptrip/
├── apps/web          React + TypeScript + Tailwind + Framer Motion (Vite). The public site and the admin dashboard.
├── apps/api          Node.js + Express + TypeScript. Bookings, auth, uploads, payments, content.
├── packages/shared   Types, validation (zod), pricing, seat logic, WhatsApp message builder, role permissions, seed content.
├── supabase/migrations  PostgreSQL schema (works on Supabase or any Postgres 14+).
└── render.yaml       One-click API deploy on Render.
```

The website and the API share one set of rules from `packages/shared`, so a booking is validated and priced the same way in the browser and on the server. The server always has the final say on price and seats.

### Pages

| Public | Admin (`/admin`) |
| --- | --- |
| Home: hero, next-departure ticket with countdown, upcoming trips (filters and sorting), solo-traveller section, why us, past adventures, leaders, reviews, final call to action | Overview: what needs attention, upcoming departures with seat meters, latest bookings |
| Explore Trips: "Find your next adventure" by interest, duration, budget and difficulty | Trips: create, edit, delete, photos and video, itinerary, inclusions, prices, dates, seats, status, publish, feature |
| Trip details `/trips/:slug`: hero, overview, elevation profile, gallery with lightbox, itinerary timeline, inclusions and exclusions, your crew, things to carry, safety, cancellation, terms, FAQs, sticky booking panel (desktop) and booking bar (mobile) | Bookings: filter, search, customer details, confirm or cancel, payment status, team notes, WhatsApp the traveller, CSV export |
| Booking `/trips/:slug/book`: details → review → send on WhatsApp | Trip leaders: profiles, photos, verified stats, assign to trips |
| Past Adventures and album pages | Gallery: albums per trip, photo and video uploads, Instagram reel links, cover photo |
| Our Tribe, with a Memory Wall | Reviews: approve, reject, feature, delete |
| Trip Leaders and leader profile pages | Reviews, with a submission form that needs admin approval | Settings: phones, WhatsApp number, Instagram, email, Google reviews link; team accounts and roles |
| About, Contact (WhatsApp enquiries only, click-to-call, Instagram, FAQ) | |
| Adventure Passport `/passport`: stamps for each trip, opened with mobile number + booking reference | |

---

## Three ways the website can run (`VITE_DATA_MODE`)

| Mode | Used for | Data | Admin portal |
| --- | --- | --- | --- |
| `demo` | Local preview (`npm run dev:web`) | Sample content, saved only in that browser | Opens without a password, because it only changes that browser's sample data |
| `static` | **Going live now on Vercel, no backend** (set in `apps/web/.env.production`) | Real trips only, from `packages/shared/src/seed.ts`. Bookings go straight to WhatsApp | **Doesn't exist.** `/admin` shows a 404 and there's no Team login link |
| `api` | The full platform once the API and database are deployed | Database | Email and password login, checked by the server on every request, with owner, manager and editor roles |

**Can travellers get into the admin?** On the live site, no. In `static` mode the admin pages aren't served at all. In `api` mode the pages load, but every admin action is checked by the server: without a valid owner, manager or editor session the API returns 401, and roles limit what each person can do. Travellers never get accounts, and there is no sign-up. The `demo` mode you run locally is the only place the admin opens without a password, and anything changed there affects only your own browser.

In `static` mode, change trips by editing `packages/shared/src/seed.ts` and pushing to GitHub; Vercel redeploys automatically. To edit from the admin dashboard instead, deploy the API and switch to `api` mode.

---

## Run it locally

Requirements: Node 20+.

```bash
npm install

# 1. Website only, on in-browser sample data (no database needed)
npm run dev:web            # http://localhost:5173  (VITE_DATA_MODE defaults to demo)

# 2. Full stack
cp apps/api/.env.example apps/api/.env      # fill DATABASE_URL and JWT_SECRET
npm run db:migrate --workspace apps/api     # creates tables, seeds Thadiyandamol + placeholder leader profiles
ADMIN_PASSWORD='choose-a-long-password' npm run admin:create --workspace apps/api -- --email you@example.com --name "Your Name" --role owner
echo "VITE_DATA_MODE=api" > apps/web/.env.local
npm run dev                # API on :8787, website on :5173 (Vite proxies /api)
```

Tests (19 API integration tests against a real in-memory PostgreSQL):

```bash
npm test
```

They cover server-side pricing, seat limits (including two admins confirming at once), sample trips refusing bookings, CSRF and role checks, editors being blocked from customer data, CSV formula-injection protection, upload file-type sniffing, review moderation, the Adventure Passport lookup and Razorpay signature verification.

---

## Deploy

**1. Database (Supabase).** Create a project. In the SQL editor, run `supabase/migrations/0001_init.sql` then `0002_supabase_storage.sql`, or run `npm run db:migrate` locally with the Supabase connection string. The second file creates the public `media` bucket for photos.

**2. API (Render, Railway or Fly).** On Render, use *New → Blueprint* with `render.yaml`. Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `WEB_ORIGIN=https://your-domain`. Then create your owner account with `npm run admin:create` (see above) using the production `DATABASE_URL`.

**3. Website (Vercel).** Import the repo with the root directory left as the repository root. `vercel.json` at the root already sets the install command, build command and output folder. It builds in `static` mode by default.

To switch to the full platform later, set `VITE_DATA_MODE=api` in `apps/web/.env.production` and add this rewrite before the catch-all in `vercel.json`, so the API is served from your own domain and the admin cookie stays first-party (`SameSite=Strict`):

```json
{ "source": "/api/:path*", "destination": "https://YOUR-API-HOST/api/:path*" },
{ "source": "/sitemap.xml", "destination": "https://YOUR-API-HOST/sitemap.xml" },
```

| Variable | Where | What it does |
| --- | --- | --- |
| `DATABASE_URL` | API | Postgres connection string |
| `JWT_SECRET` | API | Signs admin sessions; 32+ random characters |
| `WEB_ORIGIN` | API | Your site's origin(s); limits CORS and cookies |
| `STORAGE_DRIVER` | API | `supabase` or `cloudinary` in production |
| `PAYMENTS_ENABLED` + `RAZORPAY_*` | API | Online payment, off by default |
| `VITE_DATA_MODE` | Web | `static` (default in `.env.production`) or `api` once the backend is live |

---

## Booking flow

1. The visitor fills in the form (name, mobile, email, trip, date, travellers, emergency contact, requirements). The total updates as they change the traveller count.
2. They review a summary, then tap **Send booking on WhatsApp**.
3. The API locks the trip row, checks it's bookable and has room, prices it from the database, saves the booking as **pending** and returns a booking reference (`JZT-XXXXX`).
4. WhatsApp opens with a structured message to **+91 80732 71501** containing the reference, trip, date, pickup, travellers, total and contact details.
5. The team shares payment details. Once paid, they **Mark paid and confirm** in Admin → Bookings. Only confirmed bookings count against seats, and confirming re-checks capacity.

### Turning on Razorpay later

Everything is in place but switched off. Set `PAYMENTS_ENABLED=true` with `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, and point a Razorpay webhook at `https://your-domain/api/payments/razorpay/webhook` (events: `payment.captured`, `order.paid`). A **Pay online** button then appears after booking. The API creates the order and verifies the signature with the secret key, so the secret never reaches the browser. A paid booking confirms itself if seats remain. If the trip filled up while the traveller was paying, it is flagged for the team instead.

---

## Roles

| | Owner | Manager | Content editor |
| --- | :-: | :-: | :-: |
| Trips (create, edit, publish) | ✓ | ✓ | ✓ |
| Delete trips | ✓ | | |
| Bookings and customer details, CSV export | ✓ | ✓ | |
| Leaders, gallery, reviews | ✓ | ✓ | ✓ |
| Site settings, team accounts | ✓ | | |

Sessions are httpOnly, `SameSite=Strict` cookies lasting 12 hours. Accounts lock for 15 minutes after 5 wrong passwords. Disabling a user or changing their role or password signs them out everywhere. Sign-ins, uploads and changes to trips, bookings, settings and team accounts are written to `audit_log`.

---

## Before launch: content to fill in

Nothing in this project invents facts about the business. These are marked as placeholders on the site (dashed boxes or "Sample" badges) until you replace them in the admin dashboard:

- **Trip leader profiles**: names, photos, introductions, stories. Years of experience and trips led stay hidden until you enter real figures.
- **Thadiyandamol seat count**: left empty, so the site shows no seat meter. Set it in Admin → Trips to switch on the "X of Y seats left" indicator.
- **Cancellation policy and payment terms**: written as placeholders. Add your refund slabs and advance amount.
- **Instagram handle**: set to `joinziptrip`. Confirm or change it in Admin → Settings.
- **Business email**: placeholder `hello@joinziptrip.com`.
- **Sample trips** (Waterfall Trek, Weekend Coorg Escape, Camping Adventure): unpublished drafts in the database. Edit them into real trips or delete them.
- **Photos**: the scenery images are generated stand-ins in the brand palette. Upload real trip photos through the admin. The poster and the trekker photo cropped from it are yours.
- **Reviews and past adventures**: start empty in production. The preview shows clearly labelled samples.
- **Itinerary timings**: only the 4:00 AM pickup is confirmed. Other steps use "Morning", "Afternoon" and similar until you add times.

Trek facts on the Thadiyandamol page (1,748 m, roughly 8–14 km round trip depending on where the vehicle stops, 5–6 hours on the trail, permits at the forest check-post near Nalknad Palace, best season October to February) come from published trail guides. They're worth a quick check with your local guide.

---

## Design notes

- **Palette** (from the brief): forest `#103D2B`, adventure orange `#F46A27` (actions only), cream `#FFF8E9`, off-white `#FAFAF6`, charcoal `#17221C`. Button text on orange is charcoal, which passes WCAG AA contrast. White on orange doesn't.
- **Type**: Eczar for headings, a bold editorial serif echoing the poster's lettering. Anek Latin for text. Both are from Indian type designers and come from Google Fonts.
- **Motifs**: things you book are shaped like trail tickets (perforated edges, a date stub), the "why us" bands carry topographic contour lines, and the hero pins a summit marker to the peak.
- **Accessibility**: skip link, visible focus states, labelled form fields with inline errors, keyboard-navigable lightbox, reduced-motion support, semantic headings.
- **SEO**: per-page titles, descriptions, canonical URLs, Open Graph tags, `TouristTrip` and `TravelAgency` structured data, a `robots.txt` that keeps out `/admin`, and a dynamic `sitemap.xml` from the API. For instant link previews on WhatsApp and Instagram, add a prerendering step for the public routes at build time, or move the public pages to Next.js when traffic grows.
- **Performance**: the admin code loads separately from the public site, images lazy-load with reserved space, and the generated scenery is about 25 KB per image.
