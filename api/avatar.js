import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken, assembleAccount } from "../lib/profile.js";
import { rest, sbAdmin, supabaseConfigured, supabaseService, supabaseUrl } from "../lib/supabase.js";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * POST /api/avatar   { image: "data:image/jpeg;base64,…" }
 * DELETE /api/avatar — go back to the colour.
 *
 * The photo is stored under the account's own id, so one person can only ever
 * overwrite their own. Whose id that is comes from the session token.
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST" && req.method !== "DELETE") {
    json(res, 405, { ok: false, error: "POST or DELETE only" });
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
  const userId = account.user.id;

  if (req.method === "DELETE") {
    await sbAdmin(rest("profiles", `id=eq.${userId}`), {
      method: "PATCH",
      body: { avatar_url: null },
    });
    const fresh = await assembleAccount({ id: userId, email: account.user.email });
    json(res, 200, { ok: true, ...fresh });
    return;
  }

  const body = readJson(req);
  const match = String(body.image || "").match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) {
    json(res, 400, { ok: false, error: "That doesn't look like an image." });
    return;
  }

  const mime = match[1].toLowerCase();
  const ext = TYPES[mime];
  if (!ext) {
    json(res, 400, { ok: false, error: "Use a JPEG, PNG or WebP." });
    return;
  }

  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length) {
    json(res, 400, { ok: false, error: "That image is empty." });
    return;
  }
  if (bytes.length > MAX_BYTES) {
    json(res, 413, { ok: false, error: "That photo is too big. Try a smaller one." });
    return;
  }

  // One object per account, overwritten in place. A cache-busting query is
  // added to the stored URL so a new photo shows immediately.
  const path = `${userId}.${ext}`;
  const key = supabaseService();
  const upload = await fetch(
    `${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
        "Content-Type": mime,
        "x-upsert": "true",
      },
      body: bytes,
    }
  );

  if (!upload.ok) {
    const detail = await upload.text();
    console.warn("avatar upload", upload.status, detail.slice(0, 200));
    if (upload.status === 404) {
      json(res, 503, { ok: false, error: "Photo storage isn't set up yet." });
      return;
    }
    json(res, 500, { ok: false, error: "Couldn't save that photo. Try again." });
    return;
  }

  const url = `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
  const saved = await sbAdmin(rest("profiles", `id=eq.${userId}`), {
    method: "PATCH",
    body: { avatar_url: url },
  });
  if (!saved.ok) {
    console.warn("avatar patch", saved.status, saved.data?.message || "");
    json(res, 500, { ok: false, error: "Saved the photo but couldn't attach it. Try again." });
    return;
  }

  const fresh = await assembleAccount({ id: userId, email: account.user.email });
  json(res, 200, { ok: true, ...fresh });
}
