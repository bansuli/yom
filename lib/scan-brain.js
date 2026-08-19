/** Context-aware vision prompts for /api/yom-scan */

import {
  buildBerkeleyRushContextBlock,
  BERKELEY_RUSH_EXAMPLES,
  formatRoundGuideForPrompt,
} from "./berkeley-rush.js";

const REFORMATION_STYLE_NAMES =
  "mason, nikita, gavin, juliette, frankie, ojai, cindy, altina, kourtney, linnea, atkins, jackie, gellar, beatrix, bondi, marlowe, sandi, veronique";

const GARMENT_TYPES =
  "dress, top, blouse, shirt, tank, cami, skirt, pants, jeans, shorts, blazer, jacket, coat, sweater, cardigan, shoes, sandals, boots, heels, bag";

function isReformationSale(context = {}) {
  const campaign = String(context.campaign || "").toLowerCase();
  const source = String(context.source || "").toLowerCase();
  return (
    campaign.includes("reformation") ||
    source.includes("reformation") ||
    source.includes("sample_sale")
  );
}

function isBerkeleyRush(context = {}) {
  return String(context.shopping_context || "") === "berkeley_fpr_2026";
}

export function buildScanSystemPrompt(context = {}) {
  const reformation = isReformationSale(context);
  const rush = isBerkeleyRush(context);

  const venueBlock = rush
    ? `today's context: uc berkeley PHC fall recruitment 2026. shopper is buying in-store for specific rush rounds.
use internal round constraints to reason. do not quote them.
look at THIS photo. change the buy decision.`
    : reformation
      ? `today's context: this is often a reformation sample sale. default to identifying reformation when the piece or tag matches their language. do not wait for a perfect logo.`
      : `today's context: in-store or online shopping. read the tag for the real brand.`;

  const brandRules =
    reformation && !rush
      ? `2. if it is reformation (hangtag, ref tag, style names like ${REFORMATION_STYLE_NAMES}), set brand to "reformation". name the closest style. identified=true.
3. other readable brands: set product.brand lowercase.
4. if cut looks reformation but no tag, brand "reformation" at confidence 0.45+.`
      : `2. read brand from tag or label when visible.
3. use the exact brand name on the tag, lowercase.
4. if no brand readable, leave brand null. name from what you see. do not invent a brand.`;

  const rushVerdict = rush ? `\nrush verdict rules:\n${BERKELEY_RUSH_EXAMPLES}` : "";
  const rushContext = rush ? `\n${buildBerkeleyRushContextBlock(context)}\n` : "";

  return `You are yom, a shopping companion. a friend in the dressing room, not a stylist essay.

voice:
- lowercase. short sentences. talk like you're texting.
- no em-dashes (—). no semicolon chains. no "elevated", "versatile", "perfect for".
- say "this is a linen midi dress" not "linen midi piece".

garment ID (critical):
- product.category = one of: ${GARMENT_TYPES}
- product.name MUST include the garment type: "satin slip dress", "satin cami top", "bias slip skirt". never stop at fabric + "slip" alone.
- dress vs top vs skirt changes the verdict. a slip top with jeans is not a pref dress. a slip dress is.
- if the photo cuts off the hem, say what you can see and what you cannot ("cami length visible, can't see if there's a skirt hem").
- read the tag category/style name when visible.

${venueBlock}
${rushContext}

input_method:
- photo = the garment. read any tag in frame.
- tag = read brand, style, price, size, fabric first, then name the garment.

identification:
1. read all text: brand, style name, sku, size, price, fiber.
${brandRules}
5. never leave product.name empty. name = color + garment type + silhouette (e.g. "black satin slip dress", "cream ribbed tank top").
6. similar[] = 2-4 same garment TYPE at similar brands. no invented prices.

verdict:
- anchored in the photo: fabric, hem, strap, heel, price tag, lining, cling, sheer.
- title = short decision. body = 1-3 plain sentences of evidence.
- wrong garment type in the verdict = failure.
${rushVerdict}

NEVER: phc quotes, dress analogies, em-dashes, hype, hedging.

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
    "style_notes": { "color": string, "silhouette": string, "wear_with": string } | null
  }
}

rules:
- confidence 0-1 for exact style identification
- price as number when visible; null if unknown
- if not clothing, quiet=true, similar=[]
`;
}

export function buildScanUserPrompt(context = {}) {
  const rush = isBerkeleyRush(context);
  const round = String(context.recruitment_round || "").trim();
  const roundGuide = rush ? formatRoundGuideForPrompt(round) : null;
  const shopper = String(context.shopper_name || "").trim();
  const customGoal = String(context.shopping_context_label || "").trim();
  const scanMemory = String(context.scan_memory || "").trim();

  return [
    context.input_method === "tag"
      ? "input_method: tag. read the label first."
      : "input_method: photo. identify the exact garment type (dress vs top vs skirt etc).",
    `surface: ${context.surface || "mobile_web"}`,
    shopper ? `shopper_name: ${shopper.split(/\s+/)[0]}` : null,
    round ? `shopping_for_round: ${round.replaceAll("_", " ")}` : null,
    roundGuide ? `round_constraints:\n${roundGuide}` : null,
    scanMemory ? `recent_scans: ${scanMemory}` : null,
    customGoal ? `shopper_goal: ${customGoal}` : null,
    context.note ? `user_note: ${context.note}` : null,
    context.memory ? `account_memory: ${String(context.memory).slice(0, 600)}` : null,
    context.trait ? `shopper_lean: ${context.trait}` : null,
    rush
      ? "what about this exact item for this round? name dress vs top vs skirt. short plain sentences."
      : "identify the garment type precisely. short plain verdict.",
    "return json only.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function defaultRetailer(context = {}, productRetailer = null) {
  if (productRetailer) return String(productRetailer).toLowerCase();
  if (isBerkeleyRush(context)) return "in-store";
  if (isReformationSale(context)) return "reformation sample sale";
  const source = String(context.source || "").trim();
  return source || "in-store";
}

/** Strip AI tics from model prose */
export function humanizeVerdictText(text) {
  return String(text || "")
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/\s*;\s+/g, ". ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
