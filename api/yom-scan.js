import { bearer, json, preflight, readJson } from "../lib/http.js";
import { mergeDetailsIntoVerdict } from "../lib/scan-details.js";
import { buildScanSystemPrompt, buildScanUserPrompt, defaultRetailer, humanizeVerdictText } from "../lib/scan-brain.js";
import { RUSH_PARROT, resolveRoundId } from "../lib/berkeley-rush.js";
import { loadStylistContext } from "../lib/google-context.js";
import { fetchImageAsDataUrl, fetchLinkPreview } from "../lib/link-preview.js";
import { cleanProductUrl, guessListingImage, noteFromProductUrl } from "../lib/product-link.js";
import { accountFromToken } from "../lib/profile.js";
import { supabaseConfigured } from "../lib/supabase.js";
import { capRunningTrainerVerdict, capOutfitShoeVerdict, emptyClothingVerdict, isNonClothingScan } from "../lib/scan-score.js";
import { attachReviews, researchProductReviews, shouldResearchReviews } from "../lib/review-research.js";

export const config = { maxDuration: 60 };

const OPENAI_SCAN_MODEL = process.env.OPENAI_SCAN_MODEL || "gpt-4o";
const ANTHROPIC_SCAN_MODEL = process.env.ANTHROPIC_SCAN_MODEL || "claude-sonnet-4-5";

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

const PIECE_SLOTS = new Set([
  "top",
  "bottom",
  "dress",
  "shoes",
  "bag",
  "jewelry",
  "outerwear",
  "accessory",
]);

function normalizePieces(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const slot = PIECE_SLOTS.has(String(item.slot || "").trim())
      ? String(item.slot).trim()
      : "accessory";
    const name = asText(item.name, 90).toLowerCase();
    if (!name || seen.has(`${slot}:${name}`)) continue;
    seen.add(`${slot}:${name}`);
    out.push({
      slot,
      name,
      brand: asText(item.brand, 60).toLowerCase() || null,
      color: asText(item.color, 40).toLowerCase() || null,
      category: asText(item.category, 40).toLowerCase() || null,
      feedback: humanizeVerdictText(asText(item.feedback, 220).toLowerCase()),
      note: item.note ? humanizeVerdictText(asText(item.note, 160).toLowerCase()) : null,
    });
    if (out.length >= 8) break;
  }
  return out;
}

