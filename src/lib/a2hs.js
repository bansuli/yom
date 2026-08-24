/**
 * Adding yom to the home screen.
 *
 * It matters more than it looks: her looks live in this browser, and safari
 * clears storage it thinks is stale after a week. The installed app also gets
 * its own storage container on ios, which is why the account key has to travel
 * in the url — safari saves whatever address is showing when she taps Add to
 * Home Screen, so the installed app opens holding her yom instead of nothing.
 */

import { getAccountKey } from "./account.js";

export const A2HS_DISMISSED_KEY = "yom_a2hs_dismissed";
const ADDED_KEY = "yom_a2hs_added";

export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(
      window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

/** ios has no install api, so the only signal is her telling us she did it. */
export function markAdded() {
  try {
    localStorage.setItem(ADDED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasAdded() {
  if (isStandalone()) return true;
  try {
    return localStorage.getItem(ADDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function armTransferKey() {
  try {
    const key = getAccountKey();
    if (!key) return;
    const url = `${window.location.pathname}${window.location.search}#key=${encodeURIComponent(key)}`;
    window.history.replaceState(null, "", url);
  } catch {
    /* ignore */
  }
}

export function disarmTransferKey() {
  try {
    if (!window.location.hash.startsWith("#key=")) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  } catch {
    /* ignore */
  }
}

/** How to do it by hand, for every browser without an install api. */
export function addByHandText() {
  return isIos()
    ? "tap the share button at the bottom of safari, then “add to home screen”."
    : "open your browser menu, then “install app” or “add to home screen”.";
}
