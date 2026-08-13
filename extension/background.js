const FORCE_HOST = "yomForceHost";
const SESSION_KEY = "yom-session";
const API_BASES = ["https://youryom.com", "https://www.youryom.com"];
const BRAIN_PATH = "/api/yom-advise";

const cache = new Map();

chrome.storage.local.remove("yom-api");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove("yom-api");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OPEN_REFORMATION") {
    chrome.tabs.create({ url: msg.url || "https://www.thereformation.com/clothing" });
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "YOM_FORCE_HOST") {
    chrome.storage.local.set({ [FORCE_HOST]: msg.host || "" }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "YOM_ADVISE") {
    advise(msg.payload)
      .then((advice) => sendResponse({ ok: true, advice }))
      .catch(() => sendResponse({ ok: false, advice: null }));
    return true;
  }

  if (msg?.type === "YOM_LOGIN") {
    auth("/api/login", msg.body)
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ ok: false, error: "could not log in." }));
    return true;
  }

  if (msg?.type === "YOM_SIGNUP") {
    auth("/api/signup", msg.body)
      .then((data) => sendResponse(data))
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

  if (msg?.type === "YOM_SESSION") {
    saveSessionRow(msg.session)
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

async function saveSessionRow(row) {
  const session = await loadSession();
  if (!session?.access_token) return { ok: false, skipped: true };
  return api("/api/session", { method: "POST", body: row || {}, token: session.access_token });
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
      if (data?.advice) return data.advice;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function advise(payload) {
  const key = cacheKey(payload);
  if (cache.has(key)) return cache.get(key);
  const advice = await callSharedBrain(payload);
  if (advice && !advice.quiet) cache.set(key, advice);
  return advice;
}
