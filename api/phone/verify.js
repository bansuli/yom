import { json, preflight, readJson } from "../../lib/http.js";
import { assembleAccount, ingestOnboarding, seedFounderIfNeeded } from "../../lib/profile.js";
import { normalisePhone, supabaseConfigured, verifyPhoneOtp } from "../../lib/supabase.js";

/**
 * POST /api/phone/verify
 * Body: { phone, code, ...onboarding }
 *
 * Trades the six-digit code for a yom session. Supabase has already created
 * the auth user by this point if the number was new, so the work left here is
 * the same as after an email signup: make sure a profile row exists and fold
 * in whatever the onboarding collected.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "sign-in is not configured yet." });
    return;
  }

  const body = readJson(req);
  const phone = normalisePhone(body.phone);
  const code = String(body.code || "").replace(/\D/g, "");
  if (!phone || !code) {
    json(res, 400, { ok: false, error: "number and code, please." });
    return;
  }

  const auth = await verifyPhoneOtp(phone, code);
  if (!auth.ok || !auth.data?.access_token || !auth.data?.user) {
    const msg = String(auth.data?.msg || auth.data?.message || auth.data?.error_description || "");
    json(res, 401, {
      ok: false,
      error: /expired/i.test(msg)
        ? "that code has expired — send a new one."
        : "that code isn't right.",
    });
    return;
  }

  const user = auth.data.user;
  const fresh = !user.last_sign_in_at || user.created_at === user.last_sign_in_at;

  try {
    await seedFounderIfNeeded(user);
    await ingestOnboarding(user, { ...body, first_surface: body.first_surface || "phone" });
    const account = await assembleAccount(user);
    json(res, 200, {
      ok: true,
      created: fresh,
      access_token: auth.data.access_token,
      refresh_token: auth.data.refresh_token,
      ...account,
    });
  } catch (e) {
    console.warn("phone verify", e?.message || e);
    json(res, 500, { ok: false, error: "signed in, but couldn't load your yom. try again." });
  }
}
