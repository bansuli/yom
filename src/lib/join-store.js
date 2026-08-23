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

/** Local-only skip for `/scan?test=1` etc. Does not send a lead. */
export function seedTestYom() {
  saveJoinEmail("test@youryom.com");
  saveJoinProfile({
    name: "test",
    email: "test@youryom.com",
    context: "berkeley_fpr_2026",
  });
  markYomReady();
}

export function unlockIfTest(search = typeof window !== "undefined" ? window.location.search : "") {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    if (q.get("test") !== "1") return isYomReady();
    seedTestYom();
    return true;
  } catch {
    return isYomReady();
  }
}

/** Forget who is signed in here. Her yom itself lives on her account, not here. */
export function clearJoinLocal() {
  for (const key of [SCAN_EMAIL_KEY, YOM_READY_KEY, YOM_PROFILE_KEY, LAST_CHECK_KEY, "yom-survey"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function saveJoinProfile({
  name = "",
  trait = "",
  email = "",
  context = "general_shopping",
  contextOther = "",
  round = "",
  occasion = "",
} = {}) {
  try {
    localStorage.setItem(
      YOM_PROFILE_KEY,
      JSON.stringify({
        name: String(name || "").trim(),
        trait: String(trait || "").trim(),
        email: String(email || loadJoinEmail() || "")
          .trim()
          .toLowerCase(),
        context: String(context || "general_shopping").trim(),
        contextOther: String(contextOther || "").trim(),
        round: String(round || "").trim(),
        occasion: String(occasion || "").trim(),
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
        context: survey.context || "general_shopping",
        contextOther: survey.contextOther || "",
        round: survey.round || "",
        occasion: survey.occasion || "",
      };
    }
  } catch {
    /* ignore */
  }
  return { name: "", trait: "", email: loadJoinEmail(), context: "general_shopping", contextOther: "", round: "", occasion: "" };
}

export const LAST_CHECK_KEY = "yom_last_check";

export function saveLastCheck(check = {}) {
  try {
    const preview = typeof check.preview === "string" && check.preview.startsWith("data:image/")
      ? check.preview.length <= 900_000
        ? check.preview
        : ""
      : "";
    localStorage.setItem(
      LAST_CHECK_KEY,
      JSON.stringify({
        product: check.product || {},
        verdict: check.verdict || {},
        similar: Array.isArray(check.similar) ? check.similar.slice(0, 4) : [],
        preview,
        mode: check.mode === "tag" ? "tag" : "photo",
        share_id: check.share_id ? String(check.share_id).slice(0, 36) : "",
        at: check.at || Date.now(),
      })
    );
  } catch {
    /* ignore quota */
  }
}

export function loadLastCheck() {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
