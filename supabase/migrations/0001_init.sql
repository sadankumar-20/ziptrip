-- JoinZipTrip schema. Works on Supabase or any PostgreSQL 14+.
-- The Express API is the only client: it connects with a server-side connection string.
-- Row Level Security is enabled with no policies, so Supabase's public REST/anon key can read nothing.

-- gen_random_uuid() is built into PostgreSQL 13+, so no extension is needed.

do $$ begin
  create type trip_category  as enum ('trekking', 'weekend_getaway', 'adventure', 'group_trip');
  create type difficulty     as enum ('easy', 'easy_moderate', 'moderate', 'challenging');
  create type status_mode    as enum ('auto', 'open', 'filling_fast', 'sold_out');
  create type leader_role    as enum ('founder', 'trek_leader', 'coordinator');
  create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
  create type payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
  create type booking_channel as enum ('whatsapp', 'razorpay');
  create type review_status  as enum ('pending', 'approved', 'rejected');
  create type review_source  as enum ('website', 'google', 'instagram', 'admin');
  create type admin_role     as enum ('owner', 'manager', 'editor');
exception when duplicate_object then null;
end $$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- trips
create table if not exists trips (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title               text not null,
  destination         text not null,
  region              text not null default '',
  category            trip_category not null,
  summary             text not null default '',
  description         text not null default '',
  highlights          jsonb not null default '[]',
  difficulty          difficulty not null default 'easy',
  distance_label      text not null default '',
  trek_duration_label text not null default '',
  altitude_m          int check (altitude_m between 0 and 9000),
  age_group           text,
  fitness             text not null default '',
  pickup_point        text not null default '',
  pickup_city         text not null default '',
  pickup_time         text not null default '',
  return_schedule     text not null default '',
  departure_date      date,
  departure_time      time,
  duration_days       int not null default 1 check (duration_days between 1 and 30),
  duration_label      text not null default '',
  price_inr           int check (price_inr >= 0),
  seats_total         int check (seats_total > 0),
  status_mode         status_mode not null default 'auto',
  is_featured         boolean not null default false,
  is_published        boolean not null default false,
  is_demo             boolean not null default false,
  cover_image         jsonb not null,
  gallery             jsonb not null default '[]',
  itinerary           jsonb not null default '[]',
  inclusions          jsonb not null default '[]',
  exclusions          jsonb not null default '[]',
  things_to_carry     jsonb not null default '[]',
  safety              jsonb not null default '[]',
  cancellation_policy jsonb not null default '[]',
  booking_terms       jsonb not null default '[]',
  faqs                jsonb not null default '[]',
  elevation           jsonb not null default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists trips_published_date_idx on trips (is_published, departure_date);
drop trigger if exists trips_touch on trips;
create trigger trips_touch before update on trips for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- leaders
create table if not exists leaders (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null,
  role             leader_role not null,
  photo_url        text,
  intro            text not null default '',
  story            text not null default '',
  philosophy       text not null default '',
  years_experience int check (years_experience between 0 and 60),  -- null until verified by the owner
  trips_led        int check (trips_led >= 0),                     -- null until verified by the owner
  destinations     jsonb not null default '[]',
  specializations  jsonb not null default '[]',
  languages        jsonb not null default '[]',
  instagram        text,
  is_published     boolean not null default true,
  is_demo          boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists leaders_touch on leaders;
create trigger leaders_touch before update on leaders for each row execute function touch_updated_at();

create table if not exists trip_leaders (
  trip_id   uuid not null references trips(id) on delete cascade,
  leader_id uuid not null references leaders(id) on delete cascade,
  position  int not null default 0,
  primary key (trip_id, leader_id)
);

-- ---------------------------------------------------------------- bookings
create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique check (ref ~ '^JZT-[A-Z0-9]{5}$'),
  trip_id             uuid not null references trips(id) on delete restrict,
  departure_date      date,
  full_name           text not null,
  phone               text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email               text not null,
  travellers          int not null check (travellers between 1 and 20),
  emergency_name      text not null,
  emergency_phone     text not null check (emergency_phone ~ '^[6-9][0-9]{9}$'),
  notes               text not null default '',
  unit_price_inr      int not null check (unit_price_inr >= 0),
  total_inr           int not null,
  status              booking_status not null default 'pending',
  payment_status      payment_status not null default 'unpaid',
  channel             booking_channel not null default 'whatsapp',
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  admin_notes         text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (total_inr = unit_price_inr * travellers)
);
create index if not exists bookings_trip_status_idx on bookings (trip_id, status);
create index if not exists bookings_phone_idx on bookings (phone);
drop trigger if exists bookings_touch on bookings;
create trigger bookings_touch before update on bookings for each row execute function touch_updated_at();

-- Seats count only confirmed and completed bookings. Pending WhatsApp enquiries do not hold seats.
create or replace view trip_seat_usage as
select t.id as trip_id,
       coalesce(sum(b.travellers) filter (where b.status in ('confirmed', 'completed')), 0)::int as seats_booked,
       coalesce(sum(b.travellers) filter (where b.status = 'pending'), 0)::int as seats_pending
from trips t
left join bookings b on b.trip_id = t.id
group by t.id;

-- Creates a booking atomically: locks the trip row, checks it is bookable and has room,
-- and prices it from the database (never from the client).
create or replace function create_booking(
  p_trip_slug text, p_ref text, p_full_name text, p_phone text, p_email text, p_travellers int,
  p_emergency_name text, p_emergency_phone text, p_notes text, p_channel booking_channel default 'whatsapp'
) returns setof bookings language plpgsql as $$
declare
  t trips;
  booked int;
begin
  select * into t from trips where slug = p_trip_slug for update;
  if not found or not t.is_published then
    raise exception 'TRIP_NOT_FOUND';
  end if;
  if t.is_demo or t.price_inr is null or t.departure_date is null then
    raise exception 'TRIP_NOT_BOOKABLE';
  end if;
  if ((t.departure_date + coalesce(t.departure_time, time '00:00')) at time zone 'Asia/Kolkata') <= now() then
    raise exception 'TRIP_DEPARTED';
  end if;
  if t.status_mode = 'sold_out' then
    raise exception 'SOLD_OUT';
  end if;
  if t.seats_total is not null then
    select coalesce(sum(travellers), 0) into booked
      from bookings where trip_id = t.id and status in ('confirmed', 'completed');
    if booked + p_travellers > t.seats_total then
      raise exception 'NOT_ENOUGH_SEATS:%', greatest(t.seats_total - booked, 0);
    end if;
  end if;
  return query
    insert into bookings (ref, trip_id, departure_date, full_name, phone, email, travellers,
                          emergency_name, emergency_phone, notes, unit_price_inr, total_inr, channel)
    values (p_ref, t.id, t.departure_date, p_full_name, p_phone, p_email, p_travellers,
            p_emergency_name, p_emergency_phone, coalesce(p_notes, ''), t.price_inr, t.price_inr * p_travellers, p_channel)
    returning *;
end $$;

-- Confirming a booking re-checks capacity under the same lock, so two admins can't oversell the last seats.
create or replace function set_booking_status(p_id uuid, p_status booking_status)
returns setof bookings language plpgsql as $$
declare
  b bookings;
  t trips;
  booked int;
begin
  select * into b from bookings where id = p_id;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into t from trips where id = b.trip_id for update;
  if p_status in ('confirmed', 'completed') and b.status not in ('confirmed', 'completed') and t.seats_total is not null then
    select coalesce(sum(travellers), 0) into booked
      from bookings where trip_id = t.id and status in ('confirmed', 'completed') and id <> b.id;
    if booked + b.travellers > t.seats_total then
      raise exception 'NOT_ENOUGH_SEATS:%', greatest(t.seats_total - booked, 0);
    end if;
  end if;
  return query update bookings set status = p_status where id = p_id returning *;
end $$;

-- ---------------------------------------------------------------- reviews
create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid references trips(id) on delete set null,
  trip_name       text not null,
  name            text not null,
  photo_url       text,
  rating          int not null check (rating between 1 and 5),
  body            text not null,
  experience_date date,
  status          review_status not null default 'pending',
  is_featured     boolean not null default false,
  is_verified     boolean not null default false,
  is_demo         boolean not null default false,
  source          review_source not null default 'website',
  booking_ref     text,
  created_at      timestamptz not null default now()
);
create index if not exists reviews_status_idx on reviews (status, is_featured);

-- ---------------------------------------------------------------- albums (past adventures)
create table if not exists albums (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  location     text not null default '',
  trip_date    date,
  trip_id      uuid references trips(id) on delete set null,
  leader_id    uuid references leaders(id) on delete set null,
  participants int check (participants > 0),  -- only when verified
  story        text not null default '',
  cover_url    text,
  media        jsonb not null default '[]',
  is_published boolean not null default false,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists albums_touch on albums;
create trigger albums_touch before update on albums for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- contact enquiries
create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  email      text not null default '',
  topic      text not null default 'trip',
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- admin users & audit
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  role          admin_role not null default 'editor',
  password_hash text not null,
  is_active     boolean not null default true,
  token_version int not null default 0,       -- bump to sign a user out everywhere
  failed_logins int not null default 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists audit_log (
  id         bigserial primary key,
  actor_id   uuid references admin_users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- site settings (single row)
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- lock down
alter table trips            enable row level security;
alter table leaders          enable row level security;
alter table trip_leaders     enable row level security;
alter table bookings         enable row level security;
alter table reviews          enable row level security;
alter table albums           enable row level security;
alter table contact_messages enable row level security;
alter table admin_users      enable row level security;
alter table audit_log        enable row level security;
alter table settings         enable row level security;
