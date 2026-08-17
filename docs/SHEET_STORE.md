# Store yom data in a Google Sheet (no Supabase)

Best path for tomorrow: one Google Sheet + a tiny Apps Script webhook. Emails, scan visits, checks, and shares land as rows you can open in Sheets.

## 1. Create the spreadsheet

New Google Sheet named **yom cohort 1**. Create tabs (exact names):

- `leads`
- `scan_visitors`
- `scan_checks`
- `shares`
- `share_votes`

Row 1 headers (copy into each tab as needed):

**leads:** `at, email, name, channel, source, campaign, surface, path, anon_id, utm_source, utm_medium, utm_campaign, referrer_user_id, metadata`

**scan_visitors:** `at, anon_id, email, source, campaign, surface, path, checks_count, metadata`

**scan_checks:** `at, anon_id, email, product_name, brand, price, decision, input_method, verdict_title, campaign, source, surface, product_json, verdict_json`

**shares:** `at, share_id, sender_email, sender_anon_id, sender_user_id, decision, campaign, source, product_json, verdict_json, opens_count, votes_count`

**share_votes:** `at, share_id, vote, reason, voter_email, voter_anon_id`

## 2. Apps Script

In the sheet: **Extensions → Apps Script**. Paste:

```javascript
const SECRET = ""; // optional; must match SHEET_WEBHOOK_SECRET on Vercel

function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function authorize_(e) {
  const secret = (e.parameter && e.parameter.secret) || "";
  if (SECRET && secret !== SECRET) return false;
  return true;
}

function doGet(e) {
  e = e || { parameter: {} };
  if (!authorize_(e)) return ok({ ok: false, error: "unauthorized" });
  const action = e.parameter.action;
  if (action === "get_share") {
    const id = e.parameter.id;
    const sh = SpreadsheetApp.getActive().getSheetByName("shares");
    if (!sh || !id) return ok({ ok: false, error: "not found" });
    const data = sh.getDataRange().getValues();
    const headers = data[0].map(String);
    const idCol = headers.indexOf("share_id");
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(id)) {
        const row = {};
        headers.forEach((h, j) => (row[h] = data[i][j]));
        try {
          row.product = JSON.parse(row.product_json || "{}");
          row.verdict = JSON.parse(row.verdict_json || "{}");
        } catch (_) {}
        // bump opens
        const opensCol = headers.indexOf("opens_count");
        if (opensCol >= 0) {
          const n = Number(row.opens_count) || 0;
          sh.getRange(i + 1, opensCol + 1).setValue(n + 1);
          row.opens_count = n + 1;
        }
        return ok({ ok: true, share: row, votes: [] });
      }
    }
    return ok({ ok: false, error: "share not found" });
  }
  return ok({ ok: true, ping: true });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents || "{}");
  } catch (_) {
    return ok({ ok: false, error: "bad json" });
  }
  if (SECRET && body.secret !== SECRET) return ok({ ok: false, error: "unauthorized" });

  const table = body.table || "leads";
  const row = body.row || {};
  const sh = SpreadsheetApp.getActive().getSheetByName(table);
  if (!sh) return ok({ ok: false, error: "missing tab " + table });

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const values = headers.map((h) => {
    const v = row[h];
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });
  sh.appendRow(values);
  return ok({ ok: true, table: table });
}
```

Deploy: **Deploy → New deployment → Web app**

- Execute as: **Me**
- Who has access: **Anyone**

Copy the web app URL.

## 3. Vercel env

```
SHEET_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
SHEET_WEBHOOK_SECRET=          # optional, same as SECRET in script
```

Redeploy. Supabase is **optional** after this — leads/scans/shares will still save to the sheet.

## 4. Smoke test

```bash
curl -X POST https://www.youryom.com/api/leads \
  -H 'content-type: application/json' \
  -d '{"email":"test@youryom.com","channel":"waitlist","source":"reformation_sample_sale","campaign":"reformation_monday"}'
```

A row should appear on the `leads` tab within a few seconds.
