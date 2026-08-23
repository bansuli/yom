/**
 * Simple spreadsheet store for Cohort 1 — no Supabase required.
 *
 * Set SHEET_WEBHOOK_URL to a Google Apps Script web app that appends rows
 * (and can look up shares). See docs/SHEET_STORE.md.
 */

export function sheetConfigured() {
  return Boolean(process.env.SHEET_WEBHOOK_URL || process.env.LEADS_WEBHOOK_URL);
}

function webhookUrl() {
  return (process.env.SHEET_WEBHOOK_URL || process.env.LEADS_WEBHOOK_URL || "").replace(/\/$/, "");
}

async function postSheet(payload) {
  const url = webhookUrl();
  if (!url) return { ok: false, skipped: true, error: "sheet webhook not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: process.env.SHEET_WEBHOOK_SECRET || "",
        at: new Date().toISOString(),
        ...payload,
      }),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    // Apps Script can return HTML (auth/permission page) with HTTP 200 — never treat that as saved.
    if (!res.ok || !data || data.ok !== true) {
      console.warn(
        "sheet webhook",
        res.status,
        data?.error || String(text).slice(0, 200)
      );
      return {
        ok: false,
        error: data?.error || `sheet webhook ${res.status || "bad response"}`,
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.warn("sheet webhook", e?.message || e);
    return { ok: false, error: e?.message || "sheet webhook failed" };
  }
}

async function getSheet(params = {}) {
  const url = webhookUrl();
  if (!url) return { ok: false, skipped: true };
  try {
    const q = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => [k, String(v)])
      ),
      secret: process.env.SHEET_WEBHOOK_SECRET || "",
    });
    const res = await fetch(`${url}?${q}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `sheet get ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || "sheet get failed" };
  }
}

export async function sheetAppendLead(row = {}) {
  return postSheet({ table: "leads", action: "append", row });
}

/** One webhook call for many leads; falls back to per-row append. */
export async function sheetAppendLeads(rows = []) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return { ok: true, skipped: true };
  if (list.length === 1) return sheetAppendLead(list[0]);
  const batch = await postSheet({ table: "leads", action: "append", rows: list });
  if (batch.ok) return batch;
  let ok = false;
  for (const row of list) {
    const one = await sheetAppendLead(row);
    if (one.ok) ok = true;
  }
  return { ok };
}

export async function sheetAppendScanVisitor(row = {}) {
  return postSheet({ table: "scan_visitors", action: "append", row });
}

export async function sheetAppendScanCheck(row = {}) {
  return postSheet({ table: "scan_checks", action: "append", row });
}

export async function sheetAppendShare(row = {}) {
  return postSheet({ table: "shares", action: "append", row });
}

export async function sheetAppendVote(row = {}) {
  return postSheet({ table: "share_votes", action: "append", row });
}

export async function sheetGetShare(shareId) {
  return getSheet({ action: "get_share", id: shareId });
}

export async function sheetAppendEvent(table, row = {}) {
  return postSheet({ table, action: "append", row });
}
