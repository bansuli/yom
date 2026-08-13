-- yom user store. Paste into Supabase → SQL editor → Run.
-- Auth users live in auth.users. This file adds the app tables on top.

create table if not exists public.allowlist (
  email text primary key,
  name text,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text,
  trait text,
  pre_buy text,
  keep_lean text,
  yom_read text,
  headline text,
  memory text,
  sizes jsonb default '{}'::jsonb,
  style jsonb default '[]'::jsonb,
  source_note text default 'beta',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purchased_at text,
  item text not null,
  note text,
  kept boolean default true,
  href text,
  site text,
  brand text,
  kind text,
  color text,
  price numeric,
  return_reason text,
  image_url text,
  created_at timestamptz default now()
);

alter table public.closet_items add column if not exists href text;
alter table public.closet_items add column if not exists site text;
alter table public.closet_items add column if not exists brand text;
alter table public.closet_items add column if not exists kind text;
alter table public.closet_items add column if not exists color text;
alter table public.closet_items add column if not exists price numeric;
alter table public.closet_items add column if not exists return_reason text;
alter table public.closet_items add column if not exists image_url text;

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  href text,
  price numeric,
  note text,
  site text,
  created_at timestamptz default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text,
  purpose text,
  budget numeric,
  spent numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  when_text text,
  kind text,
  created_at timestamptz default now()
);

create table if not exists public.takes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_key text not null,
  site text,
  surface text,
  stamp text,
  kind text,
  title text,
  regret integer,
  mode text,
  purpose text,
  created_at timestamptz default now()
);

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_key text not null,
  take_id uuid references public.takes (id) on delete set null,
  action text not null,
  reason text,
  name text,
  href text,
  site text,
  brand text,
  kind text,
  color text,
  price numeric,
  created_at timestamptz default now()
);

create index if not exists closet_items_user_id_idx on public.closet_items (user_id);
create index if not exists closet_items_user_kind_idx on public.closet_items (user_id, kind);
create index if not exists saved_items_user_id_idx on public.saved_items (user_id);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists takes_user_id_idx on public.takes (user_id);
create index if not exists takes_user_product_idx on public.takes (user_id, product_key);
create index if not exists outcomes_user_id_idx on public.outcomes (user_id);
create index if not exists outcomes_user_product_idx on public.outcomes (user_id, product_key);
create unique index if not exists saved_items_user_href_idx
  on public.saved_items (user_id, href)
  where href is not null and href <> '';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.closet_items enable row level security;
alter table public.saved_items enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.takes enable row level security;
alter table public.outcomes enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

drop policy if exists closet_own on public.closet_items;
create policy closet_own on public.closet_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists saved_own on public.saved_items;
create policy saved_own on public.saved_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists sessions_own on public.sessions;
create policy sessions_own on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists events_own on public.events;
create policy events_own on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists takes_own on public.takes;
create policy takes_own on public.takes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists outcomes_own on public.outcomes;
create policy outcomes_own on public.outcomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.allowlist (email, name) values
  ('mal@youryom.com', 'mal'),
  ('ban@youryom.com', 'ban')
on conflict (email) do nothing;
