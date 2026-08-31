-- Google Calendar + Gmail integration tables.
-- Paste into Supabase SQL editor after schema.sql (safe to re-run).

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.google_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  google_sub text,
  email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scopes text,
  calendar_synced_at timestamptz,
  gmail_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  google_event_id text not null,
  title text not null,
  description text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean default false,
  html_link text,
  status text,
  kind text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, google_event_id)
);

create table if not exists public.gmail_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_id text not null,
  thread_id text,
  subject text,
  from_addr text,
  snippet text,
  sent_at timestamptz,
  signal_kind text, -- order | return | sizing | shipping | other
  brand text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, gmail_id)
);

create index if not exists calendar_events_user_starts_idx
  on public.calendar_events (user_id, starts_at);
create index if not exists gmail_signals_user_sent_idx
  on public.gmail_signals (user_id, sent_at desc);

alter table public.google_accounts enable row level security;
alter table public.calendar_events enable row level security;
alter table public.gmail_signals enable row level security;

-- App server uses service role; users only read their own synced rows.
drop policy if exists calendar_events_select_own on public.calendar_events;
create policy calendar_events_select_own on public.calendar_events
  for select using (auth.uid() = user_id);

drop policy if exists gmail_signals_select_own on public.gmail_signals;
create policy gmail_signals_select_own on public.gmail_signals
  for select using (auth.uid() = user_id);

-- Tokens never exposed via anon key policies (no select for users on google_accounts).
drop policy if exists google_accounts_select_own_meta on public.google_accounts;
create policy google_accounts_select_own_meta on public.google_accounts
  for select using (auth.uid() = user_id);

drop trigger if exists google_accounts_updated_at on public.google_accounts;
create trigger google_accounts_updated_at
  before update on public.google_accounts
  for each row execute procedure public.set_updated_at();

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row execute procedure public.set_updated_at();
