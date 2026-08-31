import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { purgeSelf } from "../lib/purge-person.js";
import { supabaseConfigured } from "../lib/supabase.js";

/**
 * POST /api/account-delete
 * Body: { confirm: "DELETE" }
 *
 * Deletes the caller's own account and the data attached to it. Whose account
 * comes from the session token, never from the body. The typed confirmation is
 * there because this cannot be undone — no soft delete, no recovery window.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "Sign-in is not configured yet." });
    return;
  }

  const token = bearer(req);
  if (!token) {
    json(res, 401, { ok: false, error: "Not signed in." });
    return;
  }

  const account = await accountFromToken(token);
  if (!account?.user?.id) {
    json(res, 401, { ok: false, error: "Session expired. Sign in again." });
    return;
  }

  const body = readJson(req);
  if (String(body.confirm || "") !== "DELETE") {
    json(res, 400, { ok: false, error: "Type DELETE to confirm." });
    return;
  }

  const result = await purgeSelf({
    userId: account.user.id,
    email: account.user.email || account.profile?.email || "",
    phone: account.profile?.phone || "",
  });

  if (!result.ok) {
    console.warn("account delete", account.user.id, result.error, JSON.stringify(result.steps || []));
    json(res, 500, { ok: false, error: "Couldn't delete everything. Email support@youryom.com and we'll finish it." });
    return;
  }

  json(res, 200, { ok: true, deleted: true });
}
