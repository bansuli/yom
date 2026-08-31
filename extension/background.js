import { extAnalytics } from "./lib/analytics.js";

const FORCE_HOST = "yomForceHost";
const SESSION_KEY = "yom-session";
const API_BASES = ["https://youryom.com", "https://www.youryom.com"];
const BRAIN_PATH = "/api/yom-advise";

const cache = new Map();

chrome.storage.local.remove("yom-api");

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.remove("yom-api");
  if (details.reason === "install") {
    extAnalytics.capture("extension_installed", {
      extension_version: chrome.runtime.getManifest()?.version,
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OPEN_SHOP") {
    chrome.tabs.create({ url: msg.url || "https://youryom.com/scan" });
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "YOM_FORCE_HOST") {
    chrome.storage.local.set({ [FORCE_HOST]: msg.host || "" }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "YOM_TRACK") {
    loadSession()
      .then((session) =>
        extAnalytics.capture(msg.event, msg.properties || {}, {
          userId: session?.user?.id || session?.profile?.id || null,
        })
      )
      .then((data) => sendResponse(data || { ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg?.type === "YOM_IDENTIFY") {
    const id = msg.userId;
    extAnalytics
      .identify(id, msg.traits || {})
      .then((data) => sendResponse(data || { ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg?.type === "YOM_GOOGLE") {
    loadGoogle()
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false, events: [], gmail: [] }));
    return true;
  }

  if (msg?.type === "YOM_ADVISE") {
    advise(msg.payload)
      .then((out) => sendResponse({ ok: true, advice: out?.advice || out, review_brief: out?.review_brief || null }))
      .catch(() => sendResponse({ ok: false, advice: null }));
    return true;
  }

  if (msg?.type === "YOM_LOGIN") {
    auth("/api/login", msg.body)
      .then(async (data) => {
        if (data.ok && data.user?.id) {
          await extAnalytics.identify(data.user.id, {
            email: data.user.email,
            name: data.user.name || data.profile?.name,
          });
        }
        sendResponse(data);
      })
      .catch(() => sendResponse({ ok: false, error: "could not log in." }));
    return true;
  }

  if (msg?.type === "YOM_SIGNUP") {
    auth("/api/signup", msg.body)
      .then(async (data) => {
        if (data.ok && data.user?.id) {
          await extAnalytics.identify(data.user.id, {
            email: data.user.email,
            name: data.user.name || data.profile?.name,
          });
          await extAnalytics.capture(
            "signup_completed",
            { surface: "extension" },
            { userId: data.user.id }
          );
          await extAnalytics.capture(
            "yom_created",
            { surface: "extension", onboarding_version: extAnalytics.ONBOARDING_VERSION },
            { userId: data.user.id }
          );
        }
        sendResponse(data);
      })
      .catch(() => sendResponse({ ok: false, error: "could not create the account." }));
    return true;
  }

  if (msg?.type === "YOM_LOGOUT") {
    chrome.storage.local.remove(SESSION_KEY, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "YOM_ME") {
    loadSession()
      .then((session) => sendResponse({ ok: Boolean(session?.access_token), session: session || null }))
      .catch(() => sendResponse({ ok: false, session: null }));
    return true;
  }

  if (msg?.type === "YOM_SAVE") {
    saveRemote(msg.item)
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg?.type === "YOM_TAKE") {
    postTake(msg.take)
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg?.type === "YOM_OUTCOME") {
    postOutcome(msg.outcome)
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg?.type === "YOM_SESSION") {
    saveSessionRow(msg.session)
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg?.type === "YOM_LEARN") {
    saveLearn(msg.learn)
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return true;
});

function cacheKey(payload) {
  const p = payload?.product || {};
  const s = payload?.profile || {};
  return [
    payload?.surface,
    s.userId,
    p.id || p.href || p.name,
    s.mode,
    s.purpose,
    s.budget,
    s.spent,
    s.keepLean,
    s.trait,
    s.preBuy,
    s.memory,
    JSON.stringify(s.sizes || {}),
  ].join("|");
}

async function loadSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return stored[SESSION_KEY] || null;
}

async function storeSession(data) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
    profile: data.profile,
  };
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) continue;
      return { status: res.status, ...data };
    } catch {
      /* try next */
    }
  }
  return { ok: false, fallback: true, error: "user store is not configured" };
}

