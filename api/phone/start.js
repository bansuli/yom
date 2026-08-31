import { json, preflight, readJson } from "../../lib/http.js";
import { normalisePhone, sendPhoneOtp, supabaseConfigured } from "../../lib/supabase.js";

/**
 * POST /api/phone/start
 * Body: { phone } — E.164, country code included.
 *
 * Sends the six-digit code and says nothing about whether the number already
 * has an account. Answering that would turn this into a way to check which
 * numbers are registered.
 */
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

  const body = readJson(req);
  const phone = normalisePhone(body.phone);
  if (!phone) {
    json(res, 400, { ok: false, error: "That number doesn't look right — include the country code." });
    return;
  }

  const sent = await sendPhoneOtp(phone);
  if (!sent.ok) {
    const msg = String(sent.data?.msg || sent.data?.message || sent.data?.error_description || "");
    // Supabase says "Unsupported phone provider" until an SMS provider is set
    // up in the dashboard. Worth naming, because nothing else explains it.
    if (/provider/i.test(msg)) {
      console.warn("phone start: no SMS provider configured", msg);
      json(res, 503, { ok: false, error: "Text sign-in isn't switched on yet." });
      return;
    }
    if (/rate|limit|too many/i.test(msg)) {
      json(res, 429, { ok: false, error: "Too many codes just now — wait a minute and try again." });
      return;
    }
    console.warn("phone start", sent.status, msg);
    json(res, 400, { ok: false, error: "Couldn't send the code. Check the number and try again." });
    return;
  }

  json(res, 200, { ok: true, sent: true });
}
