import { bearer, json, preflight } from "../../lib/http.js";
import { deleteGoogleAccount, getGoogleAccount } from "../../lib/google-store.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/** POST /api/google/disconnect */
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

  const token = bearer(req);
  if (!token) {
    json(res, 401, { ok: false, error: "not signed in." });
    return;
  }
  const account = await accountFromToken(token);
  if (!account?.profile?.id) {
    json(res, 401, { ok: false, error: "session expired." });
    return;
  }

  const existing = await getGoogleAccount(account.profile.id);
  if (existing) await deleteGoogleAccount(account.profile.id);
  json(res, 200, { ok: true, connected: false });
}
