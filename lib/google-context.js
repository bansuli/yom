import { formatGoogleBlock } from "./stylist.js";
import {
  getGoogleAccount,
  listGmailSignals,
  listUpcomingEvents,
  publicGoogleStatus,
  syncCalendar,
  syncGmail,
} from "./google-store.js";

const STALE_MS = 6 * 60 * 60 * 1000;

function isStale(iso, ms = STALE_MS) {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ms;
}

function withTimeout(promise, ms, label = "timeout") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);
}

export function shapeEvents(events = []) {
  return (Array.isArray(events) ? events : []).map((e) => ({
    id: e.id || e.google_event_id || "",
    label: e.title || e.label || "untitled",
    when: e.starts_at || e.when || e.when_text || "",
    ends: e.ends_at || "",
    kind: e.kind || "generic",
    location: e.location || "",
    link: e.html_link || e.link || "",
    all_day: Boolean(e.all_day),
  }));
}

export function shapeGmail(signals = []) {
  return (Array.isArray(signals) ? signals : []).map((s) => ({
    id: s.id || s.gmail_id || "",
    subject: s.subject || "",
    from: s.from_addr || s.from || "",
    snippet: s.snippet || "",
    when: s.sent_at || s.when || "",
    kind: s.signal_kind || s.kind || "other",
    brand: s.brand || "",
  }));
}

async function refreshIfStale(userId, account, { timeoutMs = 4500 } = {}) {
  if (!account) return account;
  const needCal = isStale(account.calendar_synced_at);
  const needMail = isStale(account.gmail_synced_at);
  if (!needCal && !needMail) return account;
  try {
    await withTimeout(
      (async () => {
        let current = account;
        if (needCal) {
          await syncCalendar(userId, current);
          current = (await getGoogleAccount(userId)) || current;
        }
        if (needMail) await syncGmail(userId, current);
      })(),
      timeoutMs,
      "google sync timeout"
    );
  } catch (e) {
    console.warn("google context refresh", e?.message || e);
  }
  return (await getGoogleAccount(userId)) || account;
}

/**
 * Load calendar + gmail for a yom user. Optionally refresh stale syncs.
 */
export async function loadStylistContext(userId, { refresh = true } = {}) {
  if (!userId) {
    return { connected: false, events: [], gmail: [], prompt: formatGoogleBlock({ connected: false }) };
  }
  let account = await getGoogleAccount(userId);
  if (!account) {
    return { connected: false, events: [], gmail: [], prompt: formatGoogleBlock({ connected: false }) };
  }
  if (refresh) account = await refreshIfStale(userId, account);

  const [rawEvents, rawMail] = await Promise.all([
    listUpcomingEvents(userId, { limit: 12 }),
    listGmailSignals(userId, { limit: 16 }),
  ]);
  const events = shapeEvents(rawEvents);
  const gmail = shapeGmail(rawMail);
  return {
    connected: true,
    email: account.email || null,
    calendar_synced_at: account.calendar_synced_at || null,
    gmail_synced_at: account.gmail_synced_at || null,
    events,
    gmail,
    prompt: formatGoogleBlock({ connected: true, events, gmail }),
    status: publicGoogleStatus(account),
  };
}
