import { bearer, json, preflight } from "../../lib/http.js";
import { authUrl, googleConfigured, safeReturnTo } from "../../lib/google.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

function clientOrigin(req) {
  const raw = String(req.headers.origin || req.headers.referer || "").trim();
  try {
    const u = new URL(raw);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * GET /api/google/start
 * Auth optional: guests connect Gmail + Calendar; callback creates/links the yom account.
 * Query: ?returnTo=/looks
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }
  if (!googleConfigured()) {
    // The fix belongs in the logs, not in front of someone trying to sign in.
    console.warn("google start: missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI");
    json(res, 503, { ok: false, error: "google sign-in isn't switched on yet." });
    return;
  }
  if (!supabaseConfigured()) {
    console.warn("google start: missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
    json(res, 503, { ok: false, error: "sign-in isn't configured yet." });
    return;
  }

  const returnTo = safeReturnTo(req.query?.returnTo || "/looks");
  const token = bearer(req);
  const account = token ? await accountFromToken(token) : null;
  const userId = account?.profile?.id || null;
  // Signing in asks for identity only; connecting calendar and mail is a
  // separate, later consent.
  const signin = String(req.query?.intent || "") === "signin";

  const url = authUrl({
    userId,
    returnTo,
    guest: !userId,
    origin: clientOrigin(req),
    signin,
  });
  json(res, 200, { ok: true, url, guest: !userId, signin });
}
