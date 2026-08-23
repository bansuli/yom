import { getAuthUser } from "./supabase.js";

/** Explicit allowlist, when one is configured. */
export function adminEmails() {
  return String(process.env.YOM_ADMINS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Who may open /admin. The domain is the team, so anyone on it qualifies —
 * guessing at individual addresses just locks a founder out of her own numbers.
 * Set YOM_ADMINS to pin an exact list instead.
 */
export function isAdminEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return false;
  const explicit = adminEmails();
  return explicit.length ? explicit.includes(value) : value.endsWith("@youryom.com");
}

/**
 * Either a founder logged in with her own email, or the shared secret — which
 * exists so the numbers were reachable the night this was built, and disappears
 * the moment YOM_ADMIN_SECRET is unset.
 *
 * Returns who it was, so an action can record who took it.
 */
export async function adminIdentity(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token) {
    const who = await getAuthUser(token);
    const email = String(who.data?.email || "").trim().toLowerCase();
    if (who.ok && isAdminEmail(email)) return email;
  }
  const secret = process.env.YOM_ADMIN_SECRET || "";
  if (secret && String(req.headers["x-yom-admin"] || "") === secret) return "shared secret";
  return "";
}
