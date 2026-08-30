const AUTH = "/auth/v1";
const REST = "/rest/v1";

export function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}

/** Public/client key: classic anon JWT, or new sb_publishable_… key. */
export function supabaseAnon() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

/** Server-only key: classic service_role JWT, or new sb_secret_… key. */
export function supabaseService() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
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

function isJwtKey(key) {
  return String(key || "").startsWith("eyJ");
}

async function call(path, { method = "GET", body, token, admin = false, prefer } = {}) {
  const url = supabaseUrl();
  const key = admin ? supabaseService() : supabaseAnon();
  if (!url || !key) return { ok: false, status: 503, data: { message: "supabase is not configured" } };

  // New sb_publishable_ / sb_secret_ keys go in `apikey` only.
  // Putting them in Authorization makes Supabase try to parse a JWT → "Invalid JWT" / backend error.
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (isJwtKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }

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

/**
 * Look up an auth user by address.
 *
 * The admin endpoint's `filter` parameter cannot be relied on — it has quietly
 * returned nothing for addresses that plainly exist, and a miss here is not
 * harmless: the caller concludes the account is new, tries to create it, and
 * Postgres rejects the duplicate with a bare 500. So the filter is only a fast
 * path, and a miss falls back to paging and matching in code.
 */
export async function findAuthUserByEmail(email) {
  const want = String(email || "").trim().toLowerCase();
  if (!want) return null;

  const rowsOf = (data) =>
    Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
  const match = (users) => users.find((u) => String(u.email || "").toLowerCase() === want) || null;

  const filtered = await sbAdmin(
    `${AUTH}/admin/users?filter=${encodeURIComponent(want)}&page=1&per_page=200`
  );
  const quick = match(rowsOf(filtered.data));
  if (quick) return quick;

  // Page through. Capped so a large project cannot turn one sign-in into an
  // unbounded walk; beyond this the filter path is the only sensible route.
  for (let page = 1; page <= 10; page += 1) {
    const res = await sbAdmin(`${AUTH}/admin/users?page=${page}&per_page=200`);
    const users = rowsOf(res.data);
    const hit = match(users);
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
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

/**
 * E.164 or nothing. Supabase rejects anything else, and it is better to say so
 * before spending a text message finding out.
 *
 * The country code has to be there already. Bare digits are refused rather
 * than guessed at: prefixing a "+" to a national number invents a country,
 * and the caller would never know we had picked the wrong one.
 */
export function normalisePhone(raw) {
  const cleaned = String(raw || "").replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) return "";
  const e164 = `+${cleaned.slice(1).replace(/\+/g, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : "";
}

/** Sends the six-digit code. Creates the account if the number is new. */
export async function sendPhoneOtp(phone, { createUser = true } = {}) {
  return sbAnon(`${AUTH}/otp`, {
    method: "POST",
    body: { phone, create_user: createUser },
  });
}

/** Trades the code for a session. */
export async function verifyPhoneOtp(phone, token) {
  return sbAnon(`${AUTH}/verify`, {
    method: "POST",
    body: { phone, token, type: "sms" },
  });
}

export async function findAuthUserByPhone(phone) {
  const want = normalisePhone(phone);
  if (!want) return null;
  const rowsOf = (data) =>
    Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
  const match = (users) => users.find((u) => normalisePhone(u.phone) === want) || null;

  const filtered = await sbAdmin(
    `${AUTH}/admin/users?filter=${encodeURIComponent(want)}&page=1&per_page=200`
  );
  const quick = match(rowsOf(filtered.data));
  if (quick) return quick;

  for (let page = 1; page <= 10; page += 1) {
    const res = await sbAdmin(`${AUTH}/admin/users?page=${page}&per_page=200`);
    const users = rowsOf(res.data);
    const hit = match(users);
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}

export function one(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  if (data.message && !data.id) return null;
  return data;
}
