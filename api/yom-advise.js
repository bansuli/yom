import { bearer, json, preflight } from "../lib/http.js";
import { accountFromToken } from "../lib/profile.js";
import { supabaseConfigured } from "../lib/supabase.js";

const SYSTEM = `You are yom, a shopping companion sitting on the store page.

You are talking to ONE specific person. Their user id, trait, keep lean, and yom_read are in the prompt. Two people looking at the same product must not get the same title or body. Write as if you already know them.

Voice:
- short, intimate, lowercase-friendly
- taste and a point of view, never customer service
- never "great pick", "love this", "this would look amazing", or emoji
- skip is a valid opinion. quiet is better than filler
- if you are guessing, be quiet

Use their occasion, budget, gift vs self, and yom_read as the lens. Do not quote chip labels robotically. Do not invent a closet unless memory is provided.

The shopper paused on ONE product. product, price, color, description, and product_url are that piece — not a related item further down the page. Quote the real price you were given. Do not invent or borrow another product's price. Your title and body must only make sense for that specific piece.

If the product name is missing, generic, or looks like a collection page, quiet=true.

Return ONLY compact JSON:
{
  "quiet": boolean,
  "stamp": string | null,
  "kind": "love" | "warn" | "neutral",
  "title": string,
  "body": string,
  "resolve": string | null,
  "checkable": boolean
}

Rules:
- quiet=true if you have nothing trustworthy to say for THIS person
- stamp is 1–3 words
- title is the opinion. body is one line of why it fits or fights their pattern
- if keep lean is green and the piece is green, that can be love. if not, do not say "your color"
- gift mode: judge the object, not their wardrobe
- sos mode: they need a decision NOW. lead with size for THIS person, then reviews, then buy / save / skip. do not be quiet.
- if over budget, say so plainly

If surface is pdp or check, also return:
{
  "size": string,
  "reviews": string,
  "shipping": string,
  "regret": number,
  "regretLabel": string
}

Check / PDP rules:
- continue prior_take. if they were told it's in their closet, their color, over budget, or not their toe — the check deepens that, it does not replace it with generic "reviews are good"
- size: one line for THIS person's sizes vs how this piece runs. use sizes + page_size_note. if you don't know the run, still give their size and say so
- reviews: 1–2 lines collating page_reviews. do not invent star ratings or quotes
- shipping: one line from page_shipping plus their occasion/date. if no date, typical timing
- regret: integer 0–100. 0 = they will live in this. 100 = they will regret the buy. this is whether THIS person keeps it, not whether the product is "good"
- regretLabel: 2–4 words ("you'd keep it", "low regret", "could go either way", "likely regret")`;


function parseAdvice(text) {
  if (!text) return null;
  const stripped = String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const raw = JSON.parse(stripped.slice(start, end + 1));
    if (raw.quiet && !raw.title) return { quiet: true };
    if (!raw.title && !raw.stamp) return { quiet: true };
    const regret = Number(raw.regret);
    return {
      quiet: Boolean(raw.quiet),
      stamp: raw.stamp || null,
      kind: raw.kind === "love" || raw.kind === "warn" ? raw.kind : "neutral",
      title: String(raw.title || "").slice(0, 90),
      body: String(raw.body || "").slice(0, 180),
      resolve: raw.resolve ? String(raw.resolve).slice(0, 320) : null,
      checkable: Boolean(raw.checkable),
      size: raw.size ? String(raw.size).slice(0, 180) : null,
      reviews: raw.reviews ? String(raw.reviews).slice(0, 240) : null,
      shipping: raw.shipping ? String(raw.shipping).slice(0, 180) : null,
      regret: Number.isFinite(regret) ? Math.max(0, Math.min(100, Math.round(regret))) : null,
      regretLabel: raw.regretLabel ? String(raw.regretLabel).slice(0, 40) : null,
    };
  } catch {
    return null;
  }
}

