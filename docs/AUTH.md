# Signing in — what works, and what to switch on

Three ways in, all landing on the same account.

| Way in | Works in production? | What it needs from you |
|---|---|---|
| Email + password | **yes** | nothing |
| Google | no — credentials missing | a Google OAuth client, then 3 env vars on Vercel |
| Phone code | no — no SMS provider | the SQL migration, then Twilio wired into Supabase |

Anyone can sign up. The `allowlist` table no longer refuses anyone; it is kept
only as the record of who was invited during the beta.

Supabase itself **is** configured in production — `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are all set on Vercel, which
is why email and password sign-in works today.

---

## 1. Google sign-in

Two halves: make a credential at Google, then give it to Vercel.

### a. Make the OAuth client

1. Go to **console.cloud.google.com** → pick your project (or make one).
2. **APIs & Services → OAuth consent screen**, if you have not done it already:
   - User type **External**, then **Publish app** (in Testing mode only accounts
     you list by hand can sign in)
   - App name `yom`, your support email, your logo
   - Scopes: add `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile`. **Nothing else.** Those three are
     non-sensitive, so Google will not ask you for a security review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type **Web application**
   - Name it `yom web`
   - **Authorised JavaScript origins:**
     ```
     https://www.youryom.com
     https://youryom.com
     ```
   - **Authorised redirect URIs** — this one must match exactly, character for
     character, or Google refuses with `redirect_uri_mismatch`:
     ```
     https://www.youryom.com/api/google/callback
     ```
4. Copy the **Client ID** and **Client secret**.

### b. Give them to Vercel

**Vercel → your yom project → Settings → Environment Variables.** Add three,
ticking Production, Preview and Development for each:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the client ID, ends `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | the client secret |
| `GOOGLE_REDIRECT_URI` | `https://www.youryom.com/api/google/callback` |

Then **redeploy** — env vars only reach the running functions on a new deploy.
Deployments → the latest one → ⋯ → Redeploy.

### c. Check it

Open `/signin`, click **continue with google**. You should land on Google's
"Choose an account" screen saying *to continue to youryom.com*, and come back
signed in.

To check it from a terminal without clicking anything:

```bash
curl -s "https://www.youryom.com/api/google/start?intent=signin&returnTo=/signin"
```

`{"ok":true,"url":"https://accounts.google.com/..."}` means it is configured.
`{"ok":false,...}` means the env vars have not landed yet.

### A note on what it asks for

Signing in requests `openid email profile` and nothing more. Calendar and Gmail
are asked for separately, later, from the profile page — they are *restricted*
scopes, and an app that requests them up front shows an alarming consent screen
and is capped at 100 users until Google finishes a security review.

---

## 2. Phone sign-in

### a. Run the migration first

Supabase → **SQL Editor** → paste [`supabase/phone-auth.sql`](../supabase/phone-auth.sql) → **Run**.
Safe to run twice.

It makes `profiles.email` nullable (a phone-only account has no address), adds a
unique `profiles.phone`, and adds a constraint so every account still has one of
the two.

**Do this before turning phone on.** Without it the first phone signup fails on
`profiles.email` being `not null`, and the person sees "signed in, but couldn't
load your yom".

### b. Get a Twilio number

Supabase does not send texts itself; it hands off to a provider.

1. Sign up at **twilio.com**, verify your own number.
2. **Phone Numbers → Buy a number.** Pick one with SMS capability, about
   **$1.15/month**.
3. **Messaging → Services → Create Messaging Service**
   - Name it `yom`
   - Use case **Verify / 2FA**
   - Add the number you just bought to its sender pool
   - Copy the **Messaging Service SID** (starts `MG`)
4. From the Twilio **Console dashboard** copy the **Account SID** (starts `AC`)
   and the **Auth Token**.

> **US and Canada need a registration step.** A2P 10DLC: Messaging → Regulatory
> Compliance → register a brand and a campaign. Sole proprietor registration is
> a few dollars and usually clears in a day or two. Texts to US numbers are
> filtered or blocked until it is done — if codes silently fail to arrive, this
> is almost always why.

### c. Wire it into Supabase

Supabase → **Authentication → Sign In / Providers → Phone**:

1. Turn **Enable phone provider** on
2. SMS provider **Twilio**
3. Paste **Account SID**, **Auth Token**, **Messaging Service SID**
4. **OTP expiry** 600 seconds
5. **Save**

### d. Set the rate limits, before you test

**Authentication → Rate Limits.** `POST /api/phone/start` is public and every
call spends money.

- **SMS sent per hour** — start at 30 while testing
- Twilio also has spend alerts under Billing; set one

The endpoint deliberately never says whether a number already has an account, so
it cannot be used to test which numbers are registered.

### e. Check it

Open `/signin`, type a real number, expect a text in a few seconds. Until the
provider exists the endpoint answers `text sign-in isn't switched on yet.`

Roughly **$0.0079** per US text, plus the number's monthly fee.

---

## 3. Resend, for email

`lib/email.js` already talks to Resend, and goes quiet if there is no key. It is
not part of signing in — Supabase sends nothing for password login, and phone
codes go over SMS. It is for the mail yom sends people: restore links,
orientation, campaigns.

1. Sign up at **resend.com**
2. **Domains → Add domain** → `youryom.com`. Resend gives you DKIM and SPF
   records; add them wherever `youryom.com`'s DNS lives, and wait for verified.
   Sending from an unverified domain lands in spam.
3. **API Keys → Create**, permission **Sending access**
4. Add to Vercel and redeploy:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `EMAIL_FROM` | `yom <hello@youryom.com>` |
| `EMAIL_REPLY_TO` | wherever replies should go |

Free tier is 3,000 emails a month, 100 a day.

---

## 4. Apple — not built

Cannot be, without:

- an **Apple Developer Program** membership, **$99/year**
- a **Services ID** and a **Sign in with Apple** key

Worth knowing before the native app ships: Apple *requires* Sign in with Apple
in any iOS app that offers third-party sign-in. Shipping the app with Google
makes Apple mandatory, not optional.

---

## The whole env list

Already set on Vercel:

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

To add:

```
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI   # google sign-in
RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO                     # outbound email
```

Phone needs no new variables — it rides on the Supabase keys already there.

## Checking the endpoints

```bash
npm run test:phone
```

Covers the guards that run before anything is sent: method, preflight, the
refusal when Supabase is unconfigured, and number and code validation. It makes
no network calls, so it passes without a Supabase project — and so it cannot
tell you whether texts actually arrive. Only a real number can.
