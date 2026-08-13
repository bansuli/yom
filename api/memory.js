import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken, sizeMap } from "../lib/profile.js";
import { one, rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

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

  const token = bearer(req);
  const account = token ? await accountFromToken(token) : null;
  if (!account) {
    json(res, 401, { ok: false, error: "not signed in." });
    return;
  }

  const body = readJson(req);
  const note = String(body.note || "").trim();
  const brand = String(body.brand || "").trim();
  const size = String(body.size || "").trim();
  const incoming = body.sizes && typeof body.sizes === "object" ? body.sizes : {};

  const rows = await sbAdmin(rest("profiles", `id=eq.${account.user.id}&select=memory,sizes`));
  const current = one(rows.data);
  const sizes = { ...sizeMap(current?.sizes || account.profile?.sizes || {}), ...incoming };
  if (brand && size) {
    sizes.brands = { ...(sizes.brands || {}), [brand]: size };
  }
  const memory = [current?.memory || account.profile?.memory || "", note].filter(Boolean).join(" ").trim();

  const patched = await sbAdmin(rest("profiles", `id=eq.${account.user.id}`), {
    method: "PATCH",
    body: {
      memory: memory || null,
      sizes,
    },
  });
  if (!patched.ok) {
    json(res, 500, { ok: false, error: "could not store that." });
    return;
  }

  const fresh = await accountFromToken(token);
  json(res, 200, { ok: true, profile: fresh?.profile || account.profile });
}
