# yom analytics — Cohort 1

Supabase = user + product truth. PostHog = product analytics, funnels, cohorts, retention, session replay. Stripe = payment truth (later).

## Identity

1. Anonymous visitors get a stable `yom_anon_id` (web `localStorage`, extension `chrome.storage.local`).
2. PostHog `distinct_id` = that anon id until auth.
3. On **signup** and **login**: `alias(anon_id)` then `identify(supabase_user_id)` with person properties (email, name, acquisition_*).
4. Canonical `user_id` = Supabase `auth.users.id` / `profiles.id`.

Someone can scan → create yom → mobile → Chrome → subscribe and still be one person in PostHog.

## Cohort 1 defaults (Reformation Monday)

When UTMs / campaign params are missing:

| Property | Default |
|----------|---------|
| `source` / `acquisition_source` | `reformation_sample_sale` |
| `campaign` / `acquisition_campaign` | `reformation_monday` |
| `activation_date` | `2026-08-17` |

Also capture when present: `utm_source`, `utm_medium`, `utm_campaign`, `ref` / `referrer_user_id`, `qr=1`.

`onboarding_version` = `cohort1_survey_v1`.

## Berkeley Recruitment context (new)

Recruitment is tracked as **shopping context**, not a separate account type.

- `shopping_context`: `berkeley_fpr_2026` (or `general_shopping`)
- `recruitment_round`: `orientation` | `unity_day` | `sisterhood_day` | `philanthropy_day` | `preference` | `bid_day`
- Recommended QR params: `?campaign=berkeley_fpr_2026&source=berkeley_flyer&context=berkeley_fpr_2026` (pre-selects the option; user must still tap it or submit with it selected)
- `shopping_context` and `recruitment_round` are set **only when the user explicitly chooses** UC Berkeley sorority recruitment in `/join` — not from URL alone

Key events added for this transition:
- `context_selected`
- `round_selected` (when round is explicitly chosen)

## Retention

- Do **not** fire `week_N_retained`.
- Cohort by `signup_completed` (+ breakdown `acquisition_campaign` / `acquisition_source`).
- **Critical event** = `product_check_completed`.
- Active in W1–W4 = that event fired in the window (not pageviews).

## Events shipped for Cohort 1

Every event should include: `source`, `campaign`, `surface` (`web` | `mobile_web` | `extension`), and `user_id` once identified.

| Event | When | Surface |
|-------|------|---------|
| `page_viewed` | every SPA route change (`path`, `search`, `referrer`) | web / mobile_web |
| `landing_viewed` | `/` or `/survey` first paint | web |
| `qr_scanned` | URL has `qr=1` (or `/r/` entry) | web |
| `signup_started` | beta create-account submit | web |
| `signup_completed` | signup API success | web |
| `yom_creation_started` | survey mount | web |
| `onboarding_answered` | major survey step change (`step`, `onboarding_version`) | web |
| `yom_created` | account created + onboarding ingested | web |
| `extension_installed` | `onInstalled` reason `install` | extension |
| `shopping_session_started` | companion session begins / `/scan` open | extension / mobile_web |
| `product_check_started` | check UX starts (Chrome or `/scan`) | extension / mobile_web |
| `product_identified` | vision scan returns a product | mobile_web |
| `product_check_completed` | check finishes (**retention critical**) | extension / mobile_web |
| `yom_verdict_viewed` | verdict UI shown | extension / mobile_web |
| `user_decision_recorded` | buy / skip / save | extension / mobile_web |

Product props when relevant: `product_id`, `brand`, `sku`, `price`, `category`, `retailer`, `input_method`, `verdict`, `decision`.

## Taxonomy locked — implement later

Shares / votes / referrals (beyond storing `referrer_user_id`), Stripe ladder (`paywall_viewed` → `subscription_renewed`), `extension_removed`, named `purchase_recorded` / `return_recorded` / `kept_recorded` (outcomes already land in Supabase).

## Phone scan (`/scan`)

Mobile camera / upload → `POST /api/yom-scan` (OpenAI vision, Anthropic fallback) → verdict + buy/skip/save.

QR for in-store: `https://www.youryom.com/join?qr=1&campaign=reformation_monday`

Funnel: **poster landing → email → home screen → camera** (`/join` then `/scan`). Visiting `/scan` without completing join redirects back to `/join`.

PWA: `public/manifest.webmanifest` + Add to Home Screen tip on the scan page. Same PostHog/Supabase identity as the site.

## Leads automation

Every email from waitlist / survey / scan:

1. Upserts into `leads` (if Supabase) **and/or** Google Sheet via `SHEET_WEBHOOK_URL`
2. Auto-upserts into `allowlist` when Supabase is connected
3. Scan opens also upsert `scan_visitors`

**Fastest for tomorrow:** [SHEET_STORE.md](./SHEET_STORE.md) — Google Sheet + Apps Script, no Supabase.

## Sharing + create yom

Run [`supabase/shares.sql`](../supabase/shares.sql).

| Surface | What happens |
|---------|----------------|
| `/scan` → **ask friends** | creates `shares` row, native share sheet / copy link `/s/:id` |
| `/s/:id` | friend opens, votes buy/skip/save, optional email → lead + referrer |
| `/create` | create-your-yom entry; keeps `ref` / `share_id` into survey → beta |
| scan checks | every check saved to `scan_checks` (product + verdict + decision) |

Events: `share_clicked`, `share_created`, `share_opened`, `vote_submitted`, `vote_reason_submitted`, `referred_signup_started`.

## PostHog project setup

1. Create a PostHog Cloud project.
2. Enable **session replay**; mask all inputs; block sensitive selectors (e.g. file inputs, `.survey-photo`, password fields).
3. Copy **Project API key** into:
   - Vercel (Ban’s Pro team `yom` project): `VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST` (e.g. `https://us.i.posthog.com`)
   - [`extension/analytics-config.js`](../extension/analytics-config.js): same key + host
4. Redeploy web: `vercel --prod` (or Git deploy).
5. Reload unpacked extension after updating the config.

### Insights to create

- **Funnel:** `landing_viewed` → `signup_completed` → `yom_created` → `product_check_completed`
- **Retention:** cohorting event `signup_completed`, retained by `product_check_completed`, breakdown `acquisition_campaign`
- **Person:** filter `acquisition_campaign = reformation_monday`

## Env

```
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Web only uses Vite public vars. Extension uses `extension/analytics-config.js` (no secrets in the extension beyond the public project key).

## SQL

Run [`supabase/analytics.sql`](../supabase/analytics.sql) so `profiles` stores acquisition fields at signup.
