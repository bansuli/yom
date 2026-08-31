import { json, preflight, readJson } from "../../lib/http.js";
import { verifyState } from "../../lib/google.js";
import { sessionForUserId } from "../../lib/scan-account.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/**
 * POST /api/google/claim
 * Body: { grant } — one-time HMAC from OAuth callback. Returns a yom session.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, {
      ok: false,
      error: "Sign-in is not configured yet.",
    });
    return;
  }

  const body = readJson(req);
  const grant = verifyState(body.grant || req.query?.grant);
  if (!grant?.userId || grant.kind !== "session_grant") {
    json(res, 400, { ok: false, error: "Invalid or expired Google sign-in. Try again." });
    return;
  }

  try {
    const session = await sessionForUserId(grant.userId);
    json(res, 200, { ok: true, ...session });
  } catch (e) {
    console.warn("google claim", e?.message || e);
    json(res, 500, { ok: false, error: e?.message || "Could not finish Google sign-in." });
  }
}
