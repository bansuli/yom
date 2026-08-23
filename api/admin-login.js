import { json, preflight, readJson } from "../lib/http.js";
import { signIn, supabaseConfigured } from "../lib/supabase.js";
import { isAdminEmail } from "../lib/admin-auth.js";

/**
 * Log in to /admin. Deliberately separate from /beta: that is the founder
 * closet app, this is the numbers, and mixing them makes both confusing.
 *
 * Passwords are supabase auth's problem, not ours — nothing here stores or
 * hashes anything. Only the two founder addresses may pass.
 */

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "supabase is not configured" });
    return;
  }

  const body = readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    json(res, 400, { ok: false, error: "email and password, please." });
    return;
  }
  if (!isAdminEmail(email)) {
    // Same answer as a bad password: no hint about which addresses count.
    json(res, 401, { ok: false, error: "wrong email or password." });
    return;
  }

  const auth = await signIn(email, password);
  if (!auth.ok || !auth.data?.access_token) {
    json(res, 401, { ok: false, error: "wrong email or password." });
    return;
  }

  json(res, 200, { ok: true, access_token: auth.data.access_token, email });
}
