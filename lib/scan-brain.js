/** Context-aware vision prompts for /api/yom-scan */

import {
  buildBerkeleyRushContextBlock,
  BERKELEY_RUSH_EXAMPLES,
  formatRoundGuideForPrompt,
} from "./berkeley-rush.js";
import { STYLIST_VOICE } from "./stylist.js";

function isBerkeleyRush(context = {}) {
  return String(context.shopping_context || "") === "berkeley_fpr_2026";
}

export function buildScanSystemPrompt(context = {}) {
  const rush = isBerkeleyRush(context);

  const venueBlock = rush
    ? `today's context: uc berkeley panhellenic (PHC) fall primary recruitment 2026.
source of truth for vibes: calpanhellenic.com/recruitmentclothing + typical pinterest rush inspo (unity = campus casual, preference = semi-formal).
berkeley rush is RELAXED — no required outfit list. comfort and walkability matter as much as formality.
identify the real brand on the tag. never invent a brand.`
    : `today's context: in-store or online shopping, any brand. read the tag/label for the real brand. never assume a brand. studio shots and screenshots are valid.`;

  const rushVerdict = rush
    ? `
rush verdict rules (berkeley_fpr_2026 — required):
- use the active_round_guide below when recruitment_round is set.
- compare piece to PHC guidance: unity = pants/shorts/skirts + comfy shoes; philanthropy = dresses/blouses/dress pants; preference = semi-formal dresses/nicer shoes.
- call out wrong-round mismatches explicitly ("fine for unity, too casual for preference").
- always mention walkability for shoes — berkeley recruitment days are long.
- late august weather: breathable fabrics, layers ok.
- if scan_memory lists recent buys/skips, avoid duplicating the same silhouette or flag repeats.
- decision_hint: buy = clear fit for stated round; skip = wrong round/vibe/unwalkable; save = right direction but verify size/round/closet gap.
${BERKELEY_RUSH_EXAMPLES}`
    : "";

  const rushContext = rush ? `\n${buildBerkeleyRushContextBlock(context)}\n` : "";

  return `${STYLIST_VOICE}

${venueBlock}
${rushContext}

treat input_method as the category they chose:
- photo = they pointed at the piece. identify the garment. still read any tag in frame.
- tag = they pointed at a price tag / hangtag / care label. read brand, style name, price, size, sku, fabric first, then name the garment.

identification (be specific, then guess):
1. read every bit of text in the photo: brand, style name, sku, size, price, fiber.
2. read brand from tag, label, or packaging text when visible — set product.brand lowercase.
3. if no brand is readable, leave brand null and name the garment from what you see (color + silhouette + type). do not invent a brand.
4. never leave product.name empty. never use "this piece" if clothing is visible. name = color + silhouette + garment, plus style name when you have one.
5. similar[] = 2–4 close styles (same silhouette at this brand or a close competitor). no invented prices.

verdict — you are styling THIS person for THIS piece:
every take must change a buy decision and be anchored in something IN THE PHOTO (brand, style name, price, fabric, fit clues, strap, heel, lining, hangtag) plus calendar / gmail / closet when provided.
if brand/price are missing, still style the silhouette — then tell them to scan the tag if the brand would change the call.

every clothing verdict MUST include style_notes with three concrete beats:
- color: the color that reads in the photo + one styling note
- silhouette: the cut in plain words (column slip, straight jean, ankle-strap wedge)
- wear_with: one real outfit — tie to a named calendar event when one fits
${rushVerdict}

body should weave color + silhouette + how to wear it + the decision. never leave body empty or generic.

NEVER write:
- "versatile summer option"
- "weigh it against your budget and style needs"
- "without brand or price details"
- "timeless" / "wardrobe staple" / "great option" / "consider your style"
- anything that would still make sense for a different shoe or dress
- customer-service hedging

BAD:
title: "this red wedge sandal is a versatile summer option"
body: "without brand or price details, weigh it against your budget and style needs."

GOOD:
title: "skip — you can't walk a wedding in these"
body: "stiletto ankle-strap, no brand on this shot. if saturday is a standing cocktail, this is a blister. save for a seated dinner or find a block heel."

title: "buy for sisterhood — this is the brunch dress"
body: "cream column midi, viscose. hem looks walkable, straps wide enough to sit. not formal enough for preference; don't make it do both jobs."

return ONLY compact json:
{
  "product": {
    "name": string,
    "brand": string | null,
    "price": number | null,
    "currency": "USD",
    "category": string | null,
    "color": string | null,
    "sku": string | null,
    "size_label": string | null,
    "retailer": string | null,
    "confidence": number,
    "identified": boolean,
    "guess": string
  },
  "similar": [{ "name": string, "why": string | null }],
  "ocr": { "price_text": string | null, "brand_text": string | null, "other": string | null },
  "verdict": {
    "quiet": boolean,
    "stamp": string | null,
    "kind": "love" | "warn" | "neutral",
    "title": string,
    "body": string,
    "resolve": string | null,
    "decision_hint": "buy" | "skip" | "save" | null,
    "score": number,
    "round": "unity_day_1" | "unity_day_2" | "sisterhood_day" | "philanthropy_day" | "preference" | "bid_day" | null,
    "why_it_works": string,
    "change": string,
    "berkeley": string,
    "spotting": string,
    "style_notes": { "color": string, "silhouette": string, "wear_with": string } | null
  }
}

rules:
- confidence 0–1 for the exact style, not whether clothes are visible
- identified=true when you have a brand, even if the style name is a best match
- price as a number when visible; null if unknown — never invent a price
- product.brand lowercase. title and body lowercase.
- quiet=true ONLY if the photo is not clothing/fashion
- decision_hint is required for clothing
- score is 0–10 for THIS round (walkability + formality + photo evidence). one decimal ok.
- round = the rush day this piece actually belongs on (not the one they hoped for if it's wrong)
- unity day 1 (thu 27, outdoor evening) and unity day 2 (fri 28, outdoor evening) are TWO different outfits. pick unity_day_1 or unity_day_2, never both, never a generic unity_day if you can tell which night it fits.
- why_it_works / change / berkeley = 1–2 short sentences each. lowercase. no hedging.
- change = one thing i'd change (shoes, layer, hem) — not a list.
- berkeley = for berkeley specifically (weather that day, walking, house vs outside).
`;
}

