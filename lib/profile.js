import { defaultAvatarColor } from "./avatar.js";
import { founderSeed, sizesPayload } from "./founders.js";
import { insertClosetItems, insertOutcome } from "./store.js";
import { getAuthUser, one, rest, sbAdmin } from "./supabase.js";

function sizeLineFrom(sizes = {}) {
  return [sizes.us && `usual size ${sizes.us}`, sizes.denim && `denim ${sizes.denim}`, sizes.shoes && `shoes ${sizes.shoes}`]
    .filter(Boolean)
    .join(", ");
}

function closetBits(item) {
  const bits = [
    item.brand,
    item.kind,
    item.size,
    item.color,
    item.kept === false ? `returned${item.return_reason ? ` · ${item.return_reason}` : ""}` : item.note || "kept",
  ].filter(Boolean);
  return `${item.purchased_at || ""} ${item.item} (${bits.join(", ")})`.trim();
}

function outcomeBits(row) {
  const name = row.name || row.product_key || "a piece";
  if (row.action === "skip") return `skipped ${name}`;
  if (row.action === "save") return `saved ${name}`;
  if (row.action === "buy") return `bought ${name}`;
  if (row.action === "returned") return `returned ${name}${row.reason ? ` · ${row.reason}` : ""}`;
  if (row.action === "kept") return `kept ${name}`;
  if (row.action === "never_wear") return `never wore ${name}`;
  return `${row.action} ${name}`;
}

