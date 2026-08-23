/**
 * UC Berkeley PHC FPR 2026 — internal context for scan prompts.
 * Schedule/analogies inform reasoning; never quote them back to the shopper.
 * Pinterest: https://pin.it/5slpgAzHQ
 */

export const BERKELEY_RUSH_SEASON = "fall primary recruitment 2026";
export const PHC_PINTEREST = "https://pin.it/5slpgAzHQ";

export const FPR_SCHEDULE_2026 = [
  { id: "orientation", when: "Wed Aug 26 · 6:00–8:45 PM" },
  { id: "unity_day_1", when: "Thu Aug 27 · 5:30–10:30 PM" },
  { id: "unity_day_2", when: "Fri Aug 28 · 4:30–11:00 PM" },
  { id: "sisterhood_day", when: "Sat Aug 29 · 9:20 AM–8:45 PM" },
  { id: "philanthropy_day", when: "Sun Aug 30 · 9:20 AM–7:00 PM" },
  { id: "preference", when: "Mon Aug 31 · 6:00–11:30 PM" },
  { id: "bid_day", when: "Tue Sep 1 · 6:00 PM" },
];

/**
 * What yom should actually evaluate per round — not PHC copy to repeat.
 * formality: 1 (casual) → 5 (most formal)
 */
export const ROUND_CONSTRAINTS = {
  orientation: {
    label: "orientation",
    when: "Wed Aug 26 · 6:00–8:45 PM",
    formality: 1,
    duration: "~3 hours standing indoors",
    evaluate: [
      "don't recommend buying anything special — they already own something fine",
      "if they scanned anyway: comfort over style",
    ],
  },
  unity_day: {
    label: "unity (pick one night)",
    when: "Thu Aug 27 evening or Fri Aug 28 evening — not both",
    formality: 2,
    duration: "5+ hours walking between houses",
    evaluate: [
      "hem: campus-appropriate sitting and walking",
      "shoes: flat or low — can they do 5 hours without blisters. running trainers / gym shoes = skip, score under 4.5",
      "fabric: late-august berkeley — breathable, not heavy linen that wrinkles",
      "unity 1 and unity 2 are different outfits — never recommend this piece for both nights",
      "too dressy = skip for unity; too sloppy = fine for unity but note pref needs something else",
    ],
  },
  unity_day_1: {
    label: "unity day 1",
    when: "Thu Aug 27 · 5:30–10:30 PM",
    formality: 2,
    duration: "5+ hours walking between houses, outdoor/campus",
    evaluate: [
      "this is THURSDAY only — do not also assign it to friday/unity 2",
      "hem: campus-appropriate sitting and walking",
      "shoes: flat or low — can they do 5 hours without blisters. running trainers / gym shoes = skip, score under 4.5",
      "fabric: late-august berkeley — breathable",
    ],
  },
  unity_day_2: {
    label: "unity day 2",
    when: "Fri Aug 28 · 4:30–11:00 PM",
    formality: 2,
    duration: "5+ hours walking between houses, outdoor/campus",
    evaluate: [
      "this is FRIDAY only — do not also assign it to thursday/unity 1",
      "can be a different silhouette/color from thursday — they need two looks",
      "hem: campus-appropriate sitting and walking",
      "shoes: flat or low — can they do 5 hours without blisters. running trainers / gym shoes = skip, score under 4.5",
    ],
  },
  sisterhood_day: {
    label: "sisterhood",
    when: "Sat Aug 29 · 9:20 AM–8:45 PM",
    formality: 3,
    duration: "11+ hours — longest day of rush",
    evaluate: [
      "shoes: non-negotiable walk/stand test — block heel max unless clearly padded. running trainers = skip",
      "straps: armhole and strap width for hours of sitting on couches",
      "sheer or tight: call out if fabric reads see-through under daylight",
      "wrinkles: linen/crêpe that crushes by afternoon",
      "must read more polished than unity but not pref — compare formality to what you see",
      "different silhouette from unity if scan_memory shows similar piece already",
    ],
  },
  philanthropy_day: {
    label: "philanthropy",
    when: "Sun Aug 30 · 9:20 AM–7:00 PM",
    formality: 3,
    duration: "full day on feet",
    evaluate: [
      "prints and color ok — judge if print clashes or reads juvenile vs intentional",
      "step up from sisterhood: dress/trousers/blouse level, not unity shorts",
      "still not pref — flag if too cocktail or too casual",
      "shoe test for 10-hour day",
    ],
  },
  preference: {
    label: "preference",
    when: "Mon Aug 31 · 6:00–11:30 PM",
    formality: 5,
    duration: "evening, mostly seated conversations — emotional, low movement",
    evaluate: [
      "most formal piece of the week — compare to what they're holding",
      "hem and neckline: sitting on low couches for hours — too short rides up",
      "fabric: satin/silk clings and shows sweat; structured crepe often safer",
      "heels: lower is fine if dressy — they'll sit more than walk",
      "too casual = wrong round; perfect pref piece = say which earlier round it's wasted on",
    ],
  },
  bid_day: {
    label: "bid day",
    when: "Tue Sep 1 · 6:00 PM",
    formality: 1,
    duration: "short, outdoor/campus celebration",
    evaluate: [
      "chapter tee goes over whatever — don't recommend buying a dress",
      "only advise on shorts/jeans/sneakers if they scanned bottoms or shoes",
    ],
  },
};

