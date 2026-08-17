import { json, preflight, readJson } from "../lib/http.js";
import { upsertLead } from "../lib/leads.js";
import { supabaseConfigured } from "../lib/supabase.js";

/**
 * POST /api/leads
 * Public email capture → leads table + auto allowlist.
 * Body: { email, name?, channel?, path?, anon_id?, source?, campaign?, utm_* }
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "user store is not configured" });
    return;
  }

  const body = readJson(req);
  // honeypot
  if (body.website || body.company) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  const result = await upsertLead({
    email: body.email,
    name: body.name,
    source: body.source,
    campaign: body.campaign,
    surface: body.surface,
    path: body.path,
    anon_id: body.anon_id,
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    referrer_user_id: body.referrer_user_id,
    channel: body.channel || "waitlist",
    metadata: body.metadata,
  });

  if (!result.ok) {
    json(res, 400, { ok: false, error: result.error || "could not save." });
    return;
  }

  json(res, 200, {
    ok: true,
    email: result.lead?.email || String(body.email || "").toLowerCase(),
    allowlisted: Boolean(result.allowlisted),
  });
}
