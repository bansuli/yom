-- Avatar colour and photo, how the account was made, and whether the welcome
-- email went out.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- Everyone starts as one of the palette colours, assigned from their id.
alter table public.profiles add column if not exists avatar_color text;

-- Set once someone uploads a photo of their own. When it is null the colour
-- is what shows.
alter table public.profiles add column if not exists avatar_url text;

-- "google", "phone", "email" — so you can see how people actually arrive, and
-- which sign-in to fix first when one breaks.
alter table public.profiles add column if not exists auth_provider text;

-- Set when the welcome email goes out, so a retry or a second sign-in never
-- sends it twice.
alter table public.profiles add column if not exists welcomed_at timestamptz;

-- Where the photos live. Public-read: an avatar is shown to anyone who can
-- see the person, and a signed URL would expire in the middle of a session.
-- Writes never come from the browser — only the server, holding the service
-- key — so there is no public insert policy to grant.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB; the client downsizes to well under this before sending
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
