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

export function reportError({ kind = "js_error", message = "", status, path, detail } = {}) {
  if (typeof window === "undefined") return;
  const text = String(message || "").slice(0, 400);
  if (!text) return;

  const fingerprint = `${kind}:${status || ""}:${text}`;
  if (seen.has(fingerprint) || sent >= MAX_PER_SESSION) return;
  seen.add(fingerprint);
  sent += 1;

  try {
    const body = JSON.stringify({
      kind,
      message: text,
      status,
      path: path || window.location.pathname,
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
