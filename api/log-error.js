import { json, preflight, readJson } from "../lib/http.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

/**
 * Failures reported by the app itself. Public by necessity — the phone that
 * just failed is the only thing that knows — so everything is clamped and
 * nothing here is trusted enough to be shown as anything but text.
 */

function text(v, max = 400) {
  return String(v || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST" });
    return;
  }
  // Never let reporting a failure become a second failure the user can see.
  if (!supabaseConfigured()) {
    json(res, 200, { ok: true, skipped: true });
    return;
  }

  // Belt and braces: a client that has not picked up the scrubbing yet must not
  // be able to write an account key into a line /admin displays.
  const scrub = (value) => String(value || "").replace(/\b(key|token|secret|access_token)=[^&\s]+/gi, "$1=…");

  const body = readJson(req);
  const kind = ["scan_failed", "api_error", "js_error"].includes(body.kind) ? body.kind : "js_error";
  const status = Number(body.status);

  await sbAdmin(rest("app_errors"), {
    method: "POST",
    body: {
      kind,
      message: scrub(text(body.message, 400)),
      status: Number.isFinite(status) && status > 0 ? Math.trunc(status) : null,
      path: scrub(text(body.path, 200)),
      surface: text(body.surface, 32),
      anon_id: text(body.anon_id, 80),
      email: text(body.email, 180).toLowerCase() || null,
      account_key: text(body.account_key, 80) || null,
      detail: body.detail && typeof body.detail === "object" ? body.detail : {},
      user_agent: text(req.headers["user-agent"], 300),
    },
  });

  json(res, 200, { ok: true });
}
