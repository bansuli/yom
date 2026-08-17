-- Leads + scan visitors. Run in Supabase SQL editor after schema.sql.
-- Automates Cohort 1: every captured email is also upserted into allowlist.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text,
  campaign text,
  surface text,
  path text,
  anon_id text,
  referrer_user_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  channel text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_anon_id_idx on public.leads (anon_id);
create index if not exists leads_campaign_idx on public.leads (campaign);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

create table if not exists public.scan_visitors (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  email text,
  source text,
  campaign text,
  surface text,
  path text default '/scan',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer_user_id uuid,
  checks_count integer default 0,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

create unique index if not exists scan_visitors_anon_id_idx on public.scan_visitors (anon_id);
create index if not exists scan_visitors_email_idx on public.scan_visitors (email);
create index if not exists scan_visitors_last_seen_idx on public.scan_visitors (last_seen_at desc);

alter table public.leads enable row level security;
alter table public.scan_visitors enable row level security;
-- service role writes from /api/*; no anon policies (intentional)
