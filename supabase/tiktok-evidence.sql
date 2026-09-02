-- TikTok product evidence cache (server-only via service role).
-- Run in Supabase SQL editor after schema.sql.

create table if not exists public.product_tiktok_evidence (
  fingerprint text primary key,
  brand text,
  name text,
  color text,
  source_url text,
  image_url text,
  evidence jsonb,
  video_count integer not null default 0,
  consensus text,
  fit text,
  queries_used text[] default '{}',
  researched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists product_tiktok_evidence_expires_idx
  on public.product_tiktok_evidence (expires_at);

create index if not exists product_tiktok_evidence_brand_name_idx
  on public.product_tiktok_evidence (brand, name);

drop trigger if exists product_tiktok_evidence_updated_at on public.product_tiktok_evidence;
create trigger product_tiktok_evidence_updated_at
  before update on public.product_tiktok_evidence
  for each row execute procedure public.set_updated_at();

alter table public.product_tiktok_evidence enable row level security;

-- No client policies — only /api/* with SUPABASE_SERVICE_ROLE_KEY reads/writes this table.
