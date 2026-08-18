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
  { id: "orientation", label: "orientation" },
  { id: "unity_day", label: "unity day" },
  { id: "sisterhood_day", label: "sisterhood day" },
  { id: "philanthropy_day", label: "philanthropy day" },
  { id: "preference", label: "preference" },
  { id: "bid_day", label: "bid day" },
];

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
