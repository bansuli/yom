const AUTH = "/auth/v1";
const REST = "/rest/v1";

export function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}

export function supabaseAnon() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

export function supabaseService() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnon() && supabaseService());
}

async function parse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function call(path, { method = "GET", body, token, admin = false, prefer } = {}) {
  const url = supabaseUrl();
  const key = admin ? supabaseService() : supabaseAnon();
  if (!url || !key) return { ok: false, status: 503, data: { message: "supabase is not configured" } };
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token || key}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  else if (method !== "GET" && method !== "DELETE") headers.Prefer = "return=representation";
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await parse(res);
  return { ok: res.ok, status: res.status, data };
}

export function rest(table, query = "") {
  return `${REST}/${table}${query ? `?${query}` : ""}`;
}

export async function sbAdmin(path, opts = {}) {
  return call(path, { ...opts, admin: true });
}

export async function sbAnon(path, opts = {}) {
  return call(path, { ...opts, admin: false });
}

export async function signIn(email, password) {
  return sbAnon(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    body: { email, password },
  });
}

export async function getAuthUser(accessToken) {
  return sbAnon(`${AUTH}/user`, { token: accessToken });
}

export async function createAuthUser(email, password, name) {
  return sbAdmin(`${AUTH}/admin/users`, {
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : {},
    },
  });
}

export async function findAuthUserByEmail(email) {
  const q = encodeURIComponent(String(email || "").trim().toLowerCase());
  if (!q) return null;
  const res = await sbAdmin(`${AUTH}/admin/users?filter=${q}&page=1&per_page=20`);
  const users = Array.isArray(res.data?.users) ? res.data.users : Array.isArray(res.data) ? res.data : [];
  const want = String(email || "")
    .trim()
    .toLowerCase();
  return users.find((u) => String(u.email || "").toLowerCase() === want) || null;
}

export async function generateMagicLink(email) {
  return sbAdmin(`${AUTH}/admin/generate_link`, {
    method: "POST",
    body: { type: "magiclink", email: String(email || "").trim().toLowerCase() },
  });
}

export async function verifyTokenHash(tokenHash, type = "magiclink") {
  return sbAnon(`${AUTH}/verify`, {
    method: "POST",
    body: { type, token_hash: tokenHash },
  });
}

export function one(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  if (data.message && !data.id) return null;
  return data;
}