function inferScanMode(parsed = {}, pieces = []) {
  const mode = String(parsed.scan_mode || "").trim();
  if (mode === "outfit" || mode === "single") return mode;
  if (pieces.length >= 2) return "outfit";
  const name = asText(parsed.product?.name, 120).toLowerCase();
  if (/\+\s|with | and |full look|full outfit|look\b/.test(name)) return "outfit";
  return "single";
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
  /versatile|weigh it against|style needs|budget and style|great option|timeless|must-have|without brand|without price|summer option|wardrobe staple|worth considering|could work|strong match|very you|good for your style|consider your|depends on your|a great addition|elevate your|great for recruitment|many rounds/i;

const ROUNDS = new Set([
  "orientation",
  "unity_day",
  "unity_day_1",
  "unity_day_2",
  "sisterhood_day",
  "philanthropy_day",
  "preference",
  "bid_day",
]);

function analysisFields(verdict = {}, context = {}) {
  const scoreRaw = Number(verdict.score);
  const kind = verdict.kind;
  const fallbackScore = kind === "love" ? 8.4 : kind === "warn" ? 5.6 : 7.2;
  const said = ROUNDS.has(String(verdict.round || "").trim())
    ? String(verdict.round).trim()
    : String(context.recruitment_round || "").trim();
  if (verdict.quiet) {
    return {
      score: null,
      round: null,
      why_it_works: "",
      change: "",
      berkeley: "",
      spotting: "",
    };
  }
  // Which day to wear it on is the answer she came for, so it is never blank:
  // a model that skipped the field, or hedged with a generic "unity", still
  // resolves to one night she can act on. Everything below is clothing.
  const round = resolveRoundId(said);
  return {
    score: Number.isFinite(scoreRaw) ? Math.max(0, Math.min(10, Math.round(scoreRaw * 10) / 10)) : fallbackScore,
    round: ROUNDS.has(round) ? round : "unity_day_1",
    why_it_works: humanizeVerdictText(String(verdict.why_it_works || verdict.body || "").toLowerCase()).slice(0, 280),
    change: humanizeVerdictText(String(verdict.change || verdict.resolve || "").toLowerCase()).slice(0, 280),
    berkeley: humanizeVerdictText(String(verdict.berkeley || verdict.spotting || "").toLowerCase()).slice(0, 280),
    spotting: humanizeVerdictText(String(verdict.berkeley || verdict.spotting || "").toLowerCase()).slice(0, 280),
  };
}

function usefulVerdict(product, similar, verdict = {}, context = {}) {
  if (isNonClothingScan(product, verdict)) {
    return emptyClothingVerdict();
  }
  const title = String(verdict.title || "").toLowerCase().trim();
  const body = String(verdict.body || "").toLowerCase().trim();
  const parrot = RUSH_PARROT.test(`${title} ${body}`);
  const generic =
    GENERIC_VERDICT.test(`${title} ${body}`) || /option$/.test(title) || parrot;
  const label = [product.brand, product.name || product.guess].filter(Boolean).join(" ") || "this piece";
  const cousins = (similar || []).map((s) => s.name).filter(Boolean).slice(0, 3);
  const extra = capOutfitShoeVerdict(
    capRunningTrainerVerdict(product, { ...verdict, ...analysisFields(verdict, context) }),
    context.pieces || []
  );
  if (!generic && title && !/^this /.test(title)) {
    return {
      quiet: Boolean(verdict.quiet),
      stamp: verdict.stamp || "id",
      kind: verdict.kind || "neutral",
      title: humanizeVerdictText(title),
      body: humanizeVerdictText(body),
      resolve: verdict.resolve ? humanizeVerdictText(String(verdict.resolve).toLowerCase()) : null,
      decision_hint: verdict.decision_hint || null,
      ...extra,
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
      ...extra,
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
    ...extra,
  };
}

function normalizeGarmentName(name, category) {
  let n = asText(name, 90).toLowerCase();
  const cat = asText(category, 40).toLowerCase();
  const hasType =
    /\b(dress|top|blouse|shirt|tank|cami|skirt|pants|jeans|shorts|sandals|heels|boots|sneakers|blazer|jacket|coat|sweater|cardigan|bag)\b/.test(
      n
    );
  if (!hasType && cat && !n.includes(cat)) {
    n = n ? `${n} ${cat}` : cat;
  }
  if (/\bslip\b/.test(n) && !/\b(dress|top|cami|skirt)\b/.test(n)) {
    if (cat.includes("dress")) n = `${n} dress`.replace(/\s+/g, " ").trim();
    else if (cat.includes("top") || cat.includes("cami") || cat.includes("blouse")) {
      n = `${n} top`.replace(/\s+/g, " ").trim();
    } else if (cat.includes("skirt")) n = `${n} skirt`.replace(/\s+/g, " ").trim();
  }
  return n;
}

function normalizeImage(image) {
  const raw = String(image || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

async function openaiMessages(key, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_SCAN_MODEL,
      temperature: 0.2,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("openai scan", res.status, err.slice(0, 400));
    return { ok: false, error: `vision failed (${res.status})` };
  }
  const data = await res.json();
  const parsed = salvageScan(parseJson(data.choices?.[0]?.message?.content));
  if (!parsed?.product) return { ok: false, error: "could not read that." };
  return { ok: true, data: parsed, brain: "openai" };
}

async function callOpenAIVision(key, imageUrl, context) {
  const system = buildScanSystemPrompt(context);
  const userText = buildScanUserPrompt(context);
  return openaiMessages(key, [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ],
    },
  ]);
}

async function callOpenAIText(key, context) {
  return openaiMessages(key, [
    { role: "system", content: buildScanSystemPrompt(context) },
    { role: "user", content: buildScanUserPrompt(context) },
  ]);
}

async function callAnthropicVision(key, imageUrl, context) {
  const match = String(imageUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return { ok: false, error: "anthropic scan needs a data URL image" };
  const mediaType = match[1];
  const data = match[2];
  const system = buildScanSystemPrompt(context);
  const userText = buildScanUserPrompt(context);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_SCAN_MODEL,
      max_tokens: 2000,
      temperature: 0.2,
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
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
 * Body: { image?: dataURL|base64, link?: url, note?, input_method?: "photo"|"tag"|"link"|"text" }
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
  let imageUrl = normalizeImage(body.image);
  let sourceUrl = cleanProductUrl(body.link || body.source_url || "");
  let note = String(body.note || "").trim();
  const methodHint = String(body.input_method || "").trim();

  if (!imageUrl && sourceUrl) {
    imageUrl = normalizeImage(guessListingImage(sourceUrl));
    const preview = await fetchLinkPreview(sourceUrl);
    if (preview.ok) {
      sourceUrl = preview.url || sourceUrl;
      if (preview.image) {
        imageUrl = (await fetchImageAsDataUrl(preview.image)) || normalizeImage(preview.image) || imageUrl;
      }
      if (preview.title && !note) note = preview.title;
    }
    if (!note) note = noteFromProductUrl(sourceUrl);
  }

  const textOnly = Boolean(!imageUrl && note);
  if (!imageUrl && !textOnly) {
    json(res, 400, {
      ok: false,
      error: sourceUrl
        ? "couldn’t open that store page — try a screenshot or describe the piece."
        : "need a photo, a store link, or a description.",
    });
    return;
  }
  if (imageUrl && imageUrl.length > 6_500_000) {
    json(res, 413, { ok: false, error: "image too large — try again closer / lower res" });
    return;
  }

  const acq = {
    campaign: body.campaign || "",
    source: body.source || "",
    shopping_context: body.shopping_context || "",
    recruitment_round: body.recruitment_round || "",
    shopping_context_label: body.shopping_context_label || body.occasion_label || "",
  };

  const inputMethod = methodHint === "tag" || methodHint === "link" || methodHint === "text"
    ? methodHint
    : sourceUrl
      ? "link"
      : textOnly
        ? "text"
        : "photo";

  const context = {
    input_method: inputMethod,
    surface: body.surface || "mobile_web",
    note: note || body.note || "",
    campaign: acq.campaign,
    source: acq.source,
    shopping_context: acq.shopping_context,
    recruitment_round: acq.recruitment_round,
    shopping_context_label: acq.shopping_context_label,
    occasion: body.occasion || "",
    occasion_label: body.occasion_label || "",
    shopper_name: body.shopper_name || "",
    scan_memory: body.scan_memory || "",
    trait: body.trait || "",
    memory: "",
    read: "",
    google_prompt: "",
  };

  const token = bearer(req);
  if (token && supabaseConfigured()) {
    const account = await accountFromToken(token);
    if (account?.profile) {
      context.memory = account.profile.memory || "";
      context.read = account.profile.read || "";
      context.shopper_name = context.shopper_name || account.profile.name || "";
      try {
        const google = await loadStylistContext(account.profile.id, { refresh: true });
        context.google_prompt = google.prompt || "";
        if (!context.occasion && google.events?.length) {
          const next = google.events[0];
          if (next?.label) context.occasion = `${next.label}${next.when ? ` · ${next.when}` : ""}`;
        }
      } catch (e) {
        console.warn("scan google context", e?.message || e);
      }
    }
  }
  if (!context.memory && context.scan_memory) {
    context.memory = `recent scans: ${context.scan_memory}`;
  } else if (context.memory && context.scan_memory) {
    context.memory = `${context.memory} recent scans: ${context.scan_memory}`;
  }

  const earlyQuery = note || "";
  // Nothing to research for a photo, so nothing is started for one — a closet
  // shot should not wait on a web search it will never show.
  const earlyReviews =
    sourceUrl && openai
      ? researchProductReviews({
          product: { name: earlyQuery, brand: null },
          sourceUrl,
          openaiKey: openai,
          timeoutMs: 14000,
        }).catch((err) => {
          console.warn("early review research", err?.message || err);
          return null;
        })
      : null;

  let result = null;
  if (textOnly) {
    if (!openai) {
      json(res, 400, { ok: false, error: "a photo or link works better for this." });
      return;
    }
    result = await callOpenAIText(openai, context);
  } else {
    if (openai) result = await callOpenAIVision(openai, imageUrl, context);
    if ((!result || !result.ok) && anthropic) {
      result = await callAnthropicVision(anthropic, imageUrl, context);
    }
  }

  if (!result?.ok) {
    json(res, 502, { ok: false, error: result?.error || "scan failed" });
    return;
  }

  const data = salvageScan(result.data) || result.data;
  const product = data.product || {};
  const verdict = data.verdict || {};
  const rawPieces = normalizePieces(data.pieces);
  const scanMode = inferScanMode(data, rawPieces);
  const pieces = scanMode === "outfit" && rawPieces.length >= 2 ? rawPieces : [];
  const category = product.category ? String(product.category).toLowerCase() : null;
  const name = normalizeGarmentName(visualName(product), category);
  const brand = asText(product.brand, 60).toLowerCase() || null;
  const identified =
    typeof product.identified === "boolean"
      ? product.identified
      : Boolean(brand && (typeof product.confidence !== "number" || product.confidence >= 0.4));
  const guess = (asText(product.guess, 90) || (!identified && !isGenericName(name) ? name : "")).toLowerCase();
  const analysis = usefulVerdict(
    { ...product, name, brand, guess },
    normalizeSimilar(data.similar || product.similar),
    verdict,
    { ...context, pieces, scan_mode: scanMode }
  );
  const similar = analysis.quiet
    ? []
    : ensureSimilar(product, name, normalizeSimilar(data.similar || product.similar)).map((item) => ({
        name: item.name.toLowerCase(),
        why: item.why ? item.why.toLowerCase() : null,
      }));
  const previewImage =
    (imageUrl && /^https?:\/\//i.test(imageUrl) && imageUrl) ||
    (imageUrl && imageUrl.startsWith("data:image/") && imageUrl.length < 900_000 && imageUrl) ||
    guessListingImage(sourceUrl) ||
    undefined;

  let reviews = null;
  if (!analysis.quiet) {
    try {
      const identifiedProduct = {
        name,
        brand,
        category,
        color: product.color,
        sku: product.sku,
        guess,
      };
      if (shouldResearchReviews(identifiedProduct, sourceUrl)) {
        const early = earlyReviews ? await earlyReviews : null;
        const earlyName = String(earlyQuery || "").toLowerCase();
        const nowName = [brand, name].filter(Boolean).join(" ").toLowerCase();
        const reuse =
          early &&
          (early.summary || early.highlights?.length) &&
          earlyName &&
          nowName &&
          (nowName.includes(earlyName.slice(0, 10)) ||
            earlyName.includes(nowName.slice(0, 10)) ||
            (brand && earlyName.includes(String(brand).toLowerCase())));
        reviews = reuse
          ? early
          : await researchProductReviews({
              product: identifiedProduct,
              sourceUrl,
              openaiKey: openai,
              timeoutMs: 12000,
            });
      }
    } catch (err) {
      console.warn("review research", err?.message || err);
    }
  }

  const merged = analysis.quiet
    ? analysis
    : mergeDetailsIntoVerdict({ ...product, name, brand, guess }, analysis, verdict.style_notes || data.style_notes);
  // The verdict carries its own copy of the reviews and the app falls back to
  // it, so a photo has to be stripped in both places or the strangers come back.
  const verdictOut = analysis.quiet ? merged : sourceUrl ? attachReviews(merged, reviews) : { ...merged, reviews: null };

  json(res, 200, {
    ok: true,
    brain: result.brain,
    scan_mode: scanMode,
    source_url: sourceUrl || null,
    image: previewImage,
    pieces: analysis.quiet ? [] : pieces,
    product: {
      name,
      brand,
      price: typeof product.price === "number" ? product.price : null,
      currency: product.currency || "USD",
      category,
      color: product.color ? String(product.color).toLowerCase() : null,
      sku: product.sku || null,
      size_label: product.size_label || null,
      retailer: defaultRetailer(context, product.retailer),
      confidence: typeof product.confidence === "number" ? product.confidence : null,
      identified,
      guess: guess || null,
      similar,
    },
    similar,
    // Never from a photo, even if the model volunteered some: unsourced quotes
    // about a piece she already owns are invented, and read as fact.
    reviews: sourceUrl ? verdictOut.reviews || reviews || null : null,
    ocr: data.ocr || null,
    verdict: verdictOut,
  });
}
