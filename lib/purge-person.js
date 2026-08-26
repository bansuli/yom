import { rest, sbAdmin, findAuthUserByEmail, supabaseConfigured } from "./supabase.js";

const AUTH = "/auth/v1";

function enc(email) {
  return encodeURIComponent(String(email || "").trim().toLowerCase());
}

async function del(table, query) {
  const res = await sbAdmin(rest(table, query), { method: "DELETE", prefer: "return=minimal" });
  return { ok: res.ok, status: res.status };
}

/** Hide someone on the everyone board without deleting their data. */
export async function makeLineupPrivate(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !supabaseConfigured()) return { ok: false, error: "not configured" };

  const res = await sbAdmin(rest("lineups", `email=eq.${enc(e)}`), {
    method: "PATCH",
    body: {
      is_public: false,
      sisterhood: false,
      updated_at: new Date().toISOString(),
    },
    prefer: "return=representation",
  });
  if (!res.ok) return { ok: false, error: res.data?.message || "could not update lineup." };
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  return { ok: true, changed: Boolean(row?.id), email: e };
}

/**
 * Remove a person from yom's store — looks, lineup, visits, leads, auth user.
 * For test accounts and mistaken signups. Does not touch the Google Sheet.
 */
export async function purgePerson(email, { deleteAuth = true } = {}) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return { ok: false, error: "need an email." };
  if (!supabaseConfigured()) return { ok: false, error: "supabase is not configured" };

  const eq = `email=eq.${enc(e)}`;
  const steps = [];

  for (const table of ["scan_checks", "pipeline_looks", "lineups", "scan_visitors", "leads", "allowlist"]) {
    const res = await del(table, eq);
    steps.push({ table, ok: res.ok, status: res.status });
  }

  const shares = await del("shares", `sender_email=eq.${enc(e)}`);
  steps.push({ table: "shares", ok: shares.ok, status: shares.status });

  let authDeleted = false;
  if (deleteAuth) {
    const user = await findAuthUserByEmail(e);
    if (user?.id) {
      const removed = await sbAdmin(`${AUTH}/admin/users/${user.id}`, { method: "DELETE" });
      authDeleted = removed.ok;
      steps.push({ table: "auth.users", ok: removed.ok, status: removed.status });
      if (removed.ok) {
        await del("profiles", `email=eq.${enc(e)}`);
      }
    }
  }

  const failed = steps.filter((s) => !s.ok && s.status !== 404);
  if (failed.length) {
    return { ok: false, error: "some rows could not be deleted.", steps, authDeleted };
  }

  return { ok: true, email: e, steps, authDeleted };
}
