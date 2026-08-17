import { json, preflight, readJson } from "../lib/http.js";
import { touchScanVisitor } from "../lib/leads.js";
import { supabaseConfigured } from "../lib/supabase.js";

/**
 * POST /api/scan-visit
 * Record every /scan visitor (anon_id required). Optional email → lead + allowlist.
 * Body: { anon_id, email?, name?, increment_check?, source?, campaign?, ... }
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
  if (body.website || body.company) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  const result = await touchScanVisitor({
    anon_id: body.anon_id,
    email: body.email,
    name: body.name,
    source: body.source,
    campaign: body.campaign,
    surface: body.surface || "mobile_web",
    path: body.path || "/scan",
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    referrer_user_id: body.referrer_user_id,
    channel: body.channel || "scan",
    increment_check: Boolean(body.increment_check),
    metadata: body.metadata,
  });

  if (!result.ok) {
    json(res, 400, { ok: false, error: result.error || "could not save." });
    return;
  }

  json(res, 200, {
    ok: true,
    visitor_id: result.visitor?.id || null,
    allowlisted: Boolean(result.lead?.allowlisted),
  });
}
