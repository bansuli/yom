import { founderSeed, sizesPayload } from "./founders.js";
import { getAuthUser, one, rest, sbAdmin } from "./supabase.js";

export function compileMemory(profile, closet = [], saved = []) {
  if (profile?.memory) return profile.memory;
  const sizes = profile?.sizes || {};
  const sizeLine = [sizes.us && `usual size ${sizes.us}`, sizes.denim && `denim ${sizes.denim}`, sizes.shoes && `shoes ${sizes.shoes}`]
    .filter(Boolean)
    .join(", ");
  const closetLine = closet
    .map((item) => `${item.purchased_at || ""} ${item.item} (${item.note || (item.kept ? "kept" : "")})`.trim())
    .filter(Boolean)
    .join("; ");
  const savedLine = saved.map((item) => item.name).filter(Boolean).join(", ");
  return [
    profile?.name && `this is ${profile.name}.`,
    sizeLine && `sizes: ${sizeLine}.`,
    profile?.yom_read || profile?.read,
    closetLine && `closet: ${closetLine}.`,
    savedLine && `saved: ${savedLine}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function sizeList(sizes) {
  if (Array.isArray(sizes)) return sizes;
  if (sizes?.display) return sizes.display;
  return [
    sizes?.us && { label: "dresses / tops", value: sizes.us },
    sizes?.denim && { label: "denim", value: sizes.denim },
    sizes?.shoes && { label: "shoes", value: sizes.shoes },
  ].filter(Boolean);
}

export function sizeMap(sizes) {
  if (!sizes) return {};
  if (!Array.isArray(sizes) && !sizes.display) return sizes;
  const map = { ...(sizes.us || sizes.denim || sizes.shoes ? sizes : {}) };
  for (const row of sizeList(sizes)) {
    const label = String(row.label || "");
    if (/dress|top|usual/i.test(label)) map.us = row.value;
    else if (/denim/i.test(label)) map.denim = row.value;
    else if (/shoe/i.test(label)) map.shoes = row.value;
  }
  return map;
}

export function shapeAccount(user, profile, closet = [], saved = [], events = []) {
  const sizes = profile?.sizes || {};
  const purchases = closet.map((item) => ({
    when: item.purchased_at || "",
    item: item.item,
    note: item.note || "",
    kept: item.kept !== false,
  }));
  const savedList = saved.map((item) => ({
    id: item.id,
    item: item.name,
    name: item.name,
    note: item.note || "",
    href: item.href || "",
    price: item.price || 0,
    site: item.site || "",
    at: item.created_at,
  }));
  const compiled = compileMemory(profile, closet, saved);
  return {
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.user_metadata?.name || String(user.email || "").split("@")[0],
    },
    profile: {
      id: user.id,
      userId: user.id,
      email: user.email,
      name: profile?.name || String(user.email || "").split("@")[0],
      from: profile?.source_note || "member from apr 2026",
      headline: profile?.headline || "",
      read: profile?.yom_read || "",
      trait: profile?.trait || "",
      preBuy: profile?.pre_buy || "",
      keepLean: profile?.keep_lean || "",
      memory: compiled,
      sizes: sizeList(sizes),
      sizeMap: sizeMap(sizes),
      style: Array.isArray(profile?.style) ? profile.style : [],
      purchases,
      saved: savedList,
      events: events.map((event) => ({
        id: event.id,
        label: event.label,
        when: event.when_text || "",
        kind: event.kind || "",
      })),
    },
  };
}

export async function loadRows(userId) {
  const [profileRes, closetRes, savedRes, eventsRes] = await Promise.all([
    sbAdmin(rest("profiles", `id=eq.${userId}&select=*`)),
    sbAdmin(rest("closet_items", `user_id=eq.${userId}&select=*&order=created_at.asc`)),
    sbAdmin(rest("saved_items", `user_id=eq.${userId}&select=*&order=created_at.desc`)),
    sbAdmin(rest("events", `user_id=eq.${userId}&select=*&order=created_at.asc`)),
  ]);
  return {
    profile: one(profileRes.data),
    closet: Array.isArray(closetRes.data) ? closetRes.data : [],
    saved: Array.isArray(savedRes.data) ? savedRes.data : [],
    events: Array.isArray(eventsRes.data) ? eventsRes.data : [],
  };
}

export async function ensureProfile(user) {
  const rows = await loadRows(user.id);
  if (rows.profile) return rows;
  await sbAdmin(rest("profiles"), {
    method: "POST",
    body: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || String(user.email || "").split("@")[0],
    },
  });
  return loadRows(user.id);
}

export async function assembleAccount(user) {
  const rows = await ensureProfile(user);
  return shapeAccount(user, rows.profile, rows.closet, rows.saved, rows.events);
}

export async function seedFounderIfNeeded(user) {
  const seed = founderSeed(user.email);
  if (!seed) return;
  await ensureProfile(user);
  const rows = await loadRows(user.id);
  await sbAdmin(rest("profiles", `id=eq.${user.id}`), {
    method: "PATCH",
    body: {
      name: seed.name,
      trait: seed.trait || null,
      pre_buy: seed.preBuy || null,
      keep_lean: seed.keepLean || null,
      yom_read: seed.read || null,
      headline: seed.headline || null,
      memory: seed.memory || null,
      sizes: sizesPayload(seed),
      style: seed.style || [],
      source_note: seed.from || "member from apr 2026",
    },
  });
  if (!rows.closet.length && seed.purchases?.length) {
    await sbAdmin(rest("closet_items"), {
      method: "POST",
      body: seed.purchases.map((row) => ({
        user_id: user.id,
        purchased_at: row.when,
        item: row.item,
        note: row.note || "",
        kept: true,
      })),
    });
  }
  if (!rows.saved.length && seed.saved?.length) {
    await sbAdmin(rest("saved_items"), {
      method: "POST",
      body: seed.saved.map((row) => ({
        user_id: user.id,
        name: row.item,
        note: row.note || "",
      })),
    });
  }
}

export async function accountFromToken(accessToken) {
  const auth = await getAuthUser(accessToken);
  if (!auth.ok || !auth.data?.id) return null;
  return assembleAccount(auth.data);
}
