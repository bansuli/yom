# yom user store (Supabase)

Postgres lives here. The site and extension stay on Vercel and talk to it through `/api/*`.

The Anthropic key never goes in the extension. The service role key never goes in the extension or the Vite client.

## 1. Create a project

1. [supabase.com](https://supabase.com) → New project
2. Copy **Project URL**, **anon public**, and **service_role** from Settings → API

## 2. Run the schema

SQL editor → paste `schema.sql` → Run.

That creates `allowlist`, `profiles`, `closet_items`, `saved_items`, `sessions`, `events`, `takes`, `outcomes`, and seeds mal + ban on the allowlist.

Re-run the file after pulls — `alter table ... add column if not exists` is safe.

## 3. Auth settings

Authentication → Providers → Email: enable email + password.

Turn **off** “Confirm email” for beta, or keep it on — `/api/signup` already marks new users confirmed.

## 4. Env vars

Local `.env` (gitignored) and Vercel → Settings → Environment Variables:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

Optional, same values for the site if you ever talk to Supabase from the browser:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Redeploy after saving.

## 5. First founder login

1. Deploy
2. `/beta` → create account with `mal@youryom.com` or `ban@youryom.com`
3. Signup copies the spring 2026 closet into their profile
4. Log into the extension popup with the same email

Until these env vars exist, `/beta` login and synced profiles are unavailable. Scan and the extension still style from the page/photo.

## Analytics (PostHog + acquisition)

See [`../docs/ANALYTICS.md`](../docs/ANALYTICS.md). Run `analytics.sql`, set `VITE_PUBLIC_POSTHOG_*` on Vercel, paste the same key into `extension/analytics-config.js`.

## Leads + scan visitors (auto allowlist)

See [`leads.sql`](./leads.sql). Run it in Supabase.

- Homepage waitlist, survey email, and `/scan` email → `leads` **and** `allowlist` automatically
- Every `/scan` open → `scan_visitors` (by `anon_id`), even without email
- They can create an account on `/beta` immediately — no manual allowlist for Cohort 1

## Recruitment lineup (PNM pipeline)

See [`lineup.sql`](./lineup.sql). Run it in Supabase.

- Looks from photo / upload / pasted link / text live in `pipeline_looks`
- `/lineup` public share writes `lineups` (`is_public`, display name, last-name toggle)
- `GET /api/lineup?id=` is the public view (top picks only — not the full house list)



See [`shares.sql`](./shares.sql). Enables `/s/:id` friend votes and persists every scan check.

## TikTok product evidence cache

See [`tiktok-evidence.sql`](./tiktok-evidence.sql). Run it in Supabase.

- `/api/yom-advise` caches verified TikTok evidence in `product_tiktok_evidence` (keyed by brand + name + color + retailer host)
- Default TTL: **7 days** (`TIKTOK_CACHE_DAYS` on Vercel)
- Negative results are cached too (no verified videos → skip DuckDuckGo until expiry)
- Server-only table (service role); no extension access

## Google Calendar + Gmail

See [`GOOGLE.md`](./GOOGLE.md). Run `google.sql`, set `GOOGLE_CLIENT_*` on Vercel, then **connect google** on `/beta`.

## Add a beta person

SQL editor:

```sql
insert into public.allowlist (email, name) values ('friend@email.com', 'friend');
```

Or `POST /api/allow` with header `x-yom-admin: $YOM_ADMIN_SECRET` and body `{ "email", "name" }`. Set `YOM_ADMIN_SECRET` in Vercel if you use that.
