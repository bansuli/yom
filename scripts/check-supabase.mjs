#!/usr/bin/env node
/**
 * Quick check: can this process talk to Supabase with current env?
 * Usage:
 *   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... node scripts/check-supabase.mjs
 * or: vercel env pull && node --env-file=.env.local scripts/check-supabase.mjs
 */

const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function headersFor(key) {
  const h = { apikey: key, "content-type": "application/json" };
  if (String(key).startsWith("eyJ")) h.authorization = `Bearer ${key}`;
  return h;
}

async function probe(label, key, path) {
  if (!key) {
    console.log(`✗ ${label}: missing key`);
    return false;
  }
  try {
    const res = await fetch(`${url}${path}`, { headers: headersFor(key) });
    const text = await res.text();
    const snippet = text.slice(0, 180).replace(/\s+/g, " ");
    const ok = res.ok;
    console.log(`${ok ? "✓" : "✗"} ${label} → ${res.status} ${snippet}`);
    return ok;
  } catch (e) {
    console.log(`✗ ${label}: ${e.message || e}`);
    return false;
  }
}

async function main() {
  console.log("SUPABASE_URL:", url || "(missing)");
  console.log("publishable set:", Boolean(publishable));
  console.log("secret set:", Boolean(secret));
  if (!url) process.exit(1);

  // Health / OpenAPI root often needs secret; tables need SQL applied.
  await probe("secret → lineups", secret, "/rest/v1/lineups?select=id&limit=1");
  await probe("secret → pipeline_looks", secret, "/rest/v1/pipeline_looks?select=id&limit=1");
  await probe("publishable → lineups", publishable, "/rest/v1/lineups?select=id&limit=1");
}

main();
