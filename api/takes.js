import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { insertTake } from "../lib/store.js";
import { supabaseConfigured } from "../lib/supabase.js";

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
  const account = token ? await accountFromToken(token) : null;
  if (!account) {
    json(res, 401, { ok: false, error: "not signed in." });
    return;
  }

  const result = await insertTake(account.user.id, readJson(req));
  if (!result.ok) {
    json(res, 400, { ok: false, error: result.error || "could not store take." });
    return;
  }
  json(res, 200, { ok: true, take: result.take });
}
