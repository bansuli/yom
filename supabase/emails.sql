-- Who has already been written to.
--
-- The only protection against sending the same girl the same email twice, which
-- with a campaign is the difference between a note and a nuisance. Run in the
-- SQL editor before the first send.

create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  at timestamptz default now(),
  campaign text not null,
  email text not null,
  sent_by text
);

-- One row per girl per campaign — the send relies on this to skip her next time.
create unique index if not exists sent_emails_once_idx on public.sent_emails (campaign, email);
create index if not exists sent_emails_at_idx on public.sent_emails (at desc);

alter table public.sent_emails enable row level security;
-- written by /api/admin-email with the service role; no anon policies on purpose
