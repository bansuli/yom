import { reportError } from "./report-error.js";

const SESSION = "yom-beta";

async function parseRes(res) {
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: null };
  }
}

async function post(path, body, token, extra = {}) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
      keepalive: Boolean(extra.keepalive),
    });
    const parsed = await parseRes(res);
    if ((parsed.status >= 500 || parsed.status === 429) && !extra.quiet) {
      reportError({ kind: "api_error", message: parsed.data?.error || `POST ${path}`, status: parsed.status, path });
    }
    if (parsed.status === 404 || parsed.status === 503 || !parsed.data) {
      return { fallback: true, error: parsed.data?.error };
    }
    return { status: parsed.status, ...parsed.data };
  } catch (e) {
    // quiet is for a call that will try again itself: reporting the first miss
    // fills /admin with faults nothing needs to be done about.
    if (!extra.quiet) reportError({ kind: "api_error", message: `POST ${path} — ${e?.message || "network"}`, path });
    return { fallback: true };
  }
}

async function get(path, token) {
  try {
    const res = await fetch(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const parsed = await parseRes(res);
    if (parsed.status >= 500 || parsed.status === 429) {
      reportError({ kind: "api_error", message: parsed.data?.error || `GET ${path}`, status: parsed.status, path });
    }
    if (parsed.status === 404 || parsed.status === 503 || !parsed.data) {
      return { fallback: true, error: parsed.data?.error };
    }
    return { status: parsed.status, ...parsed.data };
  } catch (e) {
    reportError({ kind: "api_error", message: `GET ${path} — ${e?.message || "network"}`, path });
    return { fallback: true };
  }
}

export function loadBetaSession() {
  try {
    const raw = sessionStorage.getItem(SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBetaSession(session) {
  sessionStorage.setItem(SESSION, JSON.stringify(session));
}

export function clearBetaSession() {
  sessionStorage.removeItem(SESSION);
}

export function yomLogin(email, password) {
  return post("/api/login", { email, password });
}

export function yomSignup(email, password, name, extra = {}) {
  return post("/api/signup", { email, password, name, ...extra });
}

export function yomCloset(token, body) {
  return post("/api/closet", body, token);
}

export function yomMe(token) {
  return get("/api/me", token);
}

export function yomGoogleStatus(token) {
  return get("/api/google/status", token);
}

export function yomGoogleStart(token, returnTo = "/looks") {
  return get(`/api/google/start?returnTo=${encodeURIComponent(returnTo)}`, token);
}

export function yomGoogleSync(token, body = { calendar: true, gmail: true }) {
  return post("/api/google/sync", body, token);
}

export function yomGoogleEvents(token) {
  return get("/api/google/events", token);
}

export function yomGoogleDisconnect(token) {
  return post("/api/google/disconnect", {}, token);
}

export function yomGoogleClaim(grant) {
  return post("/api/google/claim", { grant });
}

export function yomScan(body, token) {
  return post("/api/yom-scan", body, token);
}

export function yomCaptureLead(body) {
  return post("/api/leads", body, undefined, { keepalive: true });
}

export function yomScanVisit(body, opts = {}) {
  // Fired the moment a page loads, so it is usually still in flight when she
  // taps through. Without keepalive the browser cancels it and the visit is
  // simply never recorded.
  return post("/api/scan-visit", body, undefined, { keepalive: true, quiet: Boolean(opts.quiet) });
}

export function yomShare(body) {
  return post("/api/share", body);
}

export function yomLinkPreview(url) {
  return post("/api/link-preview", { url });
}

export function yomLineup(body) {
  return post("/api/lineup", body);
}

export function yomGetLineup(id) {
  return get(`/api/lineup?id=${encodeURIComponent(id)}`);
}

export function yomRestore(email) {
  return post("/api/restore", { email });
}

export function yomMyPipeline(accountKey) {
  return get(`/api/lineup?mine=1&key=${encodeURIComponent(accountKey)}`);
}

export function yomEveryone() {
  return get("/api/lineup?feed=1");
}

export function yomGetShare(id, anonId) {
  const q = new URLSearchParams({ id });
  if (anonId) q.set("anon_id", anonId);
  return get(`/api/share?${q}`);
}
