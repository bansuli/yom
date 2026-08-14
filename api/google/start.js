import { bearer, json, preflight } from "../../lib/http.js";
import { authUrl, googleConfigured } from "../../lib/google.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/**
 * GET /api/google/start
 * Auth: Bearer yom access token
 * Query: ?returnTo=/beta
 * → { ok, url }  (open url to begin Google OAuth)
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "user store is not configured" });
    return;
  }
  if (!googleConfigured()) {
    json(res, 503, {
      ok: false,
      error: "google oauth is not configured. set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI.",
    });
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

  const returnTo = String(req.query?.returnTo || "/beta").startsWith("/")
    ? String(req.query.returnTo)
    : "/beta";

  const url = authUrl({ userId: account.profile.id, returnTo });
  json(res, 200, { ok: true, url });
}
