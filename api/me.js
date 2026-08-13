import { bearer, json, preflight } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { supabaseConfigured } from "../lib/supabase.js";

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

  const token = bearer(req);
  if (!token) {
    json(res, 401, { ok: false, error: "not signed in." });
    return;
  }

  const account = await accountFromToken(token);
  if (!account) {
    json(res, 401, { ok: false, error: "session expired." });
    return;
  }

  json(res, 200, { ok: true, ...account });
}
