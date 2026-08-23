import { json, preflight, readJson } from "../lib/http.js";
import { adminIdentity } from "../lib/admin-auth.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

/**
 * Mark an issue handled. Resolving stamps every occurrence recorded so far, so
 * the same fault happening again after the fix comes back as unresolved rather
 * than staying quietly ticked off — which is the whole point of marking it.
 */

function text(v, max = 400) {
  return String(v || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST" });
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
  const reopen = body.action === "reopen";
  const kind = text(body.kind, 40);
  const message = text(body.message, 400);
  if (!kind || !message) {
    json(res, 400, { ok: false, error: "need the issue." });
    return;
  }

  // Match the group the way the page groups it: same kind, same message.
  const filter =
    `kind=eq.${encodeURIComponent(kind)}` +
    `&message=eq.${encodeURIComponent(message)}` +
    (reopen ? "&resolved_at=not.is.null" : "&resolved_at=is.null");

  const updated = await sbAdmin(rest("app_errors", filter), {
    method: "PATCH",
    body: reopen
      ? { resolved_at: null, resolved_by: null }
      : { resolved_at: new Date().toISOString(), resolved_by: who },
    prefer: "return=representation",
  });

  if (!updated.ok) {
    json(res, 500, { ok: false, error: updated.data?.message || "could not update." });
    return;
  }
  json(res, 200, { ok: true, changed: Array.isArray(updated.data) ? updated.data.length : 0 });
}
