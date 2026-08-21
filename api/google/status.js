import { bearer, json, preflight } from "../../lib/http.js";
import { googleConfigured } from "../../lib/google.js";
import { getGoogleAccount, publicGoogleStatus } from "../../lib/google-store.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/** GET /api/google/status — auth optional. No token = readiness probe, not an error. */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }

  const storeReady = supabaseConfigured();
  const googleOAuthReady = googleConfigured();
  const token = bearer(req);

  if (!token || !storeReady) {
    json(res, 200, {
      ok: true,
      connected: false,
      googleOAuthReady,
      storeReady,
    });
    return;
  }

  const account = await accountFromToken(token);
  if (!account?.profile?.id) {
    json(res, 200, {
      ok: true,
      connected: false,
      googleOAuthReady,
      storeReady,
    });
    return;
  }

  const g = await getGoogleAccount(account.profile.id);
  json(res, 200, {
    ok: true,
    googleOAuthReady,
    storeReady: true,
    ...publicGoogleStatus(g),
  });
}
