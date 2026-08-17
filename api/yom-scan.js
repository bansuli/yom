import { bearer, json, preflight, readJson } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { supabaseConfigured } from "../lib/supabase.js";

const SYSTEM = `You are yom, a shopping companion. The user photographed a clothing item or price tag (in-store or at home).

Identify the product as specifically as you can from the image (brand, garment type, color, material clues, visible price/SKU/size on the tag). Then give a concrete buy/skip-style take — not vibe praise.

Return ONLY compact JSON:
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
    "confidence": number
  },
  "ocr": {
    "price_text": string | null,
    "brand_text": string | null,
    "other": string | null
  },
  "verdict": {
    "quiet": boolean,
    "stamp": string | null,
    "kind": "love" | "warn" | "neutral",
    "title": string,
    "body": string,
    "resolve": string | null,
    "decision_hint": "buy" | "skip" | "save" | null
  }
}

Rules:
- confidence 0–1
- price as a number when visible; null if unknown — never invent a price
- never invent brand if unclear; say null and describe the garment
- title = concrete takeaway; body = evidence from the photo or memory
- lowercase ok; no emoji; no hype
- if the image is not clothing/fashion-related, quiet=true and explain briefly
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
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `input_method: ${context.input_method || "photo"}`,
                `surface: ${context.surface || "mobile_web"}`,
                context.note ? `user_note: ${context.note}` : null,
                context.memory ? `memory: ${String(context.memory).slice(0, 600)}` : "memory: none",
                context.read ? `yom_read: ${String(context.read).slice(0, 400)}` : null,
                "Identify the garment/tag and give a yom verdict.",
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
  const parsed = parseJson(data.choices?.[0]?.message?.content);
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
      max_tokens: 900,
      temperature: 0.2,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `input_method: ${context.input_method || "photo"}`,
                `surface: ${context.surface || "mobile_web"}`,
                context.note ? `user_note: ${context.note}` : null,
                context.memory ? `memory: ${String(context.memory).slice(0, 600)}` : "memory: none",
                "Identify the garment/tag and give a yom verdict as JSON only.",
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
  const parsed = parseJson(text);
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

  const product = result.data.product || {};
  const verdict = result.data.verdict || {};
  json(res, 200, {
    ok: true,
    brain: result.brain,
    product: {
      name: product.name || "this piece",
      brand: product.brand || null,
      price: typeof product.price === "number" ? product.price : null,
      currency: product.currency || "USD",
      category: product.category || null,
      color: product.color || null,
      sku: product.sku || null,
      size_label: product.size_label || null,
      retailer: product.retailer || null,
      confidence: typeof product.confidence === "number" ? product.confidence : null,
    },
    ocr: result.data.ocr || null,
    verdict: {
      quiet: Boolean(verdict.quiet),
      stamp: verdict.stamp || null,
      kind: verdict.kind || "neutral",
      title: verdict.title || "checked",
      body: verdict.body || "",
      resolve: verdict.resolve || null,
      decision_hint: verdict.decision_hint || null,
    },
  });
}
