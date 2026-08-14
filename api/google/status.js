import { bearer, json, preflight } from "../../lib/http.js";
import { googleConfigured } from "../../lib/google.js";
import { getGoogleAccount, publicGoogleStatus } from "../../lib/google-store.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/** GET /api/google/status — is Google connected? */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "user store is not configured", configured: false });
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

  const g = await getGoogleAccount(account.profile.id);
  json(res, 200, {
    ok: true,
    googleOAuthReady: googleConfigured(),
    ...publicGoogleStatus(g),
  });
}
