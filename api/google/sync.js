import { bearer, json, preflight, readJson } from "../../lib/http.js";
import { googleConfigured } from "../../lib/google.js";
import {
  getGoogleAccount,
  publicGoogleStatus,
  syncCalendar,
  syncGmail,
} from "../../lib/google-store.js";
import { accountFromToken } from "../../lib/profile.js";
import { supabaseConfigured } from "../../lib/supabase.js";

/**
 * POST /api/google/sync
 * Body: { calendar?: true, gmail?: true }  (default both true)
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured() || !googleConfigured()) {
    json(res, 503, { ok: false, error: "google sync is not configured" });
    return;
  }

  const token = bearer(req);
  if (!token) {
    json(res, 401, { ok: false, error: "not signed in." });
    return;
  }
  const account = await accountFromToken(token);
  if (!account?.profile?.id) {
    json(res, 401, { ok: false, error: "session expired." });
    return;
  }

  const g = await getGoogleAccount(account.profile.id);
  if (!g?.refresh_token && !g?.access_token) {
    json(res, 400, { ok: false, error: "connect google first." });
    return;
  }

  const body = readJson(req);
  const doCal = body.calendar !== false;
  const doMail = body.gmail !== false;
  const result = { ok: true, calendar: null, gmail: null };

  try {
    if (doCal) result.calendar = await syncCalendar(account.profile.id, g);
  } catch (e) {
    result.calendar = { error: e?.message || "calendar sync failed" };
  }

  const fresh = (await getGoogleAccount(account.profile.id)) || g;
  try {
    if (doMail) result.gmail = await syncGmail(account.profile.id, fresh);
  } catch (e) {
    result.gmail = { error: e?.message || "gmail sync failed" };
  }

  const status = publicGoogleStatus(await getGoogleAccount(account.profile.id));
  json(res, 200, { ...result, ...status });
}
