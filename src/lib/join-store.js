export const SCAN_EMAIL_KEY = "yom_scan_email";
export const YOM_READY_KEY = "yom_ready";
export const YOM_PROFILE_KEY = "yom_join_profile";

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

export function saveJoinProfile({ name = "", trait = "", email = "" } = {}) {
  try {
    localStorage.setItem(
      YOM_PROFILE_KEY,
      JSON.stringify({
        name: String(name || "").trim(),
        trait: String(trait || "").trim(),
        email: String(email || loadJoinEmail() || "")
          .trim()
          .toLowerCase(),
        savedAt: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

export function loadJoinProfile() {
  try {
    const raw = localStorage.getItem(YOM_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* ignore */
  }
  try {
    const survey = JSON.parse(localStorage.getItem("yom-survey") || "null");
    if (survey && typeof survey === "object") {
      return {
        name: survey.name || "",
        trait: survey.trait || "",
        email: survey.email || loadJoinEmail(),
      };
    }
  } catch {
    /* ignore */
  }
  return { name: "", trait: "", email: loadJoinEmail() };
}