export function getRoundConstraints(roundId) {
  return ROUND_CONSTRAINTS[String(roundId || "").trim()] || null;
}

/** Compact internal brief — no PHC marketing copy */
export function formatRoundGuideForPrompt(roundId) {
  const c = getRoundConstraints(roundId);
  if (!c) return null;
  return [
    `shopper_round: ${c.label}`,
    `when: ${c.when}`,
    `formality_level: ${c.formality}/5`,
    `wear_duration: ${c.duration}`,
    `evaluate_this_photo: ${c.evaluate.join(" | ")}`,
  ].join("\n");
}

export function buildBerkeleyRushContextBlock(context = {}) {
  const round = String(context.recruitment_round || "").trim();
  const roundBlock = formatRoundGuideForPrompt(round);
  const schedule = FPR_SCHEDULE_2026.map((r) => `${r.id}: ${r.when}`).join("; ");
  const lines = [
    `context: berkeley PHC FPR 2026 (${schedule})`,
    "formality rises each round. unity is 2 evenings with TWO different outfits — never reuse thursday's look on friday.",
    "use schedule for timing/wear-length reasoning only — never quote PHC, pinterest, or dress analogies to the shopper.",
  ];
  if (roundBlock) lines.push("active_round:", roundBlock);
  else lines.push("no round selected — still judge walkability, hem, and formality from the photo.");
  const custom = String(context.shopping_context_label || "").trim();
  if (custom) lines.push(`shopper_note: ${custom}`);
  return lines.join("\n");
}

export const RUSH_SCORE_RUBRIC = `
score rubric (0–10) — accuracy to the TARGET ROUND dress code, not general cuteness:
- 9–10: standout for that round — dress code perfect AND polished, intentional, put-together
- 7–8.8: solid buy — correct for the round, looks intentional, maybe one small fix
- 5–6.9: technically passes the dress code but plain, safe, or forgettable — fine for unity, not a win; OR cute but wrong round; OR one major miss dragging an otherwise ok look
- 3–4.9: clearly wrong for the round (running trainers, pref-level dress at unity, shorts at preference)
- 0–2.9: not wearable for rush

when scan_mode=outfit: score the FULL LOOK against the round's formality_level and evaluate list.
- a plain but correct unity look (meets minimum, nothing special) scores 5–6 — it's acceptable, not a strong buy.
- only score 7+ when the look is correct AND clearly intentional/polished for that round.
- a cute outfit too casual for preference scores ~5–6, not 8.
- the weakest piece caps the outfit — gym shoes cap the whole look ≤4.5 regardless of how cute the top is.
- if no round selected, infer the best-matching round and score against THAT round's dress code; say which round in verdict.round.
`;

export const BERKELEY_RUSH_EXAMPLES = `
RUSH VERDICT RULES:
- title = the decision. short. no em-dashes.
- body = 1-3 short sentences. evidence from the photo only.
- name the exact garment type in title and body: slip dress vs slip top vs cami vs skirt matters. never say "slip" alone if you can see length.
- if hem is cut off in the photo, say "looks like a top from this angle" or "midi dress" from what is visible. do not guess dress when it might be a top.
- NEVER quote PHC, pinterest, or dress analogies.

GOOD (sisterhood, linen midi dress):
title: "linen will crush by 2pm"
body: "this is a linen midi dress. fine at 9am, wrinkled by afternoon. you are on your feet all day saturday. cotton blend holds better."

GOOD (unity, running trainers):
title: "skip — running trainers aren’t a rush shoe"
body: "these are gym runners. walkable is not the test. you need a flat, sandal, or fashion sneaker — not a training shoe."

GOOD (pref, satin slip top not dress):
title: "top not a pref look"
body: "satin slip cami with jeans on the rack. that is a top, not a dress. fine tucked into trousers for phil. too casual for pref unless you pair a full skirt."

GOOD (pref, satin slip dress):
title: "pref if the hem hits mid-calf"
body: "satin slip dress, bias cut. hem looks midi from here. pref is mostly sitting so check it on a couch before you buy."

GOOD (outfit, cute but wrong round for pref):
title: "cute — but this is sisterhood not pref"
body: "cream tank, wide jeans, white samba. cohesive and campus-correct for unity or sisterhood. too casual for preference — you'd need a dress or tailored set."
score: ~6.2 for preference round

GOOD (outfit, plain but correct unity):
title: "fine for unity — not a standout"
body: "linen tank, midi skirt, flat sandals. passes the dress code and the walk test but reads safe, not polished. save your money unless you still need a backup look."
score: ~5.5 for unity_day_1

GOOD (wrong round):
title: "save for pref"
body: "structured crepe midi dress. too dressed up for unity thu night. good if you still need a monday pref look."

BAD (vague garment):
title: "satin slip for pref"
body: "satin slip is formal enough for preference night."

BAD (ai voice):
title: "elevated yet comfortable — perfect for sisterhood"
body: "this versatile piece — with its breathable fabric — could work across multiple rounds."

BAD (parroting):
title: "brunch with friends vibe"
body: "PHC says sisterhood is like brunch with friends."
`;

/** Patterns that mean the model parroted guidelines or sounds like generic AI */
export const RUSH_PARROT =
  /first day of school|brunch with friends|nice dinner|formal occasion|phc says|pinterest|unity energy|pref-ready|brunch-level|nice-dinner|dress more formally each|cal panhellenic|recruitment clothing|elevated yet|perfect for recruitment|versatile piece|could work across/i;
