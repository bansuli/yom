import { bearer, json, preflight } from "../lib/http.js";
import { loadStylistContext } from "../lib/google-context.js";
import { accountFromToken } from "../lib/profile.js";
import { STYLIST_VOICE } from "../lib/stylist.js";
import { supabaseConfigured } from "../lib/supabase.js";
import { formatReviewsForPrompt, researchProductReviews, reviewLine, reviewRegretDelta } from "../lib/review-research.js";
import { detectPiece, matchUserSize } from "../lib/size-read.js";
import { humanizeVerdictText } from "../lib/scan-brain.js";

const SYSTEM = `${STYLIST_VOICE}

You are sitting on the store page with them. The job is a buy decision for THIS exact product. not a vibe check, not a caption.

Anchor every take in at least one concrete thing:
- silhouette / fabric / color on the listing
- exact price / remaining budget
- size or fit note (page_sizes + their sizes. clothes vs shoes vs denim)
- review pattern from page_reviews AND web_reviews across try-on hauls, shopmy, ltk, instagram posts/reels, reddit, amazon, brand site, substack, forums. do not invent quotes or sources. you cannot read instagram stories.
- shipping vs a named calendar date
- closet / gmail orders / returns
- a learned behavior (impulse, panic before events, etc.)

You MAY have a style opinion from the garment itself. Do not go quiet just because reviews weren't scraped.
quiet=true ONLY if this is not clothing/fashion.

Prefer useful calls:
- "size up. reviews say the bust runs tight"
- "$84 over your remaining budget"
- "you already own this job. same column as the black midi in gmail last april"
- "arrives 3 days before maya's wedding"
- "final sale"
- "too casual for preference, fine for unity"
- "this is trying too hard for a tuesday office"

Never invent data. If calendar isn't connected, don't invent an event.
Unless occasion explicitly mentions sorority recruitment or rush, never mention unity, sisterhood, preference, philanthropy, or bid day.

Return ONLY compact JSON:
{
  "quiet": boolean,
  "stamp": string | null,
  "kind": "love" | "warn" | "neutral",
  "title": string,
  "body": string,
  "resolve": string | null,
  "checkable": boolean,
  "decision_hint": "buy" | "skip" | "save" | null
}

Output rules:
- title = the takeaway (opinion + fact)
- body = the evidence
- stamp = fit | reviews | budget | closet | shipping | material | occasion | style
- resolve = only if there is a concrete fix
- never repeat the same fact in title and body
- quiet=true if the response would still make sense for another product AND another person
- all user-facing copy is lowercase: title, body, resolve, size, reviews, shipping, stamp, regretLabel. same voice as scan.

GOOD:
{"quiet":false,"stamp":"occasion","kind":"love","title":"this works for saturday","body":"column midi, estimated delivery aug 25-26. 3 days before maya's wedding.","resolve":null,"checkable":true,"decision_hint":"buy"}

GOOD:
{"quiet":false,"stamp":"closet","kind":"warn","title":"you already have this job","body":"gmail shows an aritzia black slip last month. this is the same neckline.","resolve":null,"checkable":false,"decision_hint":"skip"}

BAD:
"this feels very you"
"strong match for your style"
"worth a look"

If surface is pdp or check, also return:
{
  "size": string,
  "reviews": string,
  "shipping": string,
  "regret": number,
  "regretLabel": string
}

Check / PDP rules:
- continue prior_take. deepen it; don't replace a closet warning with generic "reviews are good"
- size: one line for THIS person's sizes vs how this piece actually sizes on the page (use page_sizes / size_read). clothes vs shoes vs denim. never guess a number that is not on the listing.
- reviews: 1 short line from whatever we actually found (haul, shopmy, ltk, instagram, reddit, amazon, brand). name the channel. not an essay. empty if nothing real.
- shipping: one line from page_shipping plus a named calendar date when you have one
- regret: 0–100 whether THIS person keeps it. ground it in fit + review consensus + their sizes. if web_reviews.regret_delta is present, stay close to it.
- regretLabel: 2–4 words ("you'd keep it", "low regret", "could go either way", "likely regret")
- decision_hint required for clothing
`;


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
      stamp: raw.stamp ? humanizeVerdictText(String(raw.stamp)).slice(0, 40) : null,
      kind: raw.kind === "love" || raw.kind === "warn" ? raw.kind : "neutral",
      title: humanizeVerdictText(String(raw.title || "")).slice(0, 120),
      body: humanizeVerdictText(String(raw.body || "")).slice(0, 280),
      resolve: raw.resolve ? humanizeVerdictText(String(raw.resolve)).slice(0, 320) : null,
      checkable: Boolean(raw.checkable),
      decision_hint:
        raw.decision_hint === "buy" || raw.decision_hint === "skip" || raw.decision_hint === "save"
          ? raw.decision_hint
          : null,
      size: raw.size ? humanizeVerdictText(String(raw.size)).slice(0, 180) : null,
      reviews: raw.reviews ? humanizeVerdictText(String(raw.reviews)).slice(0, 240) : null,
      shipping: raw.shipping ? humanizeVerdictText(String(raw.shipping)).slice(0, 180) : null,
      regret: Number.isFinite(regret) ? Math.max(0, Math.min(100, Math.round(regret))) : null,
      regretLabel: raw.regretLabel ? humanizeVerdictText(String(raw.regretLabel)).slice(0, 40) : null,
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
    profile.google_prompt || "google: not connected. do not invent calendar events or order history.",
    `sizes: ${JSON.stringify(profile.sizes || {})}`,
    profile.size_read ? `size_read: ${profile.size_read}` : "size_read: none yet",
    product.size_read?.line ? `matched_size: ${product.size_read.line}` : "",
    product.sizing
      ? `page_sizes: ${JSON.stringify({
          family: product.sizing.family,
          labels: (product.sizing.options || product.sizing.labels || []).slice(0, 16),
          selected: product.sizing.selected || "",
          fitNote: product.sizing.fitNote || "",
          model: product.sizing.modelSize || product.sizing.model || "",
        })}`
      : "page_sizes: none scraped",
    profile.prior
      ? `prior_take: ${JSON.stringify(profile.prior)}. continue this. do not overwrite it.`
      : "prior_take: none",
    `page_reviews: ${profile.facts?.reviews || "none scraped"}`,
    `web_reviews: ${formatReviewsForPrompt(payload.web_reviews) || "none found"}`,
    `page_shipping: ${profile.facts?.shipping || "none scraped"}`,
    `page_size_note: ${profile.facts?.sizeNote || "none scraped"}`,
    "this is the hovered/open product. name it or a trait unique to it. do not describe the listing page.",
    "write a read that would not apply to a different user_id OR a different product.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callAnthropic(key, surface, user) {
  const model = surface === "tile" ? "claude-haiku-4-5" : "claude-sonnet-4-5";
  const fallback = surface === "tile" ? "claude-3-5-haiku-latest" : "claude-sonnet-4-5";
  const body = {
    max_tokens: surface === "tile" ? 280 : 700,
    temperature: 0.45,
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
      temperature: 0.3,
      max_tokens: surface === "tile" ? 280 : 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("openai advise", res.status, err.slice(0, 300));
    return null;
  }
  const data = await res.json();
  return parseAdvice(data.choices?.[0]?.message?.content);
}

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
      try {
        const google = await loadStylistContext(live.id || live.userId, { refresh: true });
        payload.profile.google_prompt = google.prompt || "";
        if (!payload.profile.purpose && google.events?.[0]?.label) {
          payload.profile.purpose = google.events[0].label;
        }
      } catch (e) {
        console.warn("advise google context", e?.message || e);
        payload.profile.google_prompt = "google: not connected. do not invent calendar events or order history.";
      }
    }
  }

  const surface = payload.surface || "pdp";
  if (surface !== "tile") {
    try {
      payload.web_reviews = await researchProductReviews({
        product: payload.product || {},
        sourceUrl: payload.product?.href || payload.product?.url || "",
        openaiKey: openai,
        pageReviews: payload.profile?.facts?.reviews || "",
        timeoutMs: 9000,
      });
    } catch (e) {
      console.warn("advise review research", e?.message || e);
    }
  }

  const extracted = payload.product?.sizing;
  if (extracted && (extracted.options || extracted.labels)) {
    payload.product.size_read = matchUserSize(extracted, payload.profile?.sizes || {}, {
      brand: payload.product?.brand || "",
      piece: extracted.piece || detectPiece(payload.product),
      reviewFit: payload.web_reviews,
      name: payload.product?.name || extracted.name || "",
    });
    if (payload.profile) payload.profile.size_read = payload.product.size_read.line;
  }

  const user = userBlock(payload);

  let advice = null;
  let brain = null;
  if (openai) {
    advice = await callOpenAI(openai, surface, user);
    if (advice) brain = "openai";
  }
  if (!advice && anthropic) {
    advice = await callAnthropic(anthropic, surface, user);
    if (advice) brain = "anthropic";
  }

  if (advice && !advice.quiet) {
    if (!advice.size && payload.product?.size_read?.line) {
      advice.size = humanizeVerdictText(payload.product.size_read.line).slice(0, 180);
    }
    if (!advice.reviews) {
      const line = reviewLine(payload.web_reviews);
      if (line) advice.reviews = humanizeVerdictText(line).slice(0, 240);
    }
    if (advice.size) advice.size = humanizeVerdictText(advice.size).slice(0, 180);
    if (advice.reviews) advice.reviews = humanizeVerdictText(advice.reviews).slice(0, 240);
    if (advice.shipping) advice.shipping = humanizeVerdictText(advice.shipping).slice(0, 180);
    if (advice.regretLabel) advice.regretLabel = humanizeVerdictText(advice.regretLabel).slice(0, 40);
    const delta = reviewRegretDelta(payload.web_reviews);
    if (Number.isFinite(Number(advice.regret))) {
      advice.regret = Math.max(0, Math.min(100, Math.round(Number(advice.regret) + delta)));
    }
  }

  json(res, 200, { ok: true, advice, brain, review_brief: payload.web_reviews || null });
}
