import { json, preflight, readJson } from "../lib/http.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "user store is not configured" });
    return;
  }

  const secret = process.env.YOM_ADMIN_SECRET;
  const given = req.headers["x-yom-admin"];
  if (!secret || given !== secret) {
    json(res, 401, { ok: false, error: "not allowed." });
    return;
  }

  const body = readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim() || email.split("@")[0];
  if (!email || !email.includes("@")) {
    json(res, 400, { ok: false, error: "need an email." });
    return;
  }

  const inserted = await sbAdmin(rest("allowlist", "on_conflict=email"), {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { email, name },
  });
  if (!inserted.ok) {
    json(res, 500, { ok: false, error: "could not add to the list." });
    return;
  }

  json(res, 200, { ok: true, email, name });
}
