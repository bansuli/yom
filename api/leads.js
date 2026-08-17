import { json, preflight, readJson } from "../lib/http.js";
import { storeConfigured, upsertLead, upsertLeads } from "../lib/leads.js";

function leadFromBody(body = {}) {
  return {
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
    queued_at: body.queued_at,
  };
}

/**
 * POST /api/leads
 * Public email capture → Google Sheet and/or Supabase + auto allowlist.
 * Accepts one lead or `{ leads: [...] }` so the phone can flush a queue.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!storeConfigured()) {
    json(res, 503, { ok: false, error: "user store is not configured — set SHEET_WEBHOOK_URL or SUPABASE_*" });
    return;
  }

  const body = readJson(req);
  if (body.website || body.company) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  const batch = Array.isArray(body.leads) ? body.leads.map(leadFromBody) : null;
  const result = batch
    ? await upsertLeads(batch)
    : await upsertLead(leadFromBody(body));

  if (!result.ok) {
    json(res, 400, { ok: false, error: result.error || "could not save." });
    return;
  }

  json(res, 200, {
    ok: true,
    email: result.lead?.email || String(body.email || "").toLowerCase(),
    allowlisted: Boolean(result.allowlisted),
    sheet: Boolean(result.sheet),
    count: result.count || 1,
  });
}