function userBlock(payload) {
  const product = payload?.product || {};
  const profile = payload?.profile || {};
  const remaining =
    profile.budget == null ? null : Math.max(0, Number(profile.budget) - Number(profile.spent || 0));
  const over = remaining != null && product.price && Number(product.price) > remaining;
  return [
    `surface: ${payload?.surface || "pdp"}`,
    `user_id: ${profile.userId || "unknown"}`,
    `yom_read: ${profile.read || "none yet"}`,
    `trait: ${profile.trait || "unknown"}`,
    `pre_buy: ${profile.preBuy || "unknown"}`,
    `keep_lean: ${profile.keepLean || "unknown"}`,
    `site: ${product.site || ""}`,
    `product: ${product.name || "unknown"}`,
    `product_id: ${product.id || ""}`,
    `price: ${product.price || "unknown"}`,
    `color: ${product.color || ""}`,
    `category: ${product.category || ""}`,
    `image_alt: ${product.alt || ""}`,
    `description: ${String(product.description || "").slice(0, 280)}`,
    `product_url: ${product.href || product.url || ""}`,
    `shopper mode: ${profile.mode || "browse"}`,
    `occasion: ${profile.purpose || "none"}`,
    `budget: ${profile.budget ?? "none"}`,
    `spent: ${profile.spent || 0}`,
    `remaining: ${remaining ?? "n/a"}`,
    `over_budget: ${over}`,
    `gift: ${Boolean(profile.gift)}`,
    profile.memory ? `memory: ${profile.memory}` : "memory: none (do not invent a closet)",
    `sizes: ${JSON.stringify(profile.sizes || {})}`,
    profile.prior
      ? `prior_take: ${JSON.stringify(profile.prior)} — continue this. do not overwrite it.`
      : "prior_take: none",
    `page_reviews: ${profile.facts?.reviews || "none scraped"}`,
    `page_shipping: ${profile.facts?.shipping || "none scraped"}`,
    `page_size_note: ${profile.facts?.sizeNote || "none scraped"}`,
    "this is the hovered/open product. name it or a trait unique to it. do not describe the listing page.",
    "write a read that would not apply to a different user_id OR a different product.",
  ].join("\n");
}

async function callAnthropic(key, surface, user) {
  const model = surface === "tile" ? "claude-haiku-4-5" : "claude-sonnet-4-5";
  const fallback = surface === "tile" ? "claude-3-5-haiku-latest" : "claude-sonnet-4-5";
  const body = {
    max_tokens: surface === "tile" ? 280 : 700,
    temperature: 0.8,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  };
  let res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...body, model }),
  });
  if (res.status === 404) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...body, model: fallback }),
    });
  }
  if (!res.ok) return null;
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("\n");
  return parseAdvice(text);
}

async function callOpenAI(key, surface, user) {
  const model = surface === "tile" ? "gpt-4o-mini" : "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: surface === "tile" ? 280 : 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseAdvice(data.choices?.[0]?.message?.content);
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return;
  }

  const anthropic = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (!anthropic && !openai) {
    json(res, 503, { ok: false, error: "brain is not configured" });
    return;
  }

  const payload = req.body || {};
  const token = bearer(req);
  if (token && supabaseConfigured()) {
    const account = await accountFromToken(token);
    if (account?.profile) {
      const live = account.profile;
      payload.profile = {
        ...(payload.profile || {}),
        userId: live.userId,
        read: live.read || payload.profile?.read,
        trait: live.trait || payload.profile?.trait,
        preBuy: live.preBuy || payload.profile?.preBuy,
        keepLean: live.keepLean || payload.profile?.keepLean,
        memory: live.memory,
      };
    }
  }

  const user = userBlock(payload);
  const surface = payload.surface || "pdp";
  const advice = anthropic
    ? await callAnthropic(anthropic, surface, user)
    : await callOpenAI(openai, surface, user);

  json(res, 200, { ok: true, advice });
}
