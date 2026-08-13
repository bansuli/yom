# yom user store (Supabase)

Postgres lives here. The site and extension stay on Vercel and talk to it through `/api/*`.

The Anthropic key never goes in the extension. The service role key never goes in the extension or the Vite client.

## 1. Create a project

1. [supabase.com](https://supabase.com) → New project
2. Copy **Project URL**, **anon public**, and **service_role** from Settings → API

## 2. Run the schema

SQL editor → paste `schema.sql` → Run.

That creates `allowlist`, `profiles`, `closet_items`, `saved_items`, `sessions`, `events`, and seeds mal + ban on the allowlist.

## 3. Auth settings

Authentication → Providers → Email: enable email + password.

Turn **off** “Confirm email” for beta, or keep it on — `/api/signup` already marks new users confirmed.

## 4. Env vars

Local `.env` (gitignored) and Vercel → Settings → Environment Variables:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
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

Until these env vars exist, `/beta` and the extension keep the hardcoded demo. Reformation still works.

## Add a beta person

SQL editor:

```sql
insert into public.allowlist (email, name) values ('friend@email.com', 'friend');
```

Or `POST /api/allow` with header `x-yom-admin: $YOM_ADMIN_SECRET` and body `{ "email", "name" }`. Set `YOM_ADMIN_SECRET` in Vercel if you use that.
