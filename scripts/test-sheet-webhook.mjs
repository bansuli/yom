#!/usr/bin/env node
/**
 * Test SHEET_WEBHOOK_URL (local .env or process env).
 * Usage: SHEET_WEBHOOK_URL=https://script.google.com/.../exec node scripts/test-sheet-webhook.mjs
 */

const url = (process.env.SHEET_WEBHOOK_URL || process.env.LEADS_WEBHOOK_URL || "").replace(/\/$/, "");
const secret = process.env.SHEET_WEBHOOK_SECRET || "";

if (!url) {
  console.error("Set SHEET_WEBHOOK_URL first.");
  process.exit(1);
}

async function main() {
  console.log("ping…", url.slice(0, 60) + "…");
  const ping = await fetch(`${url}?action=ping&secret=${encodeURIComponent(secret)}`);
  const pingBody = await ping.text();
  console.log("GET", ping.status, pingBody.slice(0, 300));

  console.log("append test lead…");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret,
      table: "leads",
      row: {
        at: new Date().toISOString(),
        email: "sheet-test@youryom.com",
        name: "sheet test",
        channel: "sheet_test",
        source: "reformation_sample_sale",
        campaign: "reformation_monday",
        surface: "web",
        path: "/join",
      },
    }),
  });
  const text = await res.text();
  console.log("POST", res.status, text.slice(0, 300));
  if (!res.ok) process.exit(1);
  console.log("ok — check the leads tab for sheet-test@youryom.com");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
