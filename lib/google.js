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

export function authUrl({ userId, returnTo = "/beta" }) {
  const state = signState({ userId, returnTo });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
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

/** Rough occasion classifier for yom context chips. */
export function classifyEvent(title = "", description = "") {
  const t = `${title} ${description}`.toLowerCase();
  if (/wedding|bridal|bridesmaid/.test(t)) return "wedding";
  if (/trip|flight|travel|weekend in|vacation|nyc|paris|london/.test(t)) return "trip";
  if (/work|interview|offsite|conference|meeting/.test(t)) return "work";
  if (/date|dinner|anniversary/.test(t)) return "date";
  if (/party|birthday|shower|graduation/.test(t)) return "event";
  return "generic";
}

/**
 * Lightweight Gmail dig for shopping / fit signals.
 * Searches recent mail; callers decide what to store.
 */
export async function searchGmail(accessToken, { query, max = 20 } = {}) {
  const q =
    query ||
    newerThanQuery(90) +
      " (Reformation OR Aritzia OR Zara OR \"order confirmation\" OR return OR alteration OR hem OR sizing)";
  const params = new URLSearchParams({
    q,
    maxResults: String(max),
  });
  const list = await googleFetch(accessToken, `${GMAIL}/users/me/messages?${params}`);
  if (!list.ok) throw new Error(list.data?.error?.message || "gmail search failed");
  const ids = (list.data.messages || []).map((m) => m.id);
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