export function compileMemory(profile, closet = [], saved = [], outcomes = []) {
  const mapped = sizeMap(profile?.sizes || {});
  const sizeLine = [
    sizeLineFrom(mapped),
    mapped.brands &&
      Object.entries(mapped.brands)
        .map(([brand, size]) => `${brand} ${size}`)
        .join(", "),
  ]
    .filter(Boolean)
    .join("; ");
  const closetLine = closet.map(closetBits).filter(Boolean).join("; ");
  const savedLine = saved.map((item) => item.name).filter(Boolean).join(", ");
  const outcomeLine = outcomes.slice(0, 8).map(outcomeBits).filter(Boolean).join("; ");
  const fromRows = [
    profile?.name && `this is ${profile.name}.`,
    sizeLine && `sizes: ${sizeLine}.`,
    profile?.yom_read || profile?.read,
    closetLine && `closet: ${closetLine}.`,
    savedLine && `saved: ${savedLine}.`,
    outcomeLine && `recent: ${outcomeLine}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const constraints = String(profile?.memory || "")
    .split(/(?<=\.)\s*/)
    .filter((line) => /^do not /i.test(line.trim()))
    .join(" ");

  if (closet.length || saved.length || outcomes.length) {
    return [fromRows, constraints].filter(Boolean).join(" ");
  }
  if (profile?.memory) return profile.memory;
  return [fromRows, constraints].filter(Boolean).join(" ");
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

export function shapeAccount(user, profile, closet = [], saved = [], events = [], outcomes = []) {
  const sizes = profile?.sizes || {};
  const purchases = closet.map((item) => ({
    when: item.purchased_at || "",
    item: item.item,
    note: item.note || "",
    kept: item.kept !== false,
    href: item.href || "",
    site: item.site || "",
    brand: item.brand || "",
    kind: item.kind || "",
    color: item.color || "",
    size: item.size || "",
    fit: item.fit || "",
    price: item.price || 0,
    return_reason: item.return_reason || "",
    image_url: item.image_url || "",
    source: item.source || "",
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
  const outcomeList = outcomes.map((row) => ({
    id: row.id,
    action: row.action,
    name: row.name || "",
    product_key: row.product_key,
    reason: row.reason || "",
    site: row.site || "",
    at: row.created_at,
  }));
  const compiled = compileMemory(profile, closet, saved, outcomes);
  return {
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.user_metadata?.name || String(user.email || "").split("@")[0],
      avatarColor: profile?.avatar_color || defaultAvatarColor(user.id),
    },
    profile: {
      id: user.id,
      userId: user.id,
      email: user.email,
      name: profile?.name || String(user.email || "").split("@")[0],
      avatarColor: profile?.avatar_color || defaultAvatarColor(user.id),
      phone: profile?.phone || "",
      provider: profile?.auth_provider || "",
      from: profile?.source_note || "member from apr 2026",
      headline: profile?.headline || "",
      read: profile?.yom_read || "",
      trait: profile?.trait || "",
      preBuy: profile?.pre_buy || "",
      keepLean: profile?.keep_lean || "",
      memory: compiled,
      acquisition_source: profile?.acquisition_source || "",
      acquisition_campaign: profile?.acquisition_campaign || "",
      activation_date: profile?.activation_date || "",
      referrer_user_id: profile?.referrer_user_id || null,
      first_surface: profile?.first_surface || "",
      onboarding_version: profile?.onboarding_version || "",
      sizes: sizeList(sizes),
      sizeMap: sizeMap(sizes),
      tags: Array.isArray(profile?.tags) ? profile.tags : [],
      style: Array.isArray(profile?.style) ? profile.style : [],
      purchases,
      saved: savedList,
      outcomes: outcomeList,
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
  const [profileRes, closetRes, savedRes, eventsRes, outcomesRes] = await Promise.all([
    sbAdmin(rest("profiles", `id=eq.${userId}&select=*`)),
    sbAdmin(rest("closet_items", `user_id=eq.${userId}&select=*&order=created_at.asc`)),
    sbAdmin(rest("saved_items", `user_id=eq.${userId}&select=*&order=created_at.desc`)),
    sbAdmin(rest("events", `user_id=eq.${userId}&select=*&order=created_at.asc`)),
    sbAdmin(rest("outcomes", `user_id=eq.${userId}&select=*&order=created_at.desc&limit=20`)),
  ]);
  return {
    profile: one(profileRes.data),
    closet: Array.isArray(closetRes.data) ? closetRes.data : [],
    saved: Array.isArray(savedRes.data) ? savedRes.data : [],
    events: Array.isArray(eventsRes.data) ? eventsRes.data : [],
    outcomes: Array.isArray(outcomesRes.data) ? outcomesRes.data : [],
  };
}

/** What to call someone who signed up with a number and nothing else. */
function fallbackName(user) {
  const fromMeta = String(user.user_metadata?.name || "").trim();
  if (fromMeta) return fromMeta.slice(0, 80);
  const email = String(user.email || "").trim();
  if (email) return email.split("@")[0];
  const phone = String(user.phone || "").replace(/\D/g, "");
  // The last four digits are enough to recognise your own account without
  // printing the whole number back at you.
  return phone ? `you (···${phone.slice(-4)})` : "you";
}

export async function ensureProfile(user) {
  const rows = await loadRows(user.id);
  if (rows.profile) return rows;
  const email = String(user.email || "").trim().toLowerCase() || null;
  const phone = String(user.phone || "").trim() || null;
  await sbAdmin(rest("profiles"), {
    method: "POST",
    body: {
      id: user.id,
      // A phone-only account has no address; the column is nullable and the
      // table's check constraint requires one of the two.
      email,
      phone: phone ? (phone.startsWith("+") ? phone : `+${phone}`) : null,
      name: fallbackName(user),
      avatar_color: defaultAvatarColor(user.id),
    },
  });
  return loadRows(user.id);
}

export async function assembleAccount(user) {
  const rows = await ensureProfile(user);
  return shapeAccount(user, rows.profile, rows.closet, rows.saved, rows.events, rows.outcomes);
}

export async function ingestOnboarding(user, body = {}) {
  // The row comes first, always. Closet items, google accounts and everything
  // else key off profiles.id, so skipping this leaves a foreign key with
  // nothing to point at — which is exactly how a founder signing in with
  // Google ended up unable to sign in at all.
  const rows = await ensureProfile(user);
  // A founder's profile is curated; onboarding answers must not overwrite it.
  if (founderSeed(user.email)) return;
  const patch = {};
  if (body.name) patch.name = String(body.name).slice(0, 80);
  if (body.auth_provider) patch.auth_provider = String(body.auth_provider).slice(0, 20);
  if (body.trait) patch.trait = String(body.trait).slice(0, 40);
  if (body.preBuy || body.pre_buy) patch.pre_buy = String(body.preBuy || body.pre_buy).slice(0, 40);
  if (body.keepLean || body.keep_lean) patch.keep_lean = String(body.keepLean || body.keep_lean).slice(0, 40);
  if (body.read || body.yom_read) patch.yom_read = String(body.read || body.yom_read).slice(0, 800);
  if (body.headline) patch.headline = String(body.headline).slice(0, 160);
  if (body.acquisition_source || body.source) {
    patch.acquisition_source = String(body.acquisition_source || body.source).slice(0, 80);
  }
  if (body.acquisition_campaign || body.campaign) {
    patch.acquisition_campaign = String(body.acquisition_campaign || body.campaign).slice(0, 80);
  }
  if (body.activation_date) patch.activation_date = String(body.activation_date).slice(0, 32);
  if (body.utm_source) patch.utm_source = String(body.utm_source).slice(0, 80);
  if (body.utm_medium) patch.utm_medium = String(body.utm_medium).slice(0, 80);
  if (body.utm_campaign) patch.utm_campaign = String(body.utm_campaign).slice(0, 80);
  if (body.first_surface) patch.first_surface = String(body.first_surface).slice(0, 32);
  if (body.onboarding_version) patch.onboarding_version = String(body.onboarding_version).slice(0, 64);
  if (body.referrer_user_id) {
    const ref = String(body.referrer_user_id).trim();
    if (/^[0-9a-f-]{36}$/i.test(ref)) patch.referrer_user_id = ref;
  }
  if (Object.keys(patch).length) {
    await sbAdmin(rest("profiles", `id=eq.${user.id}`), { method: "PATCH", body: patch });
  }
  const closet = Array.isArray(body.closet) ? body.closet : [];
  if (closet.length && !rows.closet.length) {
    await insertClosetItems(user.id, closet);
    for (const item of closet) {
      const action = item.kept === false ? "returned" : "kept";
      await insertOutcome(user.id, {
        action,
        product_key: item.href || item.item || item.name,
        name: item.item || item.name,
        href: item.href,
        reason: item.return_reason || item.note || "",
        site: item.site,
        brand: item.brand,
        kind: item.kind,
        color: item.color,
      });
    }
  }
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
    await insertClosetItems(
      user.id,
      seed.purchases.map((row) => ({
        ...row,
        kept: row.kept !== false,
      }))
    );
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
