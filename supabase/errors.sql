-- What went wrong, from the phone it went wrong on.
--
-- Everything else in yom records what worked: a lead, a look, a lineup. A scan
-- that failed, an api that timed out or a page that threw left no trace at all,
-- so "is anything broken right now" was unanswerable. Run in the SQL editor.

create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  at timestamptz default now(),
  kind text,                -- scan_failed | api_error | js_error
  message text,
  status integer,
  path text,
  surface text,
  anon_id text,
  email text,
  account_key text,
  detail jsonb default '{}'::jsonb,
  user_agent text
);

create index if not exists app_errors_at_idx on public.app_errors (at desc);
create index if not exists app_errors_kind_idx on public.app_errors (kind);
create index if not exists app_errors_anon_idx on public.app_errors (anon_id);

alter table public.app_errors enable row level security;
-- written by /api/log-error with the service role; no anon policies on purpose
