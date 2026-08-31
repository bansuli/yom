-- Avatar colour, how the account was made, and whether the welcome went out.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- The avatar is a solid colour with the person's initial, not a photo pulled
-- from Google. Stored as a hex string so it survives palette changes.
alter table public.profiles add column if not exists avatar_color text;

-- "google", "phone", "email" — so you can see how people actually arrive, and
-- which sign-in to fix first when one breaks.
alter table public.profiles add column if not exists auth_provider text;

-- Set when the welcome email goes out, so a retry or a second sign-in never
-- sends it twice.
alter table public.profiles add column if not exists welcomed_at timestamptz;
