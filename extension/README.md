# yom companion

A stylist on clothing sites. Reformation is just another shop — there is no hardcoded demo path. Logged-in yom accounts with Google connected get real calendar occasions and gmail order/return signals.

## Load

1. `chrome://extensions` → Load unpacked → `~/Desktop/yom/extension`
2. Reload after pulls (Chrome will ask to read/change data on all websites — that's expected)
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

## Sizing

How the companion reads the picker, matches her clothes/denim/shoe size, and when it asks: [`../docs/SIZING.md`](../docs/SIZING.md).

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

yom runs on **clothing shops only** — mainstream brands (Reformation, Everlane, Zara, Nike…), small apparel sites, and fashion resale (Depop, Vinted, Grailed…). Big marketplaces (Amazon, eBay, Target) only on clearly apparel pages. Beauty (Sephora, Ulta), home, grocery, and electronics are out.

1. Open any fashion retailer — Aritzia, SSENSE, COS, a boutique in Tokyo, etc.
2. Click yom → pick an occasion + budget (occasions come from Google when connected)
3. Pause on products. Open a PDP. Takes should name the piece and take a side.

## TikTok product evidence

On a PDP, **look into this** / advise calls `/api/yom-advise`, which runs the TikTok pipeline server-side (not in the extension):

1. **Discovery** — DuckDuckGo `site:tiktok.com/video` plus **Reddit** posts that embed TikTok links (free; fashion subs + sitewide search)
2. **Metadata** — public TikTok oembed captions (no comment scraping)
3. **Verification** — OpenAI filters false positives (e.g. Roberto Cavalli tiger jeans vs Jaded London) and optional vision compare against the PDP image
4. **Cache** — results keyed by product fingerprint for 24h so repeat opens are cheap

Structured output lands in `review_brief.tiktok` (consensus, sizing signals, fit claims). The overlay **reviews** line prefers TikTok consensus when present.

Requires `OPENAI_API_KEY` on Vercel. Set `TIKTOK_RESEARCH=0` to disable. Cached in Supabase (`product_tiktok_evidence`) for 7 days by default — run [`../supabase/tiktok-evidence.sql`](../supabase/tiktok-evidence.sql). Override with `TIKTOK_CACHE_DAYS=14` on Vercel.
