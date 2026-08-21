# yom companion

A stylist on clothing sites. Reformation is just another shop — there is no hardcoded demo path. Logged-in yom accounts with Google connected get real calendar occasions and gmail order/return signals.

## Load

1. `chrome://extensions` → Load unpacked → `~/Desktop/yom/extension`
2. Reload after pulls
3. Click the yom icon

Triple-click the character to reset.

## Shared API key (every user)

The key does **not** go in the extension. Anyone could unpack it.

It lives as a Vercel env var. The extension calls `https://youryom.com/api/yom-advise`. Every install uses that.

1. In the Vercel project for youryom.com, add **one** of:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
2. Deploy (OpenAI is used if both are set; Anthropic is fallback)
3. Reload the extension

```bash
# Vercel dashboard → Settings → Environment Variables
# or:
npx vercel env add ANTHROPIC_API_KEY
npx vercel --prod
```

## User login (Supabase)

Profiles, closet, saves, takes, outcomes, and the beta allowlist live in Postgres. Same account on the site and in the popup.

1. Follow [`../supabase/README.md`](../supabase/README.md)
2. Vercel env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Popup → log in (or create account if you're on the allowlist)

Without login, yom still styles from the product page. It will not invent a closet or calendar.

## Google Calendar + Gmail

See [`../supabase/GOOGLE.md`](../supabase/GOOGLE.md).

1. Connect Gmail & Calendar on `/scan`, `/join`, or `/beta`
2. Extension loads `/api/google/events` after login
3. Purpose chips become real calendar rows
4. Advise/scan prompts include upcoming events and order/return mail

## Analytics (PostHog)

See [`../docs/ANALYTICS.md`](../docs/ANALYTICS.md).

1. Put the same public PostHog project key in [`analytics-config.js`](./analytics-config.js)
2. Reload the unpacked extension

Do not put `SUPABASE_SERVICE_ROLE_KEY` in the extension.

## Test another website

1. Open Aritzia / SSENSE / COS / etc.
2. Popup → **use this tab** if yom didn’t appear
3. Click yom → pick an occasion + budget (occasions come from Google when connected)
4. Pause on products. Open a PDP. Takes should name the piece and take a side.
