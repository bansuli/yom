import { getAuthUser } from "./supabase.js";

/** Addresses allowed into /admin. Founders only; not tied to /beta. */
export function adminEmails() {
  return String(process.env.YOM_ADMINS || "ban@youryom.com,mal@youryom.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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
    if (who.ok && email && adminEmails().includes(email)) return email;
  }
  const secret = process.env.YOM_ADMIN_SECRET || "";
  if (secret && String(req.headers["x-yom-admin"] || "") === secret) return "shared secret";
  return "";
}
