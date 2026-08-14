# Google Calendar + Gmail for yom

Framework so yom can pull **upcoming occasions** from Google Calendar and **order / return / sizing signals** from Gmail. Tokens stay on the server (Supabase + service role). The extension never sees Google secrets.

## What you get

| Endpoint | Purpose |
|----------|---------|
| `GET /api/google/start` | Returns Google OAuth URL (Bearer auth) |
| `GET /api/google/callback` | OAuth redirect — stores tokens, first sync |
| `GET /api/google/status` | `{ connected, email, calendar_synced_at, gmail_synced_at }` |
| `POST /api/google/sync` | Re-pull calendar and/or gmail |
| `GET /api/google/events` | Upcoming events + recent mail signals for yom context |
| `POST /api/google/disconnect` | Wipe tokens + synced rows |

Libraries:
- `lib/google.js` — OAuth, Calendar list, Gmail search, event classification
- `lib/google-store.js` — token refresh, sync into Postgres, public status

## 1. Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project
2. **APIs & Services → Enable APIs**
   - Google Calendar API
   - Gmail API
3. **OAuth consent screen**
   - External (or Internal for Workspace-only)
   - App name: yom
   - Scopes:
     - `openid`, `email`, `profile`
     - `.../auth/calendar.readonly`
     - `.../auth/gmail.readonly`
   - Add test users while in Testing
4. **Credentials → Create OAuth client ID → Web application**
   - Authorized redirect URI:
     - `https://youryom.com/api/google/callback`
     - `http://localhost:3000/api/google/callback` (local, if needed)

## 2. Supabase

SQL editor → run [`google.sql`](./google.sql)

Creates:
- `google_accounts` (tokens — service role writes; users cannot read tokens via anon)
- `calendar_events`
- `gmail_signals`

Also mirrors a short list into existing `events` so the companion’s “Sofia’s wedding” style chips can use real dates.

## 3. Vercel env

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://youryom.com/api/google/callback
APP_BASE_URL=https://youryom.com
GOOGLE_TOKEN_SECRET=          # optional HMAC for OAuth state; defaults to client secret
```

Plus existing `SUPABASE_*`. Redeploy after saving.

## 4. Connect from the beta page

Logged-in flow:

```js
// 1) get oauth url
const start = await fetch('/api/google/start?returnTo=/beta', {
  headers: { Authorization: `Bearer ${accessToken}` },
})
const { url } = await start.json()
window.location.href = url

// 2) after redirect back: /beta?google=connected
const status = await fetch('/api/google/status', {
  headers: { Authorization: `Bearer ${accessToken}` },
})

// 3) optional resync
await fetch('/api/google/sync', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ calendar: true, gmail: true }),
})

// 4) feed yom context
const dig = await fetch('/api/google/events', {
  headers: { Authorization: `Bearer ${accessToken}` },
})
// dig.events → [{ label, when, kind, ... }]
// dig.gmail  → [{ subject, kind: 'order'|'return'|..., brand, snippet }]
```

## 5. How the extension should use it

1. User logs into yom (existing popup / beta)
2. Connect Google once on `/beta`
3. Extension (or `/api/me` later) loads `/api/google/events`
4. Purpose chips prefer real calendar rows (`kind: wedding|trip|work|date|event`)
5. “look into this” research can cite `gmail` signals (orders, returns, sizing mail) as another source

Demo path on Reformation can keep hardcoded Sofia’s wedding until a connected calendar has a wedding-like event.

## Security notes

- Refresh tokens live only in `google_accounts`, written with the **service role**
- OAuth `state` is HMAC-signed and short-lived
- Scopes are readonly — yom cannot send mail or edit calendars
- Rotate `GOOGLE_CLIENT_SECRET` if leaked; users must reconnect

## Local test checklist

1. Run `google.sql`
2. Set env vars (Vercel or `vercel dev`)
3. Log into `/beta`
4. Click **connect Google**
5. Approve Calendar + Gmail
6. `GET /api/google/events` should return upcoming events
