-- PNM recruitment pipeline: looks, closet flags, public lineups.
-- Run after schema.sql + leads.sql.

create table if not exists public.pipeline_looks (
  id uuid primary key default gen_random_uuid(),
  anon_id text,
  email text,
  user_id uuid,
  title text,
  image_url text,
  source_url text,
  input_method text,
  round_id text,
  day_id text,
  score numeric,
  product jsonb default '{}'::jsonb,
  verdict jsonb default '{}'::jsonb,
  in_closet boolean default false,
  created_at timestamptz default now()
);

create index if not exists pipeline_looks_email_idx on public.pipeline_looks (email);
create index if not exists pipeline_looks_anon_idx on public.pipeline_looks (anon_id);
create index if not exists pipeline_looks_created_at_idx on public.pipeline_looks (created_at desc);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  anon_id text,
  email text,
  user_id uuid,
  display_name text,
  last_name text,
  show_last_name boolean default true,
  show_ratings boolean default true,
  is_public boolean default false,
  sisterhood boolean default false,
  days jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lineups_email_idx on public.lineups (email);
create index if not exists lineups_anon_idx on public.lineups (anon_id);
alter table public.lineups add column if not exists show_ratings boolean default true;

-- A yom belongs to the person, not the browser: the account key is the secret
-- her device holds and the only thing the server trusts to hand her looks back.
alter table public.pipeline_looks add column if not exists account_key text;
alter table public.lineups add column if not exists account_key text;
create index if not exists pipeline_looks_account_idx on public.pipeline_looks (account_key);
create index if not exists lineups_account_idx on public.lineups (account_key);

alter table public.pipeline_looks enable row level security;
alter table public.lineups enable row level security;
