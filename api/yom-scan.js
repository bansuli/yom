import { bearer, json, preflight, readJson } from "../lib/http.js";
import { mergeDetailsIntoVerdict } from "../lib/scan-details.js";
import { accountFromToken } from "../lib/profile.js";
import { supabaseConfigured } from "../lib/supabase.js";

export const config = { maxDuration: 60 };

const SYSTEM = `You are yom, a shopping companion. the user photographed a clothing item or a price tag (in-store, at home, or a product screenshot). studio shots and screenshots on white / light backgrounds are valid.

today's context: this is often a reformation sample sale. default to identifying reformation when the piece or tag matches their language — do not wait for a perfect logo.

treat input_method as the category they chose:
- photo = they pointed at the piece. identify the garment. still read any tag in frame.
- tag = they pointed at a price tag / hangtag / care label. read brand, style name, price, size, sku, fabric first, then name the garment.

identification (be specific, then guess):
1. read every bit of text in the photo: brand, style name, sku, size, price, fiber.
2. if it is reformation — hangtag that says reformation / ref / made for reformation, their cream/black tag, style-name tags (mason, nikita, gavin, juliette, frankie, ojai, cindy, altina, kourtney, linnea, atkins, jackie, gellar, beatrix, bondi, marlowe, sandi, veronique), viscose/bias slip, vintage-inspired column, linen set — set brand to "reformation". name the closest style. identified=true.
3. other readable brands (agolde, ganni, staud, khaite, the row, levis, etc.) — set product.brand to that name, lowercase.
4. if you cannot read a brand but the cut is clearly reformation, still set brand "reformation" and put the closest style in name. identified can be true at confidence 0.45+.
5. never leave product.name empty. never use "this piece" if clothing is visible. name = color + silhouette + garment, plus style name when you have one.
6. similar[] = 2–4 close styles (other reformation names or the same silhouette at another brand). no invented prices.

verdict — this is the product, not a caption:
every take must change a buy decision and be anchored in something IN THE PHOTO (brand, style name, price, leather vs cork, strap, heel, lining, hangtag) or a close cousin they can compare.
if brand/price are missing, say what it looks like and tell them to scan the tag. do not narrate the missing info.

every clothing verdict MUST include style_notes with three concrete beats:
- color: the color that reads in the photo + one styling note (e.g. "black — reads sharp, shows lint")
- silhouette: the cut/silhouette in plain words (column slip, straight jean, ankle-strap wedge)
- wear_with: one outfit combo or occasion ("with strappy sandals and a small bag for dinner")

body should weave color + silhouette + how to wear it. never leave body empty or generic.

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
title: "red wedge — no brand on this shot"
body: "ankle-strap leather wedge. closest: reformation wedge, ancient greek sandals. scan the insole or hangtag."

GOOD:
title: "walk in these"
body: "that wedge looks steep and the strap sits low. cork showing through the sole will mark."

title = the takeaway (short). body = the evidence. lowercase. no emoji. no hype.

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
- confidence 0–1 for the exact style, not whether clothes are visible
- identified=true when you have a brand, even if the style name is a best match
- price as a number when visible; null if unknown — never invent a price
- product.brand lowercase. title and body lowercase.
- if not clothing/fashion, quiet=true, similar=[], explain briefly
`;

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function asText(value, max = 80) {
  const s = String(value || "").trim();
  return s ? s.slice(0, max) : "";
}

function isGenericName(name) {
  return !name || /^(this piece|unknown|unidentified|n\/?a|clothing item|item|garment)$/i.test(name);
}

function normalizeSimilar(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    let name = "";
    let why = null;
    if (typeof item === "string") name = asText(item, 90);
    else if (item && typeof item === "object") {
      name = asText(item.name || item.title || item.piece, 90);
      why = asText(item.why || item.note || item.reason, 140) || null;
    }
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, why });
    if (out.length >= 4) break;
  }
  return out;
}

function visualName(product = {}) {
  const name = asText(product.name, 90);
  const guess = asText(product.guess, 90);
  if (!isGenericName(name)) return name;
  if (guess) return guess;
  const bits = [product.color, product.category].map((v) => asText(v, 40)).filter(Boolean);
  return bits.join(" ") || "this piece";
}

const COUSINS_BY_TYPE = [
  ["dress", ["sleeveless midi", "column sheath", "tank dress"]],
  ["jean", ["straight-leg denim", "cropped five-pocket jeans"]],
  ["sweater", ["crewneck knit", "fine-gauge pullover"]],
  ["cardigan", ["button-front knit", "fine-gauge cardigan"]],
  ["blazer", ["single-breasted jacket", "tailored blazer"]],
  ["jacket", ["lightweight jacket", "collar jacket"]],
  ["coat", ["long coat", "wool overcoat"]],
  ["trouser", ["tailored trousers", "straight-leg pants"]],
  ["pant", ["straight-leg pants", "tailored trousers"]],
  ["skirt", ["midi skirt", "column skirt"]],
  ["tank", ["fitted tank", "crew tank"]],
  ["shirt", ["button-down shirt", "relaxed poplin shirt"]],
  ["tote", ["structured tote", "leather shopper"]],
  ["sneaker", ["low-top sneaker", "court sneaker"]],
  ["boot", ["ankle boot", "leather boot"]],
  ["wedge", ["ankle-strap wedge", "cork wedge sandal"]],
  ["sandal", ["ankle-strap sandal", "leather wedge sandal"]],
  ["short", ["tailored shorts", "mid-length shorts"]],
];

