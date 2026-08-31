-- Gmail → closet migration. Run AFTER schema.sql + google.sql.
-- Safe to re-run. Run each block separately if the editor errors on the full file.

-- 1) closet columns
alter table public.closet_items add column if not exists size text;
alter table public.closet_items add column if not exists fit text;
alter table public.closet_items add column if not exists source text default 'manual';
alter table public.closet_items add column if not exists gmail_id text;

-- 2) gmail_signals parsed fields
alter table public.gmail_signals add column if not exists item_name text;
alter table public.gmail_signals add column if not exists size text;
alter table public.gmail_signals add column if not exists parsed jsonb;

-- 3) lookup index (not required for upsert; app deletes then inserts by gmail_id)
create index if not exists closet_items_user_gmail_idx
  on public.closet_items (user_id, gmail_id)
  where gmail_id is not null;
