import { rest, sbAdmin, supabaseConfigured } from "./supabase.js";

/**
 * Record a server-side failure so it reaches /admin.
 *
 * The client has its own reporter; this is for the failures no browser ever
 * sees — a database write that did not land while something else in the same
 * request succeeded. Those are the ones that cost real data, because nothing
 * anywhere reports them.
 *
 * Never throws and never awaits anything the caller depends on: logging a
 * failure must not become a second failure.
 */
export async function logServerError({ kind = "server_error", message = "", status, path, email, detail } = {}) {
  if (!supabaseConfigured()) return;
  try {
    await sbAdmin(rest("app_errors"), {
      method: "POST",
      body: {
        kind,
        message: String(message || "").slice(0, 400),
        status: Number.isFinite(Number(status)) && Number(status) > 0 ? Math.trunc(Number(status)) : null,
        path: String(path || "").slice(0, 200),
        surface: "server",
        email: String(email || "").trim().toLowerCase() || null,
        detail: detail && typeof detail === "object" ? detail : {},
      },
    });
  } catch {
    /* nothing useful to do if even the error log is down */
  }
}
