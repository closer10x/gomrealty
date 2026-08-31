-- Go M Realty — call bookings
-- Applies to Supabase project cyexunowpxuflcmtpxbn

create type booking_status as enum ('confirmed', 'cancelled');
create type booking_topic as enum ('Buying', 'Selling', 'Both', 'Relocating');

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- The slot itself. Stored as instants; the display timezone is a
  -- presentation concern handled in lib/booking.ts.
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        booking_status not null default 'confirmed',
  topic         booking_topic,

  full_name     text not null check (length(trim(full_name)) between 1 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text check (length(phone) <= 40),
  message       text check (length(message) <= 4000),
  -- The visitor's own IANA zone, so a callback isn't placed at 3am their time.
  visitor_tz    text check (length(visitor_tz) <= 64),

  -- provenance, useful for attribution and for spotting abuse
  source_path   text,
  referrer      text,
  user_agent    text,
  ip_hash       text,

  cancel_token  uuid not null default gen_random_uuid(),
  cancelled_at  timestamptz,
  notes         text,

  constraint bookings_span_valid check (ends_at > starts_at)
);

-- The double-booking guarantee. Two people hitting Submit on the same slot at
-- the same moment cannot both win: the second insert raises 23505 and the API
-- turns that into a "just taken, pick another" response. Partial, so a
-- cancelled booking frees its slot for rebooking.
create unique index if not exists bookings_slot_unique
  on public.bookings (starts_at)
  where status = 'confirmed';

create index if not exists bookings_starts_at_idx on public.bookings (starts_at);
create index if not exists bookings_upcoming_idx
  on public.bookings (starts_at) where status = 'confirmed';
create index if not exists bookings_email_idx on public.bookings (email, created_at desc);

alter table public.bookings enable row level security;

-- Same posture as `leads`: no anon policies. Reads and writes go through
-- /api/bookings with the service-role key, which bypasses RLS. Availability is
-- exposed only as free/busy, never as other people's names or emails.
revoke all on public.bookings from anon, authenticated;

comment on table public.bookings is
  'Scheduled intro calls. Written server-side by /api/bookings only.';
comment on index public.bookings_slot_unique is
  'Prevents double-booking a confirmed slot; cancelled bookings free the slot.';
