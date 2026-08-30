# Signing in

Three ways in, all landing on the same account:

| Way in | Endpoint | Needs setting up |
|---|---|---|
| Phone code | `POST /api/phone/start` → `POST /api/phone/verify` | an SMS provider in Supabase |
| Google | `GET /api/google/start?intent=signin` → callback → `POST /api/google/claim` | already working |
| Email + password | `POST /api/login`, `POST /api/signup` | already working |

Anyone can sign up. The `allowlist` table no longer refuses anyone — it is kept
only as the record of who was invited during the beta.

---

## 1. Run the migration

Open the Supabase SQL editor for the project `SUPABASE_URL` points at, paste
[`supabase/phone-auth.sql`](../supabase/phone-auth.sql), run it. Safe to run twice.

It makes `profiles.email` nullable (a phone-only account has no address), adds a
unique `profiles.phone`, and adds a check constraint so every account still has
at least one of the two.

**Do this before turning on phone sign-in.** Without it, the first phone signup
fails on `profiles.email` being `not null`.

## 2. Turn on phone sign-in

Phone codes are the one piece that cannot work until you connect an SMS
provider — Supabase does not send texts itself.

1. **Supabase dashboard → Authentication → Providers → Phone.** Turn it on.
2. Pick an SMS provider and paste its credentials. Twilio is the usual choice:
   - Sign up at twilio.com, buy a number (about $1.15/month)
   - From the Twilio console take the **Account SID**, an **Auth Token**, and
     create a **Messaging Service**, then paste all three into Supabase
   - Texts cost roughly $0.0079 each in the US; other countries cost more
3. **Authentication → Providers → Phone → OTP expiry.** 600 seconds is sensible.
4. Optional but worth it: **Authentication → Rate limits**, cap SMS per hour.
   Every send costs money, and the endpoint is public.

To check it end to end: open `/signin`, type a real number, and expect a text
within a few seconds. Until the provider is connected the endpoint answers
`text sign-in isn't switched on yet.` rather than failing obscurely.

### Making sure it does not get expensive

`POST /api/phone/start` will send a text to any number given to it. Supabase's
own rate limits are the thing standing between that and a bill, so set them.
The endpoint deliberately does not say whether a number already has an account,
so it cannot be used to test which numbers are registered.

## 3. Google

Already working — no dashboard changes needed. Confirm the OAuth client in the
Google Cloud console lists your callback as an authorised redirect URI:

```
https://youryom.com/api/google/callback
```

Signing in asks only for `openid email profile`. Calendar and Gmail are asked
for separately, when someone chooses to connect them from their profile. That
split matters: those two are *restricted* scopes, and an app that asks for them
up front both shows an alarming consent screen and is capped at 100 users until
Google finishes a security review.

## 4. Apple, if you want it

Not built, and it cannot be without:

- an **Apple Developer Program** membership, $99/year
- a **Services ID** and a **Sign in with Apple** private key
- Apple's rule that any app offering third-party sign-in on iOS must offer
  Sign in with Apple too — so this becomes required if the native app ships
  with Google sign-in

Once those exist it is the same shape as the Google flow.

---

## Env

Phone sign-in needs no new variables — it uses the Supabase keys already set:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Google sign-in uses the ones already there for Calendar:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://youryom.com/api/google/callback
```

## Checking the endpoints

```bash
npm run test:phone
```

Covers the guards that run before anything is sent: method, preflight, the
refusal when Supabase is unconfigured, and number and code validation. It makes
no network calls, so it passes without a Supabase project — and so it cannot
tell you whether texts actually arrive. Only a real number can.
