-- Go M Realty — lead capture
-- Applies to Supabase project cyexunowpxuflcmtpxbn

create extension if not exists "pgcrypto";

create type lead_kind as enum ('contact', 'valuation');
create type lead_intent as enum ('Buying', 'Selling', 'Both', 'Relocating');

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  kind             lead_kind    not null default 'contact',
  intent           lead_intent,

  full_name        text not null check (length(trim(full_name)) between 1 and 120),
  email            text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone            text check (length(phone) <= 40),
  property_address text check (length(property_address) <= 300),
  message          text check (length(message) <= 4000),

  -- provenance, useful for attribution and for spotting abuse
  source_path      text,
  referrer         text,
  user_agent       text,
  ip_hash          text,

  handled          boolean not null default false,
  handled_at       timestamptz,
  notes            text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_kind_idx       on public.leads (kind, created_at desc);
create index if not exists leads_unhandled_idx  on public.leads (created_at desc) where not handled;

alter table public.leads enable row level security;

-- No anon policies on purpose. Inserts go through /api/leads using the
-- service-role key, which bypasses RLS. That keeps the table unreadable and
-- unwritable from the browser even though the anon key ships to the client.
revoke all on public.leads from anon, authenticated;

comment on table public.leads is
  'Contact + valuation form submissions. Written server-side by /api/leads only.';
