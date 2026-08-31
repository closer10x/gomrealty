-- Go M Realty — booking abuse limits + cancellation
-- Applies to Supabase project cyexunowpxuflcmtpxbn

-- Rate limiting reads recent rows by ip_hash and by email; without these the
-- check is a sequential scan on every booking attempt.
create index if not exists bookings_ip_recent_idx
  on public.bookings (ip_hash, created_at desc);

create index if not exists bookings_email_recent_idx
  on public.bookings (email, created_at desc);

-- Cancellation is by token, so the lookup must be indexed and unique.
create unique index if not exists bookings_cancel_token_idx
  on public.bookings (cancel_token);
