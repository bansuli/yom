import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

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
  const inserted = await sbAdmin(rest("sessions"), {
    method: "POST",
    body: {
      user_id: account.user.id,
      mode: body.mode || null,
      purpose: body.purpose || null,
      budget: body.budget == null || body.budget === "" ? null : Number(body.budget),
      spent: body.spent == null || body.spent === "" ? 0 : Number(body.spent),
    },
  });
  if (!inserted.ok) {
    json(res, 500, { ok: false, error: "could not store session." });
    return;
  }

  json(res, 200, { ok: true });
}
