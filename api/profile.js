import { isAvatarColor } from "../lib/avatar.js";
import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken, assembleAccount } from "../lib/profile.js";
import { rest, sbAdmin, supabaseConfigured } from "../lib/supabase.js";

/**
 * POST /api/profile
 * Body: { name?, avatarColor?, trait?, preBuy?, keepLean?, headline?, read? }
 *
 * Edits the parts of a profile someone owns outright. The signed-in token
 * decides whose profile is written, never anything in the body, so this cannot
 * be pointed at somebody else's row.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }
  if (!supabaseConfigured()) {
    json(res, 503, { ok: false, error: "Sign-in is not configured yet." });
    return;
  }

  const token = bearer(req);
  if (!token) {
    json(res, 401, { ok: false, error: "Not signed in." });
    return;
  }

  const account = await accountFromToken(token);
  if (!account?.user?.id) {
    json(res, 401, { ok: false, error: "Session expired. Sign in again." });
    return;
  }

  const body = readJson(req);
  const patch = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) {
      json(res, 400, { ok: false, error: "A name can't be empty." });
      return;
    }
    patch.name = name;
  }

  if (typeof body.avatarColor === "string") {
    const color = body.avatarColor.toUpperCase();
    // Only colours from the shared palette. An arbitrary value would let
    // someone set white text on a white circle.
    if (!isAvatarColor(color)) {
      json(res, 400, { ok: false, error: "That isn't one of the avatar colours." });
      return;
    }
    patch.avatar_color = color;
  }

  // The onboarding answers, editable after the fact — people's habits change,
  // and an answer they cannot correct slowly makes the advice worse.
  const TEXT_FIELDS = [
    ["trait", "trait", 60],
    ["preBuy", "pre_buy", 60],
    ["keepLean", "keep_lean", 60],
    ["headline", "headline", 160],
    ["read", "yom_read", 800],
  ];
  for (const [from, column, max] of TEXT_FIELDS) {
    if (typeof body[from] === "string") {
      patch[column] = body[from].trim().slice(0, max) || null;
    }
  }

  if (!Object.keys(patch).length) {
    json(res, 400, { ok: false, error: "Nothing to change." });
    return;
  }

  const saved = await sbAdmin(rest("profiles", `id=eq.${account.user.id}`), {
    method: "PATCH",
    body: patch,
  });
  if (!saved.ok) {
    console.warn("profile patch", saved.status, saved.data?.message || "");
    json(res, 500, { ok: false, error: "Couldn't save that. Try again." });
    return;
  }

  const fresh = await assembleAccount({ id: account.user.id, email: account.user.email });
  json(res, 200, { ok: true, ...fresh });
}
