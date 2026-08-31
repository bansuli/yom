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
    // Which commit is actually answering. Without this it is guesswork whether
    // a fix is live, and that guesswork has cost real time.
    deploy: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      env: process.env.VERCEL_ENV || null,
    },
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

  // ?probe=create attempts the one operation that is failing — creating a user
  // — and reports exactly what Postgres said, then deletes what it made. This
  // is a temporary diagnostic; remove it once signup is working.
  if (req.query?.probe === "create" && url && service) {
    const h = { apikey: service, "Content-Type": "application/json" };
    if (service.startsWith("eyJ")) h.Authorization = `Bearer ${service}`;
    // Same body shape createAuthUser sends, and optionally the same address,
    // so a pass here really does mean the real call would pass.
    const email = String(req.query?.email || "").trim().toLowerCase() ||
      `probe-${Date.now()}@yom-healthcheck.invalid`;
    const name = String(req.query?.name || "Probe User");
    // Run it twice: once as the app sends it (with PostgREST's Prefer header,
    // which sbAdmin adds to every non-GET) and once without. GoTrue is not
    // PostgREST, and that header is the only difference between the call that
    // fails in production and the one that passes here.
    const attempt = async (label, extraHeaders, addr) => {
      const create = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: { ...h, ...extraHeaders },
        body: JSON.stringify({
          email: addr,
          password: `Pb-${Date.now()}-xQ`,
          email_confirm: true,
          user_metadata: { name },
        }),
      });
      const raw = await create.text();
      let id = null;
      try {
        id = JSON.parse(raw)?.id || null;
      } catch {
        /* body was not json */
      }
      if (id) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: h });
      return { status: create.status, created: Boolean(id), body: raw.slice(0, 200) };
    };
    try {
      out.probe = {
        with_prefer: await attempt("prefer", { Prefer: "return=representation" }, `p1-${Date.now()}@yom-healthcheck.invalid`),
        without_prefer: await attempt("plain", {}, `p2-${Date.now()}@yom-healthcheck.invalid`),
      };
    } catch (e) {
      out.probe = { status: 0, body: String(e?.message || e).slice(0, 300) };
    }
  }

  // ?probe=email&email=… reports, read-only, whether an auth user and a profile
  // row already exist for one address and whether they point at the same id.
  // A profile whose email is taken by a different id makes the signup trigger
  // fail with exactly the 500 we are chasing.
  if (req.query?.probe === "email" && url && service) {
    const want = String(req.query?.email || "").trim().toLowerCase();
    const h = { apikey: service };
    if (service.startsWith("eyJ")) h.Authorization = `Bearer ${service}`;
    const report = { email: want };
    try {
      const ur = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers: h });
      const ud = await ur.json().catch(() => null);
      const users = Array.isArray(ud?.users) ? ud.users : [];
      report.total_auth_users = users.length;
      const hit = users.find((u) => String(u.email || "").toLowerCase() === want);
      report.auth_user = hit ? { id: hit.id, created_at: hit.created_at } : null;

      const pr = await fetch(
        `${url}/rest/v1/profiles?email=eq.${encodeURIComponent(want)}&select=id,email,name,created_at`,
        { headers: h }
      );
      const pd = await pr.json().catch(() => null);
      report.profile_rows = Array.isArray(pd) ? pd : pd;
      report.mismatch =
        Array.isArray(pd) && pd.length > 0 && (!hit || pd[0].id !== hit.id);
    } catch (e) {
      report.error = String(e?.message || e).slice(0, 200);
    }
    out.probe = report;
  }

  const healthy =
    out.supabase.url &&
    out.supabase.admin_users?.ok === true &&
    out.supabase.read_profiles?.ok === true;

  json(res, 200, { ok: healthy, checks: out });
}
