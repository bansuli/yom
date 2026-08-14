import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { insertOutcome } from "../lib/store.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

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
  const name = String(body.name || body.item || "").trim();
  if (!name) {
    json(res, 400, { ok: false, error: "need a name." });
    return;
  }

  const href = String(body.href || "").trim();
  const userId = account.user.id;
  const already = (account.profile.saved || []).some(
    (item) => (href && item.href === href) || (!href && item.name === name)
  );
  if (already) {
    json(res, 200, { ok: true, saved: account.profile.saved, duplicate: true });
    return;
  }

  const inserted = await sbAdmin(rest("saved_items"), {
    method: "POST",
    body: {
      user_id: userId,
      name,
      href: href || null,
      price: body.price == null || body.price === "" ? null : Number(body.price),
      note: body.note || "",
      site: body.site || "",
    },
  });
  if (!inserted.ok) {
    json(res, 500, { ok: false, error: "could not save." });
    return;
  }

  await insertOutcome(userId, {
    action: "save",
    product_key: href || name,
    name,
    href,
    site: body.site || "",
    price: body.price,
    kind: body.kind || "",
    color: body.color || "",
    brand: body.brand || "",
  });

  const fresh = await accountFromToken(token);
  json(res, 200, { ok: true, saved: fresh?.profile?.saved || [] });
}