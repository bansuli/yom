import { rest, sbAdmin } from "./supabase.js";

const ACTIONS = new Set(["buy", "save", "skip", "kept", "returned", "never_wear"]);

export function productKey(body = {}) {
  return String(body.product_key || body.href || body.id || body.name || "").trim();
}

export function brandFromHost(host = "") {
  const h = String(host)
    .replace(/^www\./i, "")
    .split(".")[0];
  if (!h) return "";
  if (/thereformation|reformation/i.test(host)) return "Reformation";
  return h.charAt(0).toUpperCase() + h.slice(1);
}

export function closetRow(userId, item = {}) {
  const name = String(item.item || item.name || "").trim();
  if (!name) return null;
  const kept = item.kept !== false && item.action !== "returned";
  const price = item.price == null || item.price === "" ? null : Number(item.price);
  return {
    user_id: userId,
    item: name.slice(0, 180),
    note: item.note ? String(item.note).slice(0, 280) : "",
    kept,
    purchased_at: item.purchased_at || item.when || "",
    href: item.href || null,
    site: item.site || "",
    brand: item.brand || brandFromHost(item.site || ""),
    kind: item.kind || "",
    color: item.color || "",
    price: Number.isFinite(price) ? price : null,
    return_reason: item.return_reason || (item.action === "returned" ? item.reason || "" : ""),
    image_url: item.image_url || "",
  };
}

export async function insertClosetItems(userId, items = []) {
  const rows = items.map((item) => closetRow(userId, item)).filter(Boolean);
  if (!rows.length) return { ok: true, inserted: 0 };
  const res = await sbAdmin(rest("closet_items"), { method: "POST", body: rows });
  return { ok: res.ok, inserted: rows.length, data: res.data, error: res.data };
}

export async function insertTake(userId, body = {}) {
  const key = productKey(body);
  if (!key) return { ok: false, error: "need a product." };
  const regret = Number(body.regret);
  const res = await sbAdmin(rest("takes"), {
    method: "POST",
    body: {
      user_id: userId,
      product_key: key.slice(0, 500),
      site: body.site || "",
      surface: body.surface || "",
      stamp: body.stamp ? String(body.stamp).slice(0, 40) : null,
      kind: body.kind || "",
      title: body.title ? String(body.title).slice(0, 120) : "",
      regret: Number.isFinite(regret) ? Math.max(0, Math.min(100, Math.round(regret))) : null,
      mode: body.mode || "",
      purpose: body.purpose || "",
    },
  });
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  return { ok: res.ok, take: row || null, error: res.ok ? null : "could not store take." };
}

export async function insertOutcome(userId, body = {}) {
  const action = String(body.action || "").trim();
  if (!ACTIONS.has(action)) return { ok: false, error: "unknown action." };
  const key = productKey(body);
  if (!key) return { ok: false, error: "need a product." };
  const name = String(body.name || body.item || "").trim();
  const price = body.price == null || body.price === "" ? null : Number(body.price);
  const res = await sbAdmin(rest("outcomes"), {
    method: "POST",
    body: {
      user_id: userId,
      product_key: key.slice(0, 500),
      take_id: body.take_id || null,
      action,
      reason: body.reason ? String(body.reason).slice(0, 280) : "",
      name: name.slice(0, 180),
      href: body.href || null,
      site: body.site || "",
      brand: body.brand || brandFromHost(body.site || ""),
      kind: body.kind || "",
      color: body.color || "",
      price: Number.isFinite(price) ? price : null,
    },
  });
  if (!res.ok) return { ok: false, error: "could not store outcome." };

  if (action === "buy" && name) {
    await insertClosetItems(userId, [
      {
        ...body,
        item: name,
        kept: true,
        note: body.note || "added to bag",
      },
    ]);
  }

  if (action === "returned" || action === "kept") {
    const href = String(body.href || "").trim();
    const filter = href
      ? `user_id=eq.${userId}&href=eq.${encodeURIComponent(href)}`
      : `user_id=eq.${userId}&item=eq.${encodeURIComponent(name)}`;
    await sbAdmin(rest("closet_items", filter), {
      method: "PATCH",
      body: {
        kept: action === "kept",
        return_reason: action === "returned" ? body.reason || body.return_reason || "" : "",
      },
    });
  }

  return { ok: true };
}
