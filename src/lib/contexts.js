/** Only users who tap this option get recruitment copy, rounds, and cohort tagging. */
export const BERKELEY_FPR_CONTEXT_ID = "berkeley_fpr_2026";
export const OTHER_CONTEXT_ID = "other";

export const SHOPPING_CONTEXTS = [
  {
    id: "general_shopping",
    label: "everyday shopping",
    source: "organic",
    campaign: "general_2026",
  },
  {
    id: BERKELEY_FPR_CONTEXT_ID,
    label: "uc berkeley sorority recruitment",
    source: "berkeley_flyer",
    campaign: "berkeley_fpr_2026",
  },
  {
    id: OTHER_CONTEXT_ID,
    label: "other",
    source: "organic",
    campaign: "general_2026",
  },
];

export const RECRUITMENT_ROUNDS = [
  {
    id: "orientation",
    label: "orientation",
    hint: "Wed Aug 26 · info night — don't buy anything special",
  },
  {
    id: "unity_day",
    label: "unity day (Thu + Fri)",
    hint: "Aug 27–28 evenings · casual, walkable shoes for 5+ hrs",
  },
  {
    id: "sisterhood_day",
    label: "sisterhood day",
    hint: "Sat Aug 29 · 9 AM–9 PM · fabric + shoes matter most",
  },
  {
    id: "philanthropy_day",
    label: "philanthropy day",
    hint: "Sun Aug 30 · full day · step up from unity, not pref-level",
  },
  {
    id: "preference",
    label: "preference night",
    hint: "Mon Aug 31 · dressiest — hem when sitting matters",
  },
  {
    id: "bid_day",
    label: "bid day",
    hint: "Tue Sep 1 · chapter tee — skip buying a dress",
  },
];

/** Official FPR 2026 schedule for UI reference */
export const FPR_SCHEDULE_2026 = [
  { id: "orientation", label: "FPR Orientation", when: "Wed Aug 26 · 6:00–8:45 PM" },
  { id: "unity_day", label: "Unity Day 1", when: "Thu Aug 27 · 5:30–10:30 PM" },
  { id: "unity_day", label: "Unity Day 2", when: "Fri Aug 28 · 4:30–11:00 PM" },
  { id: "sisterhood_day", label: "Sisterhood Day", when: "Sat Aug 29 · 9:20 AM–8:45 PM" },
  { id: "philanthropy_day", label: "Philanthropy Day", when: "Sun Aug 30 · 9:20 AM–7:00 PM" },
  { id: "preference", label: "Preference Night", when: "Mon Aug 31 · 6:00–11:30 PM" },
  { id: "bid_day", label: "Bid Day", when: "Tue Sep 1 · 6:00 PM" },
];

export const PHC_PINTEREST_URL = "https://pin.it/5slpgAzHQ";

export function isBerkeleyRecruitmentContext(contextId) {
  return contextId === BERKELEY_FPR_CONTEXT_ID;
}

export function isOtherContext(contextId) {
  return contextId === OTHER_CONTEXT_ID;
}

export function getContextById(contextId) {
  return SHOPPING_CONTEXTS.find((c) => c.id === contextId) || SHOPPING_CONTEXTS[0];
}

/** Pre-select from saved profile or flyer QR hint — never default everyone to rush. */
export function initialShoppingContext(search = "") {
  try {
    const saved = localStorage.getItem("yom_join_profile");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.context === BERKELEY_FPR_CONTEXT_ID) return BERKELEY_FPR_CONTEXT_ID;
      if (parsed?.context === "general_shopping") return "general_shopping";
      if (parsed?.context === OTHER_CONTEXT_ID) return OTHER_CONTEXT_ID;
    }
  } catch {
    /* ignore */
  }
  const hint = new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("context");
  if (hint === BERKELEY_FPR_CONTEXT_ID) return BERKELEY_FPR_CONTEXT_ID;
  return "";
}
