const KEY = "yom-survey";

const TRAIT_IDS = {
  "i buy things i never wear": "impulse",
  "i always think i have nothing to wear": "nothing",
  "i panic before trips & events": "panic",
  "i spend forever deciding what to buy": "decide",
};

const PRE_BUY_IDS = {
  "i ask my friends": "friends",
  "i scroll pinterest or tiktok": "feed",
  "i compare 20 websites": "research",
  "i just wing it": "wing",
};

function itemName(item) {
  if (!item) return "";
  if (item.type === "describe") return String(item.value || "").slice(0, 180);
  if (item.type === "link-preview") return String(item.value?.title || item.value?.url || "linked piece").slice(0, 180);
  if (item.type === "photo") return "uploaded piece";
  return "";
}

function itemHref(item) {
  if (item?.type === "link-preview") return String(item.value?.url || "").slice(0, 500);
  return "";
}

function itemImage(item) {
  if (item?.type === "link-preview") return item.value?.image || "";
  return "";
}

export function surveyPayload({
  userName,
  email,
  selectedTrait,
  selectedPreBuy,
  q4item,
  q4whySelected,
  q6item,
  q6whySelected,
  read,
  headline,
}) {
  const closet = [];
  const loved = itemName(q4item);
  if (loved) {
    closet.push({
      item: loved,
      kept: true,
      note: (q4whySelected || []).join(", "),
      href: itemHref(q4item),
      image_url: itemImage(q4item),
    });
  }
  const regretted = itemName(q6item);
  if (regretted) {
    closet.push({
      item: regretted,
      kept: false,
      note: (q6whySelected || []).join(", "),
      return_reason: (q6whySelected || [])[0] || "",
      href: itemHref(q6item),
      image_url: itemImage(q6item),
    });
  }
  return {
    name: String(userName || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    trait: TRAIT_IDS[selectedTrait] || "",
    preBuy: PRE_BUY_IDS[selectedPreBuy] || "",
    read: read || "",
    headline: headline || "",
    closet,
  };
}

export function saveSurvey(payload) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch {
    /* quota */
  }
}

export function loadSurvey() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSurvey() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
