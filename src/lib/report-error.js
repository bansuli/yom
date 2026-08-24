import { getAnonId, getSurface } from "./analytics.js";
import { loadJoinEmail } from "./join-store.js";

/**
 * Report a failure so it shows up on /admin. Deliberately quiet and bounded:
 * a broken app must never make itself worse by hammering the api, and the same
 * fault repeating is one line worth of information, not fifty.
 */

const MAX_PER_SESSION = 12;
const seen = new Set();
let sent = 0;
let leaving = false;

// A request cancelled because she navigated away is not a failure, and logging
// it buries the failures that are. Anything reported while the page is on its
// way out is dropped.
if (typeof window !== "undefined") {
  const going = () => {
    leaving = true;
  };
  window.addEventListener("pagehide", going);
  window.addEventListener("beforeunload", going);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") leaving = true;
    else leaving = false;
  });
}

function isNavigationNoise(message) {
  return /abort|load failed|failed to fetch|networkerror|cancell?ed/i.test(String(message || ""));
}

/**
 * The account key is the whole of someone's yom — hold it and you are her. It
 * travels in the url of /api/lineup?mine=1, so a failed request put it straight
 * into a message displayed on /admin. Take it out of anything we report; it also
 * means one broken call is one issue rather than one per person.
 */
function scrub(text) {
  return String(text || "").replace(/\b(key|token|secret|access_token)=[^&\s]+/gi, "$1=…");
}

export function reportError({ kind = "js_error", message = "", status, path, detail } = {}) {
  if (typeof window === "undefined") return;
  const text = scrub(message).slice(0, 400);
  if (!text) return;
  // What a cross-origin script reports instead of a message. It is an extension
  // or an embedded script, never yom's own code, and it says nothing at all.
  if (/^script error\.?$/i.test(text)) return;
  if (leaving && isNavigationNoise(text)) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const fingerprint = `${kind}:${status || ""}:${text}`;
  if (seen.has(fingerprint) || sent >= MAX_PER_SESSION) return;
  seen.add(fingerprint);
  sent += 1;

  try {
    const body = JSON.stringify({
      kind,
      message: text,
      status,
      path: scrub(path || window.location.pathname),
      surface: getSurface(),
      anon_id: getAnonId(),
      email: loadJoinEmail() || undefined,
      account_key: (() => {
        try {
          return localStorage.getItem("yom_account_key") || undefined;
        } catch {
          return undefined;
        }
      })(),
      detail: detail && typeof detail === "object" ? detail : undefined,
    });
    // keepalive so a report survives the navigation that often follows a crash
    fetch("/api/log-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never throw */
  }
}

/** Catch what never reaches a try/catch: thrown errors and rejected promises. */
export function startErrorReporting() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    reportError({
      kind: "js_error",
      message: e?.message || "script error",
      detail: { source: e?.filename || "", line: e?.lineno || 0 },
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e?.reason;
    reportError({
      kind: "js_error",
      message: reason?.message || String(reason || "unhandled rejection"),
    });
  });
}
