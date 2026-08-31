import { reportError } from "./report-error.js";
import { apiUrl } from "./native.js";

const SESSION = "yom-beta";

async function parseRes(res) {
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: null };
  }
}

const RETRY_AFTER_MS = 1200;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A rejected fetch never completed — the phone was between networks as the page
 * loaded, which on a walk across campus is most of them. Try once more before
 * calling it a fault, and only report if the second one dies too: the issues
 * list is for things somebody has to fix, not for a lift with no signal.
 *
 * Only for requests that are safe to repeat. Every write behind `retry` is an
 * upsert keyed on the account, the email or the device, so arriving twice is
 * the same as arriving once.
 */
async function send(path, init, { quiet = false, retry = false } = {}) {
  const label = `${init.method || "GET"} ${path}`;
  const attempt = async () => {
    const res = await fetch(apiUrl(path), init);
    return parseRes(res);
  };

  let parsed;
  try {
    parsed = await attempt();
  } catch (e) {
    if (retry) {
      await wait(RETRY_AFTER_MS);
      try {
        parsed = await attempt();
      } catch (again) {
        if (!quiet) reportError({ kind: "api_error", message: `${label} — ${again?.message || "network"}`, path });
        return { fallback: true };
      }
    } else {
      if (!quiet) reportError({ kind: "api_error", message: `${label} — ${e?.message || "network"}`, path });
      return { fallback: true };
    }
  }

  // A 5xx is the server's problem, not the network's — repeating it just asks
  // a struggling server the same question twice.
  if ((parsed.status >= 500 || parsed.status === 429) && !quiet) {
    reportError({ kind: "api_error", message: parsed.data?.error || label, status: parsed.status, path });
  }
  if (parsed.status === 404 || parsed.status === 503 || !parsed.data) {
    return { fallback: true, error: parsed.data?.error };
  }
  return { status: parsed.status, ...parsed.data };
}

async function post(path, body, token, extra = {}) {
  return send(
    path,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
      keepalive: Boolean(extra.keepalive),
    },
    extra
  );
}

async function get(path, token, extra = {}) {
  // Reading is always safe to repeat.
  return send(path, { headers: token ? { authorization: `Bearer ${token}` } : {} }, { retry: true, ...extra });
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

export function yomPhoneStart(phone) {
  return post("/api/phone/start", { phone });
}

export function yomPhoneVerify(phone, code, extra = {}) {
  return post("/api/phone/verify", { phone, code, ...extra });
}

export function yomProfileUpdate(token, body) {
  return post("/api/profile", body, token);
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

export function yomGoogleStart(token, returnTo = "/looks", intent = "") {
  const q = intent ? `&intent=${encodeURIComponent(intent)}` : "";
  return get(`/api/google/start?returnTo=${encodeURIComponent(returnTo)}${q}`, token);
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
  // Upserted by email on the server, so a repeat is the same lead.
  return post("/api/leads", body, undefined, { keepalive: true, retry: true });
}

export function yomScanVisit(body) {
  // Fired the moment a page loads, so it is usually still in flight when she
  // taps through. Without keepalive the browser cancels it and the visit is
  // simply never recorded. Upserted by device id, so a repeat is the same visit.
  return post("/api/scan-visit", body, undefined, { keepalive: true, retry: true });
}

export function yomShare(body) {
  return post("/api/share", body);
}

export function yomLinkPreview(url) {
  return post("/api/link-preview", { url });
}

export function yomLineup(body) {
  // Her whole pipeline, upserted on her account key — this is the one write
  // where losing the request means losing looks she can see on her own phone.
  return post("/api/lineup", body, undefined, { retry: true });
}

export function yomGetLineup(id) {
  return get(`/api/lineup?id=${encodeURIComponent(id)}`);
}

export function yomRestore(email) {
  return post("/api/restore", { email });
}

export function yomMyPipeline(accountKey) {
  return get(`/api/lineup?mine=1&key=${encodeURIComponent(accountKey)}`, undefined, { quiet: true });
}

export function yomEveryone() {
  return get("/api/lineup?feed=1");
}

export function yomGetShare(id, anonId) {
  const q = new URLSearchParams({ id });
  if (anonId) q.set("anon_id", anonId);
  return get(`/api/share?${q}`);
}
