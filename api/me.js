import { bearer, json, preflight } from "../lib/http.js";
import { googleConfigured } from "../lib/google.js";
import { loadStylistContext } from "../lib/google-context.js";
import { accountFromToken } from "../lib/profile.js";
import { supabaseConfigured } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "GET") {
    json(res, 405, { ok: false, error: "GET only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "Sign-in is not configured yet." });
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

  const google = { googleOAuthReady: googleConfigured(), connected: false, events: [], gmail: [] };
  try {
    const ctx = await loadStylistContext(account.user.id, { refresh: false });
    google.connected = Boolean(ctx.connected);
    google.email = ctx.email || null;
    google.calendar_synced_at = ctx.calendar_synced_at || null;
    google.gmail_synced_at = ctx.gmail_synced_at || null;
    google.events = ctx.events || [];
    google.gmail = ctx.gmail || [];
  } catch (e) {
    console.warn("me google", e?.message || e);
  }

  json(res, 200, { ok: true, ...account, google });
}
