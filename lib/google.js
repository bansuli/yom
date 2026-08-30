/**
 * Google OAuth + Calendar / Gmail helpers for yom.
 *
 * Env (Vercel):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI   e.g. https://youryom.com/api/google/callback
 *   APP_BASE_URL          e.g. https://youryom.com
 *   GOOGLE_TOKEN_SECRET   optional — used to sign OAuth state
 */

import crypto from "crypto";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CALENDAR = "https://www.googleapis.com/calendar/v3";
const GMAIL = "https://gmail.googleapis.com/gmail/v1";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

/*
 * Signing in asks who you are and nothing else.
 *
 * Calendar and Gmail are restricted scopes: asking for them puts an alarming
 * consent screen in front of someone who only wanted to log in, and Google
 * caps an unverified app that requests them at a hundred users. They are asked
 * for separately, later, by someone who has already chosen to connect them.
 */
export const GOOGLE_SIGNIN_SCOPES = ["openid", "email", "profile"].join(" ");

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_REDIRECT_URI || process.env.APP_BASE_URL)
  );
}

export function redirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const base = (process.env.APP_BASE_URL || "https://youryom.com").replace(/\/$/, "");
  return `${base}/api/google/callback`;
}

function secret() {
  return process.env.GOOGLE_TOKEN_SECRET || process.env.GOOGLE_CLIENT_SECRET || "yom-dev";
}

/** Signed state so callback can map back to the yom user. */
export function signState(payload, ttlSec = 600) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const raw = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}

export function verifyState(state) {
  if (!state || !String(state).includes(".")) return null;
  const [raw, sig] = String(state).split(".");
  const expect = crypto.createHmac("sha256", secret()).update(raw).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!body?.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

export function safeReturnTo(value, fallback = "/scan") {
  const s = String(value || fallback);
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return fallback;
  return s.slice(0, 180);
}

export function safeOrigin(value) {
  try {
    const u = new URL(String(value || ""));
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
  } catch {
    /* ignore */
  }
  return "";
}

export function authUrl({ userId = null, returnTo = "/scan", guest = false, origin = "", signin = false } = {}) {
  const state = signState({
    userId: userId || null,
    returnTo: safeReturnTo(returnTo),
    guest: Boolean(guest || !userId),
    origin: safeOrigin(origin),
    signin: Boolean(signin),
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: signin ? GOOGLE_SIGNIN_SCOPES : GOOGLE_SCOPES,
    // Offline access buys a refresh token, which is only worth the extra
    // consent when there is something to keep reading later.
    access_type: signin ? "online" : "offline",
    prompt: signin ? "select_account" : "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${params}`;
}

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function exchangeCode(code) {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || "token exchange failed");
  }
  return data;
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || "refresh failed");
  }
  return data;
}

export async function fetchGoogleUser(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error?.message || "userinfo failed");
  return data;
}

export async function googleFetch(accessToken, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

/** Upcoming primary-calendar events (next N days). */
export async function listCalendarEvents(accessToken, { days = 60, max = 40 } = {}) {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86400000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(max),
  });
  const { ok, data } = await googleFetch(
    accessToken,
    `${CALENDAR}/calendars/primary/events?${params}`
  );
  if (!ok) throw new Error(data?.error?.message || "calendar list failed");
  return (data.items || []).map(normalizeCalendarEvent);
}

export function normalizeCalendarEvent(item) {
  const start = item.start?.dateTime || item.start?.date || null;
  const end = item.end?.dateTime || item.end?.date || null;
  const title = item.summary || "untitled";
  return {
    google_event_id: item.id,
    title,
    description: item.description || "",
    location: item.location || "",
    starts_at: start,
    ends_at: end,
    all_day: Boolean(item.start?.date && !item.start?.dateTime),
    html_link: item.htmlLink || "",
    status: item.status || "confirmed",
    kind: classifyEvent(title, item.description || ""),
  };
}