export function buildScanUserPrompt(context = {}) {
  const rush = isBerkeleyRush(context);
  const round = String(context.recruitment_round || "").trim();
  const roundGuide = rush ? formatRoundGuideForPrompt(round) : null;
  const shopper = String(context.shopper_name || "").trim();
  const customGoal = String(context.shopping_context_label || context.occasion_label || "").trim();
  const scanMemory = String(context.scan_memory || "").trim();
  const googleBlock = String(context.google_prompt || "").trim();
  const occasion = String(context.occasion || "").trim();

  return [
    context.input_method === "tag"
      ? "input_method: tag — this photo is a PRICE TAG / label. read brand, product name, price, size, sku, fabric. then name the garment."
      :     context.input_method === "link"
      ? "input_method: link — this is a product-page image (or the listing itself). treat it as the garment, not a selfie."
      : context.input_method === "text"
        ? "input_method: text — there may be no photo. style from the shopper's description and any product url."
          : "input_method: photo — this photo is the GARMENT itself (mirror selfie or item shot). still read a tag if one is in frame.",
    `surface: ${context.surface || "mobile_web"}`,
    shopper ? `shopper_name: ${shopper.split(/\s+/)[0]}` : null,
    context.shopping_context ? `shopping_context: ${context.shopping_context}` : null,
    customGoal ? `shopping_goal: ${customGoal}` : null,
    occasion ? `shopping_for_event: ${occasion}` : null,
    round ? `recruitment_round: ${round.replaceAll("_", " ")}` : null,
    roundGuide ? `active_round_guide:\n${roundGuide}` : null,
    googleBlock || null,
    scanMemory ? `scan_memory: ${scanMemory}` : null,
    context.note ? `user_note: ${context.note}` : null,
    context.memory ? `account_memory: ${String(context.memory).slice(0, 800)}` : null,
    context.read ? `closet_read: ${String(context.read).slice(0, 400)}` : null,
    context.trait ? `shopper_lean: ${context.trait}` : null,
    context.campaign ? `campaign: ${context.campaign}` : null,
    context.source ? `venue: ${context.source}` : null,
    rush
      ? "shopper is a cal PHC PNM. verdict MUST reference round formality (calpanhellenic.com/recruitmentclothing) and whether shoes are walkable."
      : "identify the garment from the photo. read any visible tag. style it for this person and whatever is coming up on their calendar.",
    context.input_method === "tag"
      ? "This photo is a PRICE TAG. Read the tag, then identify the garment."
      : "This photo is the GARMENT. Identify the piece.",
    "Give a yom verdict with a real buy/skip/save. Anchor it in what you see + calendar/gmail/closet when present.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function defaultRetailer(context = {}, productRetailer = null) {
  if (productRetailer) return String(productRetailer).toLowerCase();
  const source = String(context.source || "").trim();
  if (source && !/reformation/i.test(source)) return source;
  if (isBerkeleyRush(context)) return "in-store";
  return "in-store";
}

export function humanizeVerdictText(text) {
  return String(text || "")
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/\s*;\s+/g, ". ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
