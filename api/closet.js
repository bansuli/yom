import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken, ingestOnboarding } from "../lib/profile.js";
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

  const body = readJson(req);
  await ingestOnboarding(account.user, body);
  const fresh = await accountFromToken(token);
  json(res, 200, { ok: true, ...fresh });
}
