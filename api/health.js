import { json, preflight } from "../lib/http.js";
import { supabaseAnon, supabaseService, supabaseUrl } from "../lib/supabase.js";

/**
 * GET /api/health
 *
 * Says which pieces are wired up and which are not, without printing a single
 * secret. Key values are reduced to their format ("sb_secret", "legacy_jwt",
 * "missing") because the format is usually the bug — a project on the new
 * publishable/secret keys rejects a legacy service_role JWT with a bare 401
 * that looks identical to a typo.
 */

function keyShape(value) {
  const v = String(value || "");
  if (!v) return "missing";
  if (v.startsWith("sb_secret_")) return "sb_secret";
  if (v.startsWith("sb_publishable_")) return "sb_publishable";
  if (v.startsWith("eyJ")) return "legacy_jwt";
  return "unrecognised";
}

async function probe(url, headers) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    let message = "";
    try {
      message = JSON.parse(text)?.message || "";
    } catch {
      message = text.slice(0, 120);
    }
    return { status: res.status, ok: res.ok, message: message.slice(0, 160) };
  } catch (e) {
    return { status: 0, ok: false, message: String(e?.message || e).slice(0, 160) };
  }
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }

  const url = supabaseUrl();
  const anon = supabaseAnon();
  const service = supabaseService();

  const out = {
    supabase: {
      url: Boolean(url),
      anon_key: keyShape(anon),
      service_key: keyShape(service),
    },
    google: {
      client_id: Boolean(process.env.GOOGLE_CLIENT_ID),
      client_secret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || null,
    },
    email: {
      resend_key: Boolean(process.env.RESEND_API_KEY),
      from: process.env.EMAIL_FROM || null,
    },
  };

  if (url && anon) {
    const h = { apikey: anon };
    if (anon.startsWith("eyJ")) h.Authorization = `Bearer ${anon}`;
    out.supabase.read_profiles = await probe(`${url}/rest/v1/profiles?select=id&limit=1`, h);
  }

  if (url && service) {
    const h = { apikey: service };
    if (service.startsWith("eyJ")) h.Authorization = `Bearer ${service}`;
    // Creating an account goes through the admin API. If this is not ok,
    // nothing can sign up, whatever the front end says.
    out.supabase.admin_users = await probe(`${url}/auth/v1/admin/users?page=1&per_page=1`, h);
  }

  const healthy =
    out.supabase.url &&
    out.supabase.admin_users?.ok === true &&
    out.supabase.read_profiles?.ok === true;

  json(res, 200, { ok: healthy, checks: out });
}