function ensureSimilar(product, name, similar) {
  if (similar.length >= 2) return similar.slice(0, 4);
  const color = asText(product.color, 40).toLowerCase();
  const haystack = `${asText(product.category, 40)} ${name} ${asText(product.guess, 90)}`.toLowerCase();
  const extras = [];
  const guess = asText(product.guess, 90);
  if (guess && guess.toLowerCase() !== name.toLowerCase()) {
    extras.push({ name: guess, why: "closest visual read" });
  }
  const match = COUSINS_BY_TYPE.find(([key]) => haystack.includes(key));
  if (match) {
    for (const cousin of match[1]) {
      extras.push({
        name: color ? `${color} ${cousin}` : cousin,
        why: "same silhouette family",
      });
    }
  } else if (color && asText(product.category, 40)) {
    extras.push({
      name: `${color} ${asText(product.category, 40).toLowerCase()}`,
      why: "same color and type",
    });
  }
  return normalizeSimilar([...similar, ...extras]).filter(
    (item) => item.name.toLowerCase() !== name.toLowerCase()
  );
}

function salvageScan(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const product = parsed.product && typeof parsed.product === "object" ? parsed.product : {};
  const guess = asText(parsed.guess || product.guess, 90);
  if (!parsed.product && !guess && !parsed.verdict) return null;
  return {
    ...parsed,
    product: {
      ...product,
      name: product.name || guess,
      guess: guess || product.guess || null,
    },
    similar: parsed.similar || product.similar,
  };
}

const GENERIC_VERDICT =
  /versatile|weigh it against|style needs|budget and style|great option|timeless|must-have|without brand|without price|summer option|wardrobe staple|worth considering|could work|strong match|very you|good for your style|consider your|depends on your|a great addition|elevate your/i;

function usefulVerdict(product, similar, verdict = {}) {
  const title = String(verdict.title || "").toLowerCase().trim();
  const body = String(verdict.body || "").toLowerCase().trim();
  const generic = GENERIC_VERDICT.test(`${title} ${body}`) || /option$/.test(title);
  const label = [product.brand, product.name || product.guess].filter(Boolean).join(" ") || "this piece";
  const cousins = (similar || []).map((s) => s.name).filter(Boolean).slice(0, 3);
  if (!generic && title && !/^this /.test(title)) {
    return {
      quiet: Boolean(verdict.quiet),
      stamp: verdict.stamp || "id",
      kind: verdict.kind || "neutral",
      title,
      body,
      resolve: verdict.resolve ? String(verdict.resolve).toLowerCase() : null,
      decision_hint: verdict.decision_hint || null,
    };
  }
  if (!product.brand) {
    return {
      quiet: false,
      stamp: "id",
      kind: "neutral",
      title: `looks like ${label}`,
      body: cousins.length
        ? `no brand readable on this shot. closest: ${cousins.join(", ")}. scan the hangtag or insole.`
        : "no brand readable on this shot. scan the hangtag or insole — that's the read.",
      resolve: "scan the price tag next.",
      decision_hint: "save",
    };
  }
  return {
    quiet: false,
    stamp: "id",
    kind: verdict.kind === "love" || verdict.kind === "warn" ? verdict.kind : "neutral",
    title: label,
    body: cousins.length
      ? `if it's not this exact style, it's close to ${cousins.join(", ")}.`
      : "named from what we can see. scan the tag to lock the style.",
    resolve: verdict.resolve ? String(verdict.resolve).toLowerCase() : "scan the tag if you want the exact sku.",
    decision_hint: verdict.decision_hint || "save",
  };
}

function normalizeImage(image) {
  const raw = String(image || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

async function callOpenAIVision(key, imageUrl, context) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 1100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                context.input_method === "tag"
                  ? "input_method: tag — this photo is a PRICE TAG / label. read brand, product name, price, size, sku, fabric. then name the garment."
                  : "input_method: photo — this photo is the GARMENT itself. still read a tag if one is in frame.",
                `surface: ${context.surface || "mobile_web"}`,
                context.note ? `user_note: ${context.note}` : null,
                context.memory ? `memory: ${String(context.memory).slice(0, 600)}` : "memory: none",
                context.trait ? `shopper lean: ${context.trait}` : null,
                context.campaign ? `campaign: ${context.campaign}` : null,
                context.source ? `venue: ${context.source}` : "venue: reformation sample sale",
                "this is likely a reformation sample sale. name the brand and closest style. if it looks like reformation, say so.",
                context.input_method === "tag"
                  ? "This photo is a PRICE TAG. Read the tag, then identify the garment."
                  : "This photo is the GARMENT. Identify the piece.",
                "Identify the garment/tag. If you cannot name the exact product, still guess what it is and list similar pieces. Then give a yom verdict.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("openai scan", res.status, err.slice(0, 400));
    return { ok: false, error: `vision failed (${res.status})` };
  }
  const data = await res.json();
  const parsed = salvageScan(parseJson(data.choices?.[0]?.message?.content));
  if (!parsed?.product) return { ok: false, error: "could not read that photo." };
  return { ok: true, data: parsed, brain: "openai" };
}

