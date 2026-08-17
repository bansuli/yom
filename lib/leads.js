import { one, rest, sbAdmin } from "./supabase.js";

function cleanEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function autoAllowlist(email, name) {
  const e = cleanEmail(email);
  if (!isEmail(e)) return { ok: false };
  const n = String(name || e.split("@")[0]).slice(0, 80);
  const inserted = await sbAdmin(rest("allowlist", "on_conflict=email"), {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { email: e, name: n },
  });
  return { ok: inserted.ok, email: e, name: n };
}

/**
 * Upsert a lead by email. Always auto-allowlists so they can create a yom account.
 */
export async function upsertLead(input = {}) {
  const email = cleanEmail(input.email);
  if (!isEmail(email)) return { ok: false, error: "need a valid email." };

  const name = String(input.name || email.split("@")[0]).slice(0, 80);
  const row = {
    email,
    name,
    source: input.source ? String(input.source).slice(0, 80) : null,
    campaign: input.campaign ? String(input.campaign).slice(0, 80) : null,
    surface: input.surface ? String(input.surface).slice(0, 32) : null,
    path: input.path ? String(input.path).slice(0, 200) : null,
    anon_id: input.anon_id ? String(input.anon_id).slice(0, 80) : null,
    utm_source: input.utm_source ? String(input.utm_source).slice(0, 80) : null,
    utm_medium: input.utm_medium ? String(input.utm_medium).slice(0, 80) : null,
    utm_campaign: input.utm_campaign ? String(input.utm_campaign).slice(0, 80) : null,
    channel: input.channel ? String(input.channel).slice(0, 40) : null,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    updated_at: new Date().toISOString(),
  };
  if (input.referrer_user_id && /^[0-9a-f-]{36}$/i.test(String(input.referrer_user_id))) {
    row.referrer_user_id = input.referrer_user_id;
  }

  const existing = await sbAdmin(rest("leads", `email=eq.${encodeURIComponent(email)}&select=id,email`));
  const found = one(existing.data);
  let saved;
  if (found?.id) {
    const patch = { ...row };
    delete patch.email;
    const updated = await sbAdmin(rest("leads", `id=eq.${found.id}`), {
      method: "PATCH",
      body: patch,
    });
    saved = one(updated.data) || { id: found.id, email };
  } else {
    const inserted = await sbAdmin(rest("leads"), {
      method: "POST",
      body: row,
    });
    if (!inserted.ok) {
      return { ok: false, error: "could not save lead." };
    }
    saved = one(inserted.data) || { email };
  }

  const allow = await autoAllowlist(email, name);
  return { ok: true, lead: saved, allowlisted: allow.ok };
}

/**
 * Touch a scan visitor by anon_id. Optional email attaches + allowlists.
 */
export async function touchScanVisitor(input = {}) {
  const anon_id = String(input.anon_id || "").slice(0, 80);
  if (!anon_id) return { ok: false, error: "anon_id required" };

  const email = cleanEmail(input.email);
  const hasEmail = isEmail(email);
  const now = new Date().toISOString();
  const base = {
    anon_id,
    source: input.source ? String(input.source).slice(0, 80) : null,
    campaign: input.campaign ? String(input.campaign).slice(0, 80) : null,
    surface: input.surface ? String(input.surface).slice(0, 32) : null,
    path: input.path ? String(input.path).slice(0, 200) : "/scan",
    utm_source: input.utm_source ? String(input.utm_source).slice(0, 80) : null,
    utm_medium: input.utm_medium ? String(input.utm_medium).slice(0, 80) : null,
    utm_campaign: input.utm_campaign ? String(input.utm_campaign).slice(0, 80) : null,
    last_seen_at: now,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  if (hasEmail) base.email = email;
  if (input.referrer_user_id && /^[0-9a-f-]{36}$/i.test(String(input.referrer_user_id))) {
    base.referrer_user_id = input.referrer_user_id;
  }

  const existing = await sbAdmin(
    rest("scan_visitors", `anon_id=eq.${encodeURIComponent(anon_id)}&select=id,checks_count,email`)
  );
  const found = one(existing.data);
  let visitor;
  if (found?.id) {
    const patch = {
      ...base,
      checks_count: Math.max(0, Number(found.checks_count) || 0) + (input.increment_check ? 1 : 0),
    };
    if (!hasEmail) delete patch.email;
    const updated = await sbAdmin(rest("scan_visitors", `id=eq.${found.id}`), {
      method: "PATCH",
      body: patch,
    });
    visitor = one(updated.data) || { id: found.id, anon_id };
  } else {
    const inserted = await sbAdmin(rest("scan_visitors"), {
      method: "POST",
      body: {
        ...base,
        checks_count: input.increment_check ? 1 : 0,
        created_at: now,
      },
    });
    if (!inserted.ok) {
      return { ok: false, error: "could not save scan visitor." };
    }
    visitor = one(inserted.data) || { anon_id };
  }

  let lead = null;
  if (hasEmail) {
    const saved = await upsertLead({
      email,
      name: input.name,
      source: input.source,
      campaign: input.campaign,
      surface: input.surface,
      path: input.path || "/scan",
      anon_id,
      utm_source: input.utm_source,
      utm_medium: input.utm_medium,
      utm_campaign: input.utm_campaign,
      referrer_user_id: input.referrer_user_id,
      channel: input.channel || "scan",
      metadata: input.metadata,
    });
    lead = saved;
  }

  return { ok: true, visitor, lead };
}
