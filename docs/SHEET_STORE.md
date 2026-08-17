# Store yom data in a Google Sheet (no Supabase)

You only need **~5 minutes** in Google + one Vercel env. Everything else is already in the repo.

## What’s already done in code

- APIs write to the sheet when `SHEET_WEBHOOK_URL` is set ([`lib/sheet-store.js`](../lib/sheet-store.js))
- Apps Script (auto-creates tabs + headers): [`scripts/sheet-webhook.gs`](../scripts/sheet-webhook.gs)
- Local tester: `node scripts/test-sheet-webhook.mjs`

## What you still do (required)

### 1. Google Sheet + script (you — needs your Google login)

1. Open [sheets.new](https://sheets.new) → rename to **yom cohort 1**
2. **Extensions → Apps Script**
3. Delete the stub code → paste **all** of [`scripts/sheet-webhook.gs`](../scripts/sheet-webhook.gs) → Save
4. In the editor, select function **`setupYomSheets`** → **Run** (approve permissions once)
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the web app URL (`https://script.google.com/macros/s/…/exec`)

### 2. Vercel env (you or Ban)

On Ban’s Pro team project `yom`:

```
SHEET_WEBHOOK_URL=<paste web app URL>
```

Then redeploy (`vercel --prod`) — or tell Cursor the URL and ask to add + deploy.

### 3. Smoke test

```bash
export SHEET_WEBHOOK_URL='https://script.google.com/macros/s/XXXX/exec'
node scripts/test-sheet-webhook.mjs
```

Or:

```bash
curl -X POST https://www.youryom.com/api/leads \
  -H 'content-type: application/json' \
  -d '{"email":"test@youryom.com","channel":"waitlist","campaign":"reformation_monday"}'
```

You should see a row on the **leads** tab.

## Optional

- Set `SECRET` inside the Apps Script and `SHEET_WEBHOOK_SECRET` on Vercel to the same string.
- Supabase is still optional later for real accounts; the sheet is enough for Cohort 1 capture.

## Scan photos

`scan_checks` has **image** (thumbnail in-cell) and **image_url** (Drive link). Photos land in a Drive folder named `yom-scan-photos`.

After updating [`scripts/sheet-webhook.gs`](../scripts/sheet-webhook.gs): paste into Apps Script → Save → **Deploy → Manage deployments → ✎ → New version**. Run `setupYomSheets` once and approve **Drive** access.