async function callAnthropicVision(key, imageUrl, context) {
  const match = String(imageUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return { ok: false, error: "anthropic scan needs a data URL image" };
  const mediaType = match[1];
  const data = match[2];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1100,
      temperature: 0.2,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                context.input_method === "tag"
                  ? "input_method: tag — this photo is a PRICE TAG / label. read brand, product name, price, size, sku, fabric. then name the garment."
                  : "input_method: photo — this photo is the GARMENT itself. still read a tag if one is in frame.",
                `surface: ${context.surface || "mobile_web"}`,
                context.note ? `user_note: ${context.note}` : null,
                context.memory ? `memory: ${String(context.memory).slice(0, 600)}` : "memory: none",
                context.trait ? `shopper lean: ${context.trait}` : null,
                context.campaign ? `campaign: ${context.campaign}` : "campaign: reformation_monday",
                context.source ? `venue: ${context.source}` : "venue: reformation sample sale",
                "this is likely a reformation sample sale. name the brand and closest style.",
                "identify the garment/tag as json only. if you cannot name the exact product, still guess and list similar pieces.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("anthropic scan", res.status, err.slice(0, 400));
    return { ok: false, error: `vision failed (${res.status})` };
  }
  const body = await res.json();
  const text = (body.content || []).map((c) => c.text || "").join("\n");
  const parsed = salvageScan(parseJson(text));
  if (!parsed?.product) return { ok: false, error: "could not read that photo." };
  return { ok: true, data: parsed, brain: "anthropic" };
}

/**
 * POST /api/yom-scan
 * Body: { image: dataURL|base64, input_method?: "photo"|"tag", note?, surface? }
 */
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }

  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!openai && !anthropic) {
    json(res, 503, { ok: false, error: "brain is not configured" });
    return;
  }

  const body = readJson(req);
  const imageUrl = normalizeImage(body.image);
  if (!imageUrl) {
    json(res, 400, { ok: false, error: "image required" });
    return;
  }
  // Soft cap — client should compress; reject absurd payloads
  if (imageUrl.length > 6_500_000) {
    json(res, 413, { ok: false, error: "image too large — try again closer / lower res" });
    return;
  }

  const context = {
    input_method: body.input_method === "tag" ? "tag" : "photo",
    surface: body.surface || "mobile_web",
    note: body.note || "",
    campaign: body.campaign || "reformation_monday",
    source: body.source || "reformation_sample_sale",
    trait: body.trait || "",
    memory: "",
    read: "",
  };

  const token = bearer(req);
  if (token && supabaseConfigured()) {
    const account = await accountFromToken(token);
    if (account?.profile) {
      context.memory = account.profile.memory || "";
      context.read = account.profile.read || "";
    }
  }

  let result = null;
  if (openai) result = await callOpenAIVision(openai, imageUrl, context);
  if ((!result || !result.ok) && anthropic) {
    result = await callAnthropicVision(anthropic, imageUrl, context);
  }

  if (!result?.ok) {
    json(res, 502, { ok: false, error: result?.error || "scan failed" });
    return;
  }

  const data = salvageScan(result.data) || result.data;
  const product = data.product || {};
  const verdict = data.verdict || {};
  const name = visualName(product).toLowerCase();
  const brand = asText(product.brand, 60).toLowerCase() || null;
  const identified =
    typeof product.identified === "boolean"
      ? product.identified
      : Boolean(brand && (typeof product.confidence !== "number" || product.confidence >= 0.4));
  const guess = (asText(product.guess, 90) || (!identified && !isGenericName(name) ? name : "")).toLowerCase();
  const similar = verdict.quiet
    ? []
    : ensureSimilar(product, name, normalizeSimilar(data.similar || product.similar)).map((item) => ({
        name: item.name.toLowerCase(),
        why: item.why ? item.why.toLowerCase() : null,
      }));
  json(res, 200, {
    ok: true,
    brain: result.brain,
    product: {
      name,
      brand,
      price: typeof product.price === "number" ? product.price : null,
      currency: product.currency || "USD",
      category: product.category ? String(product.category).toLowerCase() : null,
      color: product.color ? String(product.color).toLowerCase() : null,
      sku: product.sku || null,
      size_label: product.size_label || null,
      retailer: product.retailer ? String(product.retailer).toLowerCase() : "reformation sample sale",
      confidence: typeof product.confidence === "number" ? product.confidence : null,
      identified,
      guess: guess || null,
      similar,
    },
    similar,
    ocr: data.ocr || null,
    verdict: mergeDetailsIntoVerdict(
      { ...product, name, brand, guess },
      usefulVerdict({ ...product, name, brand, guess }, similar, verdict),
      verdict.style_notes || data.style_notes
    ),
  });
}