/** Occasion classifier so yom can style against the actual day. */
export function classifyEvent(title = "", description = "") {
  const t = `${title} ${description}`.toLowerCase();
  if (/wedding|bridal|bridesmaid|rehearsal dinner/.test(t)) return "wedding";
  if (/interview|onsite interview/.test(t)) return "interview";
  if (/trip|flight|travel|weekend in|vacation|airbnb|hotel/.test(t)) return "trip";
  if (/conference|offsite|summit|all[- ]hands/.test(t)) return "work";
  if (/\bwork\b|office|client dinner|board meeting/.test(t)) return "work";
  if (/date night|\bdate\b|anniversary/.test(t)) return "date";
  if (/dinner|reservation|restaurant/.test(t)) return "dinner";
  if (/brunch|lunch/.test(t)) return "brunch";
  if (/graduation|commencement/.test(t)) return "graduation";
  if (/concert|festival|show|gala|party|birthday|shower|cocktail/.test(t)) return "event";
  if (/gym|workout|run club|yoga|pilates|class/.test(t)) return "active";
  if (/recruitment|rush|pref|sisterhood|philanthropy|bid day/.test(t)) return "rush";
  return "generic";
}

const FASHION_QUERY = [
  "aritzia",
  "zara",
  "reformation",
  "nordstrom",
  "ssense",
  "asos",
  "revolve",
  "madewell",
  "everlane",
  "uniqlo",
  "cos",
  "ganni",
  "sezane",
  '"& other stories"',
  "mango",
  "jcrew",
  '"j.crew"',
  "lululemon",
  "skims",
  "aritzia",
  "anthropologie",
  "free people",
  "princess polly",
  "abercrombie",
  "gap",
  "old navy",
  '"order confirmation"',
  '"your order"',
  "shipped",
  "return",
  "exchange",
  "alteration",
  "hem",
].join(" OR ");

function defaultGmailQueries() {
  const recent = newerThanQuery(180);
  return [
    `${recent} (${FASHION_QUERY})`,
    `${recent} (subject:return OR subject:refund OR subject:exchange OR "return label") (order OR clothing OR dress OR shoes)`,
    `${newerThanQuery(365)} (alteration OR tailor OR hem OR "size exchange" OR "exchanged for a size")`,
  ];
}

/**
 * Lightweight Gmail dig for shopping / fit signals.
 * Runs a few targeted searches and de-dupes.
 */
export async function searchGmail(accessToken, { query, max = 24 } = {}) {
  const queries = query ? [query] : defaultGmailQueries();
  const ids = [];
  const seen = new Set();
  for (const q of queries) {
    const params = new URLSearchParams({
      q,
      maxResults: String(Math.min(12, max)),
    });
    const list = await googleFetch(accessToken, `${GMAIL}/users/me/messages?${params}`);
    if (!list.ok) {
      if (!ids.length) throw new Error(list.data?.error?.message || "gmail search failed");
      continue;
    }
    for (const m of list.data.messages || []) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);
      ids.push(m.id);
    }
  }
  const out = [];
  for (const id of ids.slice(0, max)) {
    const msg = await googleFetch(
      accessToken,
      `${GMAIL}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    );
    if (!msg.ok) continue;
    out.push(normalizeGmailMessage(msg.data));
  }
  return out;
}

function newerThanQuery(days) {
  return `newer_than:${days}d`;
}

export function normalizeGmailMessage(msg) {
  const headers = Object.fromEntries(
    (msg.payload?.headers || []).map((h) => [String(h.name).toLowerCase(), h.value])
  );
  return {
    gmail_id: msg.id,
    thread_id: msg.threadId,
    snippet: msg.snippet || "",
    from_addr: headers.from || "",
    subject: headers.subject || "",
    sent_at: headers.date || null,
    internal_date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
    label_ids: msg.labelIds || [],
  };
}

/** Map a calendar event into the lightweight yom `events` row shape. */
export function toYomEvent(ev) {
  const when = formatWhen(ev.starts_at, ev.all_day);
  return {
    label: ev.title,
    when_text: when,
    kind: ev.kind || "generic",
  };
}

function formatWhen(iso, allDay) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    if (allDay) {
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}
