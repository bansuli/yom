import { one, rest, sbAdmin } from "./supabase.js";
import {
  classifyEvent,
  listCalendarEvents,
  refreshAccessToken,
  searchGmail,
  toYomEvent,
} from "./google.js";

export async function getGoogleAccount(userId) {
  const res = await sbAdmin(rest("google_accounts", `user_id=eq.${userId}&select=*`), {
    method: "GET",
  });
  return one(res.data);
}

export async function upsertGoogleAccount(userId, row) {
  const payload = {
    user_id: userId,
    google_sub: row.google_sub ?? null,
    email: row.email ?? null,
    access_token: row.access_token ?? null,
    refresh_token: row.refresh_token ?? null,
    token_expiry: row.token_expiry ?? null,
    scopes: row.scopes ?? null,
    calendar_synced_at: row.calendar_synced_at ?? null,
    gmail_synced_at: row.gmail_synced_at ?? null,
    updated_at: new Date().toISOString(),
  };
  const res = await sbAdmin(rest("google_accounts", "on_conflict=user_id"), {
    method: "POST",
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  if (!res.ok) {
    throw new Error(res.data?.message || "could not save google account");
  }
  return one(res.data);
}

export async function deleteGoogleAccount(userId) {
  await sbAdmin(rest("calendar_events", `user_id=eq.${userId}`), { method: "DELETE", prefer: "return=minimal" });
  await sbAdmin(rest("gmail_signals", `user_id=eq.${userId}`), { method: "DELETE", prefer: "return=minimal" });
  await sbAdmin(rest("google_accounts", `user_id=eq.${userId}`), { method: "DELETE", prefer: "return=minimal" });
}

/** Refresh if access token is missing or near expiry. */
export async function freshAccessToken(account) {
  if (!account?.refresh_token && !account?.access_token) {
    throw new Error("google account not connected");
  }
  const expiry = account.token_expiry ? new Date(account.token_expiry).getTime() : 0;
  const stillGood = account.access_token && expiry - Date.now() > 60_000;
  if (stillGood) return account.access_token;

  if (!account.refresh_token) throw new Error("google refresh token missing — reconnect");

  const tokens = await refreshAccessToken(account.refresh_token);
  const next = {
    access_token: tokens.access_token,
    token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    scopes: tokens.scope || account.scopes,
  };
  if (tokens.refresh_token) next.refresh_token = tokens.refresh_token;
  await upsertGoogleAccount(account.user_id, {
    google_sub: account.google_sub,
    email: account.email,
    refresh_token: next.refresh_token || account.refresh_token,
    access_token: next.access_token,
    token_expiry: next.token_expiry,
    scopes: next.scopes,
    calendar_synced_at: account.calendar_synced_at,
    gmail_synced_at: account.gmail_synced_at,
  });
  return next.access_token;
}

function classifyMail(subject = "", snippet = "", fromAddr = "") {
  const t = `${subject} ${snippet} ${fromAddr}`.toLowerCase();
  let signal_kind = "other";
  if (/return|refund|exchange/.test(t)) signal_kind = "return";
  else if (/shipped|tracking|out for delivery|delivered/.test(t)) signal_kind = "shipping";
  else if (/order|confirmation|receipt|purchased/.test(t)) signal_kind = "order";
  else if (/size|fit|alteration|hem|tailor/.test(t)) signal_kind = "sizing";

  const brands = [
    "reformation",
    "aritzia",
    "zara",
    "asos",
    "nordstrom",
    "ssense",
    "everlane",
    "jcrew",
    "j.crew",
    "gap",
    "uniqlo",
    "mango",
    "cos",
    "skims",
    "lululemon",
    "ganni",
    "sezane",
    "revolve",
    "madewell",
    "anthropologie",
    "free people",
    "princess polly",
    "abercrombie",
    "toteme",
    "khaite",
    "staud",
    "agolde",
    "levis",
    "levi's",
    "alo",
    "skims",
    "hm",
    "h&m",
  ];
  const brand = brands.find((b) => t.includes(b)) || "";
  return { signal_kind, brand };
}

export async function syncCalendar(userId, account) {
  const access = await freshAccessToken(account);
  const events = await listCalendarEvents(access, { days: 75, max: 50 });

  // Replace upcoming window for this user (simple strategy).
  await sbAdmin(rest("calendar_events", `user_id=eq.${userId}`), {
    method: "DELETE",
    prefer: "return=minimal",
  });

  const rows = events.map((ev) => ({
    user_id: userId,
    google_event_id: ev.google_event_id,
    title: ev.title,
    description: ev.description,
    location: ev.location,
    starts_at: ev.starts_at,
    ends_at: ev.ends_at,
    all_day: ev.all_day,
    html_link: ev.html_link,
    status: ev.status,
    kind: ev.kind || classifyEvent(ev.title, ev.description),
    raw: ev,
  }));

  if (rows.length) {
    await sbAdmin(rest("calendar_events"), {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  // Mirror into lightweight yom events table used by the companion.
  const yomEvents = events.slice(0, 12).map(toYomEvent);
  await sbAdmin(rest("events", `user_id=eq.${userId}`), {
    method: "DELETE",
    prefer: "return=minimal",
  });
  if (yomEvents.length) {
    await sbAdmin(rest("events"), {
      method: "POST",
      body: yomEvents.map((e) => ({ user_id: userId, ...e })),
      prefer: "return=minimal",
    });
  }

  await upsertGoogleAccount(userId, {
    google_sub: account.google_sub,
    email: account.email,
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    token_expiry: account.token_expiry,
    scopes: account.scopes,
    calendar_synced_at: new Date().toISOString(),
    gmail_synced_at: account.gmail_synced_at,
  });

  return { count: rows.length, events: yomEvents };
}

export async function syncGmail(userId, account) {
  const access = await freshAccessToken(account);
  const messages = await searchGmail(access, { max: 25 });

  const rows = messages.map((m) => {
    const { signal_kind, brand } = classifyMail(m.subject, m.snippet, m.from_addr);
    return {
      user_id: userId,
      gmail_id: m.gmail_id,
      thread_id: m.thread_id,
      subject: m.subject,
      from_addr: m.from_addr,
      snippet: m.snippet,
      sent_at: m.internal_date || null,
      signal_kind,
      brand,
      raw: m,
    };
  });

  if (rows.length) {
    await sbAdmin(rest("gmail_signals", "on_conflict=user_id,gmail_id"), {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  await upsertGoogleAccount(userId, {
    google_sub: account.google_sub,
    email: account.email,
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    token_expiry: account.token_expiry,
    scopes: account.scopes,
    calendar_synced_at: account.calendar_synced_at,
    gmail_synced_at: new Date().toISOString(),
  });

  return { count: rows.length };
}

export async function listUpcomingEvents(userId, { limit = 20 } = {}) {
  const res = await sbAdmin(
    rest(
      "calendar_events",
      `user_id=eq.${userId}&starts_at=gte.${new Date().toISOString()}&order=starts_at.asc&limit=${limit}&select=id,title,starts_at,ends_at,all_day,location,kind,html_link`
    ),
    { method: "GET" }
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function listGmailSignals(userId, { limit = 30 } = {}) {
  const res = await sbAdmin(
    rest(
      "gmail_signals",
      `user_id=eq.${userId}&order=sent_at.desc.nullslast&limit=${limit}&select=id,subject,from_addr,snippet,sent_at,signal_kind,brand`
    ),
    { method: "GET" }
  );
  return Array.isArray(res.data) ? res.data : [];
}

export function publicGoogleStatus(account) {
  if (!account) return { connected: false };
  return {
    connected: true,
    email: account.email || null,
    calendar_synced_at: account.calendar_synced_at || null,
    gmail_synced_at: account.gmail_synced_at || null,
  };
}