async function auth(path, body) {
  const data = await api(path, { method: "POST", body });
  if (data.ok && data.access_token) {
    data.session = await storeSession(data);
  }
  return data;
}

async function saveRemote(item) {
  const session = await loadSession();
  if (!session?.access_token) return { ok: false, skipped: true };
  const data = await api("/api/saved", { method: "POST", body: item, token: session.access_token });
  if (data.ok && data.saved && session.profile) {
    session.profile.saved = data.saved;
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }
  return data;
}

const takeSeen = new Set();
const outcomeSeen = new Set();

async function postAuthed(path, body) {
  const session = await loadSession();
  if (!session?.access_token) return { ok: false, skipped: true };
  return api(path, { method: "POST", body: body || {}, token: session.access_token });
}

async function postTake(take) {
  const key = [take?.product_key, take?.title, take?.surface, take?.mode].join("|");
  if (!take?.product_key || takeSeen.has(key)) return { ok: true, duplicate: true };
  takeSeen.add(key);
  if (takeSeen.size > 400) takeSeen.clear();
  return postAuthed("/api/takes", take);
}

async function postOutcome(outcome) {
  const key = [outcome?.action, outcome?.product_key].join("|");
  if (!outcome?.action || !outcome?.product_key || outcomeSeen.has(key)) {
    if (!outcome?.action || !outcome?.product_key) return { ok: false, error: "need a product." };
    return { ok: true, duplicate: true };
  }
  outcomeSeen.add(key);
  if (outcomeSeen.size > 400) outcomeSeen.clear();
  return postAuthed("/api/outcomes", outcome || {});
}

async function saveSessionRow(row) {
  return postAuthed("/api/session", row || {});
}

async function saveLearn(learn) {
  const session = await loadSession();
  if (!session?.access_token) return { ok: false, skipped: true };
  const data = await api("/api/memory", { method: "POST", body: learn || {}, token: session.access_token });
  if (data.ok && data.profile) {
    session.profile = data.profile;
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }
  return data;
}

const GOOGLE_STALE_MS = 6 * 60 * 60 * 1000;

function googleSyncStale(status = {}) {
  if (!status?.connected) return false;
  const cal = status.calendar_synced_at;
  const mail = status.gmail_synced_at;
  if (!cal || !mail) return true;
  const calT = Date.parse(cal);
  const mailT = Date.parse(mail);
  if (Number.isNaN(calT) || Number.isNaN(mailT)) return true;
  const age = Math.min(Date.now() - calT, Date.now() - mailT);
  return age > GOOGLE_STALE_MS;
}

async function refreshSessionProfile(session) {
  const data = await api("/api/me", { token: session.access_token });
  if (!data.ok || !data.profile) return session;
  session.profile = data.profile;
  session.user = data.user || session.user;
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function loadGoogle() {
  const session = await loadSession();
  if (!session?.access_token) return { ok: false, events: [], gmail: [] };

  let synced = false;
  const status = await api("/api/google/status", { token: session.access_token });
  if (googleSyncStale(status)) {
    const sync = await api("/api/google/sync", {
      method: "POST",
      body: { calendar: true, gmail: true },
      token: session.access_token,
    });
    synced = Boolean(sync.ok);
  }

  let profile = null;
  if (synced) {
    const fresh = await refreshSessionProfile(session);
    profile = fresh.profile || null;
  }

  const data = await api("/api/google/events", { token: session.access_token });
  if (!data.ok) return { ok: false, events: [], gmail: [], synced, profile };
  return {
    ok: true,
    events: data.events || [],
    gmail: data.gmail || [],
    synced,
    profile,
  };
}

async function callSharedBrain(payload) {
  const session = await loadSession();
  const headers = { "content-type": "application/json" };
  if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${BRAIN_PATH}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.advice) return { advice: data.advice, review_brief: data.review_brief || null };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function advise(payload) {
  const key = cacheKey(payload);
  if (cache.has(key)) return cache.get(key);
  const out = await callSharedBrain(payload);
  if (out?.advice && !out.advice.quiet) cache.set(key, out);
  return out;
}
