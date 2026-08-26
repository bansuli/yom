import { sheetAppendLead, sheetAppendLeads, sheetAppendScanVisitor, sheetConfigured } from "./sheet-store.js";
import { logServerError } from "./server-errors.js";
import { one, rest, sbAdmin, supabaseConfigured } from "./supabase.js";

function cleanEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function storeConfigured() {
  return supabaseConfigured() || sheetConfigured();
}

export async function autoAllowlist(email, name) {
  if (!supabaseConfigured()) return { ok: false, skipped: true };
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

function leadRow(input = {}) {
  const email = cleanEmail(input.email);
  const name = String(input.name || email.split("@")[0]).slice(0, 80);
  return {
    at: input.queued_at ? new Date(input.queued_at).toISOString() : new Date().toISOString(),
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
    referrer_user_id: input.referrer_user_id || null,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}

/**
 * Upsert a lead by email. Writes Google Sheet and/or Supabase.
 */
export async function upsertLead(input = {}, opts = {}) {
  const email = cleanEmail(input.email);
  if (!isEmail(email)) return { ok: false, error: "need a valid email." };
  if (!storeConfigured()) return { ok: false, error: "user store is not configured" };

  const row = leadRow(input);
  const name = row.name;

  let sheetOk = false;
  if (sheetConfigured() && !opts.skipSheet) {
    const sheet = await sheetAppendLead(row);
    sheetOk = Boolean(sheet.ok);
  }

  let saved = { email, name };
  let allowlisted = false;

  if (supabaseConfigured()) {
    const dbRow = {
      email,
      name,
      source: row.source,
      campaign: row.campaign,
      surface: row.surface,
      path: row.path,
      anon_id: row.anon_id,
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      channel: row.channel,
      metadata: row.metadata,
      updated_at: new Date().toISOString(),
    };
    if (row.referrer_user_id && /^[0-9a-f-]{36}$/i.test(String(row.referrer_user_id))) {
      dbRow.referrer_user_id = row.referrer_user_id;
    }

    const existing = await sbAdmin(rest("leads", `email=eq.${encodeURIComponent(email)}&select=id,email`));
    const found = one(existing.data);
    if (found?.id) {
      const patch = { ...dbRow };
      delete patch.email;
      const updated = await sbAdmin(rest("leads", `id=eq.${found.id}`), {
        method: "PATCH",
        body: patch,
      });
      if (!updated.ok) {
        await logServerError({
          kind: "lead_not_saved",
          message: `Could not update lead — ${updated.data?.message || "database rejected it"}`,
          status: updated.status,
          path: "/api/leads",
          email,
          detail: { sheet_ok: sheetOk, mode: "update" },
        });
      }
      saved = one(updated.data) || { id: found.id, email };
    } else {
      // Upsert rather than insert: two requests for the same email can land at
      // once — she taps join twice, or a queued lead flushes while she is still
      // on the page — and the loser used to be reported as a lost lead when the
      // row was in fact already there.
      const inserted = await sbAdmin(rest("leads", "on_conflict=email"), {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: dbRow,
      });
      if (inserted.ok) {
        saved = one(inserted.data) || { email };
      } else {
        // A sheet write that worked used to hide a database write that did not,
        // so an email could land in the spreadsheet and nowhere else with the
        // request reporting success. Say so, whatever the sheet did.
        await logServerError({
          kind: "lead_not_saved",
          message: `Could not save lead — ${inserted.data?.message || "database rejected it"}`,
          status: inserted.status,
          path: "/api/leads",
          email,
          detail: { sheet_ok: sheetOk, mode: "insert" },
        });
        if (!sheetOk) return { ok: false, error: "could not save lead." };
      }
    }
    const allow = await autoAllowlist(email, name);
    allowlisted = Boolean(allow.ok);
  }

  if (!sheetOk && !supabaseConfigured()) {
    if (opts.skipSheet && sheetConfigured()) {
      return { ok: true, lead: saved, allowlisted: false, sheet: false, row };
    }
    return { ok: false, error: "could not save lead to sheet." };
  }

  return { ok: true, lead: saved, allowlisted, sheet: sheetOk, row };
}

/** Batch upsert. One sheet write for the whole batch. */
export async function upsertLeads(inputs = []) {
  const list = (Array.isArray(inputs) ? inputs : []).filter((item) => isEmail(cleanEmail(item?.email)));
  if (!list.length) return { ok: false, error: "need a valid email." };

  const results = [];
  for (const input of list) {
    results.push(await upsertLead(input, { skipSheet: true }));
  }
  const ok = results.some((r) => r.ok);
  const rows = results.filter((r) => r.ok && r.row).map((r) => r.row);

  let sheetOk = false;
  if (sheetConfigured() && rows.length) {
    const sheet = await sheetAppendLeads(rows);
    sheetOk = Boolean(sheet.ok);
  }

  if (!ok && !sheetOk) {
    return { ok: false, error: results.find((r) => r.error)?.error || "could not save." };
  }

  const last = results.filter((r) => r.ok).at(-1) || results[0];
  return {
    ok: true,
    lead: last?.lead,
    allowlisted: Boolean(last?.allowlisted),
    sheet: sheetOk,
    count: rows.length,
  };
}

/**
 * Touch a scan visitor by anon_id. Optional email attaches + allowlists.
 */
export async function touchScanVisitor(input = {}) {
  const anon_id = String(input.anon_id || "").slice(0, 80);
  if (!anon_id) return { ok: false, error: "anon_id required" };
  if (!storeConfigured()) return { ok: false, error: "user store is not configured" };

  const email = cleanEmail(input.email);
  const hasEmail = isEmail(email);
  const now = new Date().toISOString();
  const base = {
    at: now,
    anon_id,
    source: input.source ? String(input.source).slice(0, 80) : null,
    campaign: input.campaign ? String(input.campaign).slice(0, 80) : null,
    surface: input.surface ? String(input.surface).slice(0, 32) : null,
    path: input.path ? String(input.path).slice(0, 200) : "/scan",
    utm_source: input.utm_source ? String(input.utm_source).slice(0, 80) : null,
    utm_medium: input.utm_medium ? String(input.utm_medium).slice(0, 80) : null,
    utm_campaign: input.utm_campaign ? String(input.utm_campaign).slice(0, 80) : null,
    checks_count: input.increment_check ? 1 : 0,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
  if (hasEmail) base.email = email;
  if (input.referrer_user_id) base.referrer_user_id = input.referrer_user_id;

  let sheetOk = false;
  if (sheetConfigured()) {
    const sheet = await sheetAppendScanVisitor(base);
    sheetOk = Boolean(sheet.ok);
  }

  // `at` is a column on the sheet, not on the table. Sending it to PostgREST
  // rejects the whole row — which is why every first-time visitor was lost
  // while returning ones (an update, which already dropped it) came through.
  const { at: _sheetAt, ...row } = base;

  let visitor = { anon_id };
  if (supabaseConfigured()) {
    const patchVisitor = async (found) => {
      const patch = {
        ...row,
        last_seen_at: now,
        checks_count: Math.max(0, Number(found.checks_count) || 0) + (input.increment_check ? 1 : 0),
      };
      if (!hasEmail) delete patch.email;
      const updated = await sbAdmin(rest("scan_visitors", `id=eq.${found.id}`), {
        method: "PATCH",
        body: patch,
      });
      return one(updated.data) || { id: found.id, anon_id };
    };

    const findVisitor = async () => {
      const existing = await sbAdmin(
        rest("scan_visitors", `anon_id=eq.${encodeURIComponent(anon_id)}&select=id,checks_count,email`)
      );
      return one(existing.data);
    };

    let found = await findVisitor();
    if (found?.id) {
      visitor = await patchVisitor(found);
    } else {
      const inserted = await sbAdmin(rest("scan_visitors"), {
        method: "POST",
        body: {
          ...row,
          last_seen_at: now,
          created_at: now,
          checks_count: input.increment_check ? 1 : 0,
        },
      });
      if (inserted.ok) {
        visitor = one(inserted.data) || { anon_id };
      } else {
        const dup =
          inserted.status === 409 ||
          /duplicate key|scan_visitors_anon_id_idx/i.test(String(inserted.data?.message || ""));
        if (dup) {
          found = await findVisitor();
          if (found?.id) visitor = await patchVisitor(found);
        }
        if (!found?.id && !visitor?.id) {
          await logServerError({
            kind: "visit_not_saved",
            message: `Could not save scan visitor — ${inserted.data?.message || "database rejected it"}`,
            status: inserted.status,
            path: "/api/scan-visit",
            email: hasEmail ? email : "",
            anon_id,
            detail: { sheet_ok: sheetOk },
          });
          if (!sheetOk) return { ok: false, error: "could not save scan visitor." };
        }
      }
    }
  } else if (!sheetOk) {
    return { ok: false, error: "could not save scan visitor to sheet." };
  }

  let lead = null;
  if (hasEmail) {
    lead = await upsertLead({
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
  }

  return { ok: true, visitor, lead, sheet: sheetOk };
}
