-- Shares for Cohort 1. Run after leads.sql.

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  sender_anon_id text,
  sender_email text,
  sender_user_id uuid,
  product jsonb not null default '{}'::jsonb,
  verdict jsonb not null default '{}'::jsonb,
  decision text,
  preview_note text,
  opens_count integer default 0,
  votes_count integer default 0,
  campaign text,
  source text,
  created_at timestamptz default now()
);

create index if not exists shares_sender_email_idx on public.shares (sender_email);
create index if not exists shares_sender_anon_idx on public.shares (sender_anon_id);
create index if not exists shares_created_at_idx on public.shares (created_at desc);

create table if not exists public.share_votes (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares (id) on delete cascade,
  voter_anon_id text,
  voter_name text,
  voter_email text,
  vote text not null,
  reason text,
  created_at timestamptz default now()
);

alter table public.share_votes add column if not exists voter_name text;

create index if not exists share_votes_share_id_idx on public.share_votes (share_id);

create table if not exists public.scan_checks (
  id uuid primary key default gen_random_uuid(),
  anon_id text,
  email text,
  user_id uuid,
  product jsonb not null default '{}'::jsonb,
  verdict jsonb not null default '{}'::jsonb,
  decision text,
  input_method text,
  share_id uuid references public.shares (id) on delete set null,
  campaign text,
  source text,
  surface text,
  created_at timestamptz default now()
);

alter table public.scan_checks add column if not exists image_url text;

create index if not exists scan_checks_anon_id_idx on public.scan_checks (anon_id);
create index if not exists scan_checks_email_idx on public.scan_checks (email);
create index if not exists scan_checks_created_at_idx on public.scan_checks (created_at desc);

alter table public.shares enable row level security;
alter table public.share_votes enable row level security;
alter table public.scan_checks enable row level security;
