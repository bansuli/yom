import { json, preflight, readJson } from "../lib/http.js";
import { assembleAccount, seedFounderIfNeeded } from "../lib/profile.js";
import { signIn, supabaseConfigured } from "../lib/supabase.js";

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
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    json(res, 400, { ok: false, error: "Email and password, please." });
    return;
  }

  const auth = await signIn(email, password);
  if (!auth.ok || !auth.data?.access_token || !auth.data?.user) {
    const msg = String(auth.data?.error_description || auth.data?.msg || auth.data?.message || "");
    json(res, 401, {
      ok: false,
      error: /invalid/i.test(msg) ? "Wrong email or password." : "Could not log in.",
    });
    return;
  }

  await seedFounderIfNeeded(auth.data.user);
  const account = await assembleAccount(auth.data.user);
  json(res, 200, {
    ok: true,
    access_token: auth.data.access_token,
    refresh_token: auth.data.refresh_token,
    ...account,
  });
}
