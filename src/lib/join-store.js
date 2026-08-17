export const SCAN_EMAIL_KEY = "yom_scan_email";
export const YOM_READY_KEY = "yom_ready";

export function loadJoinEmail() {
  try {
    return localStorage.getItem(SCAN_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function saveJoinEmail(email) {
  try {
    localStorage.setItem(SCAN_EMAIL_KEY, String(email || "").trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function isYomReady() {
  try {
    return localStorage.getItem(YOM_READY_KEY) === "1" && Boolean(loadJoinEmail());
  } catch {
    return false;
  }
}

export function markYomReady() {
  try {
    localStorage.setItem(YOM_READY_KEY, "1");
  } catch {
    /* ignore */
  }
}
