import { json, preflight, readJson } from "../lib/http.js";
import { assembleAccount, ingestOnboarding, seedFounderIfNeeded } from "../lib/profile.js";
import { createAuthUser, signIn, supabaseConfigured } from "../lib/supabase.js";

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
  const name = String(body.name || "").trim() || email.split("@")[0];
  if (!email || !password) {
    json(res, 400, { ok: false, error: "Email and password, please." });
    return;
  }
  if (password.length < 6) {
    json(res, 400, { ok: false, error: "Password needs at least 6 characters." });
    return;
  }

  const created = await createAuthUser(email, password, name);
  if (!created.ok || !created.data?.id) {
    const msg = String(created.data?.msg || created.data?.message || created.data?.error_description || "");
    json(res, 400, {
      ok: false,
      error: /already|registered|exists/i.test(msg) ? "That email already has an account. Log in." : "Could not create the account.",
    });
    return;
  }

  await seedFounderIfNeeded(created.data);
  await ingestOnboarding(created.data, body);
  const auth = await signIn(email, password);
  if (!auth.ok || !auth.data?.access_token) {
    json(res, 201, { ok: true, created: true });
    return;
  }

  const account = await assembleAccount(auth.data.user);
  json(res, 200, {
    ok: true,
    access_token: auth.data.access_token,
    refresh_token: auth.data.refresh_token,
    ...account,
  });
}
