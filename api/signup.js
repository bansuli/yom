import { json, preflight, readJson } from "../lib/http.js";
import { assembleAccount, seedFounderIfNeeded } from "../lib/profile.js";
import { createAuthUser, one, rest, sbAdmin, signIn, supabaseConfigured } from "../lib/supabase.js";

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

  const body = readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0];
  if (!email || !password) {
    json(res, 400, { ok: false, error: "email and password, please." });
    return;
  }
  if (password.length < 6) {
    json(res, 400, { ok: false, error: "password needs at least 6 characters." });
    return;
  }

  const listed = await sbAdmin(rest("allowlist", `email=eq.${email}&select=email,name`));
  if (!one(listed.data)) {
    json(res, 403, { ok: false, error: "that email isn't on the beta list." });
    return;
  }

  const created = await createAuthUser(email, password, name);
  if (!created.ok || !created.data?.id) {
    const msg = String(created.data?.msg || created.data?.message || created.data?.error_description || "");
    json(res, 400, {
      ok: false,
      error: /already|registered|exists/i.test(msg) ? "that email already has an account. log in." : "could not create the account.",
    });
    return;
  }

  await seedFounderIfNeeded(created.data);
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
