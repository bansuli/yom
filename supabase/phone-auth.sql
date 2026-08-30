-- Phone sign-in, and opening the door past the beta list.
--
-- Run this in the Supabase SQL editor, once, against the same project the
-- SUPABASE_URL env var points at. It is safe to run twice.

-- 1. A phone-only account has no email address to store.
--    Postgres lets a unique index hold many NULLs, so the existing
--    `email unique` still stops two accounts sharing one address.
alter table public.profiles alter column email drop not null;

-- 2. Somewhere to keep the number Supabase Auth verified.
alter table public.profiles add column if not exists phone text;

create unique index if not exists profiles_phone_key
  on public.profiles (phone)
  where phone is not null;

-- 3. An account now needs one way to be reached, not specifically an email.
alter table public.profiles drop constraint if exists profiles_contactable;
alter table public.profiles add constraint profiles_contactable
  check (email is not null or phone is not null);

-- 4. The allowlist table is no longer a gate on signing up. It is left in
--    place rather than dropped: it still records who was invited during the
--    beta, and dropping it would lose that. Nothing reads it to refuse
--    anyone any more.
comment on table public.allowlist is
  'Beta invite list. No longer gates signup — kept for the record of who was invited.';
