import { json, preflight, readJson } from "../lib/http.js";
import { adminIdentity, isAdminEmail } from "../lib/admin-auth.js";
import { makeLineupPrivate, purgePerson } from "../lib/purge-person.js";
import { supabaseConfigured } from "../lib/supabase.js";

/**
 * POST /api/admin-purge
 * { "action": "make_private" | "purge", "email": "test@youryom.com" }
 *
 * Founders only — wipe test data or hide a lineup from everyone.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }

  const who = await adminIdentity(req);
  if (!who) {
    json(res, 401, { ok: false, error: "nope." });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "supabase is not configured" });
    return;
  }

  const body = readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const action = String(body.action || "").trim();

  if (!email) {
    json(res, 400, { ok: false, error: "need an email." });
    return;
  }

  if (action === "make_private") {
    const result = await makeLineupPrivate(email);
    if (!result.ok) {
      json(res, 500, { ok: false, error: result.error || "could not update." });
      return;
    }
    json(res, 200, { ok: true, action, email, changed: result.changed });
    return;
  }

  if (action === "purge") {
    // Never purge a live founder account from the panel by mistake.
    if (isAdminEmail(email) && !email.startsWith("test@")) {
      json(res, 403, { ok: false, error: "cannot purge a founder admin email." });
      return;
    }
    const result = await purgePerson(email, { deleteAuth: true });
    if (!result.ok) {
      json(res, 500, { ok: false, error: result.error || "purge failed.", detail: result.steps });
      return;
    }
    json(res, 200, {
      ok: true,
      action,
      email,
      auth_deleted: result.authDeleted,
      steps: result.steps,
    });
    return;
  }

  json(res, 400, { ok: false, error: "action must be make_private or purge." });
}
