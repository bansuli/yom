const API_KEY = "yom-api";
const FORCE_HOST = "yomForceHost";
const BRAIN_URLS = ["https://youryom.com/api/yom-advise", "https://www.youryom.com/api/yom-advise"];

const cache = new Map();

const SYSTEM = `You are yom, a shopping companion that sits on the store page.

Voice:
- short, intimate, lowercase-friendly especially for "i'll" and "i don't"
- taste and a point of view, never customer service
- never "great pick", "love this", "this would look amazing", or emoji
- skip is a valid opinion. quiet is better than filler
- if you are guessing, be quiet

You are talking to ONE specific person. Their user id, trait, keep lean, and yom_read are in the prompt. Two people looking at the same product must not get the same title or body.

You already know what the shopper told you (occasion, budget, gift vs self, yom_read). Use that as constraint, not as a phrase to repeat.

The product fields are the exact card they paused on. Judge that piece. If the opinion would fit another product on the same grid, be quiet.

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
- quiet=true if you have nothing trustworthy to say
- stamp is 1–3 words for the product card ("over budget", "skip", "for the wedding")
- title is the opinion. body is one line of why
- resolve is only for a deeper PDP check (fit, timing, quality)
- checkable=true if they should tap "look into this"
- do not invent a closet, sizes, or past purchases unless the profile includes memory
- gift mode: judge the object, not whether it matches the shopper's wardrobe
- if over budget, say so plainly; do not moralize`;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OPEN_REFORMATION") {
    chrome.tabs.create({ url: msg.url || "https://www.thereformation.com/clothing" });
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "YOM_HAS_KEY") {
    chrome.storage.local.get(API_KEY, (data) => {
      const key = data[API_KEY]?.key;
      sendResponse({
        ok: true,
        hasKey: true,
        shared: true,
        personal: Boolean(key && String(key).length > 8),
      });
    });
    return true;
  }

  if (msg?.type === "YOM_GET_API") {
    chrome.storage.local.get(API_KEY, (data) => {
      const saved = data[API_KEY] || { provider: "anthropic", key: "" };
      sendResponse({
        ok: true,
        shared: true,
        provider: saved.provider || "anthropic",
        hasKey: Boolean(saved.key),
        tail: saved.key ? String(saved.key).slice(-4) : "",
      });
    });
    return true;
  }

  if (msg?.type === "YOM_SET_API") {
    const provider = msg.provider === "openai" ? "openai" : "anthropic";
    const key = String(msg.key || "").trim();
    chrome.storage.local.set({ [API_KEY]: { provider, key } }, () => {
      sendResponse({ ok: true, hasKey: Boolean(key) });
    });
    return true;
  }

  if (msg?.type === "YOM_CLEAR_API") {
    chrome.storage.local.remove(API_KEY, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "YOM_FORCE_HOST") {
    chrome.storage.local.set({ [FORCE_HOST]: msg.host || "" }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "YOM_ADVISE") {
    advise(msg.payload)
      .then((advice) => sendResponse({ ok: true, advice }))
      .catch(() => sendResponse({ ok: false, advice: null }));
    return true;
  }

  return true;
});

function cacheKey(payload) {
  const p = payload?.product || {};
  const s = payload?.profile || {};
  return [payload?.surface, s.userId, p.id || p.href || p.name, s.mode, s.purpose, s.budget, s.spent, s.keepLean, s.trait, s.preBuy].join("|");
}

async function callSharedBrain(payload) {
  for (const url of BRAIN_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.advice) return data.advice;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function advise(payload) {
  const key = cacheKey(payload);
  if (cache.has(key)) return cache.get(key);

  const stored = await chrome.storage.local.get(API_KEY);
  const api = stored[API_KEY];
  let advice = null;

  if (api?.key) {
    const remaining =
      payload?.profile?.budget == null
        ? null
        : Math.max(0, Number(payload.profile.budget) - Number(payload.profile.spent || 0));
    const over =
      remaining != null && payload?.product?.price && Number(payload.product.price) > remaining;
    const user = [
      `surface: ${payload.surface}`,
      `user_id: ${payload.profile?.userId || "unknown"}`,
      `yom_read: ${payload.profile?.read || "none yet"}`,
      `trait: ${payload.profile?.trait || "unknown"}`,
      `pre_buy: ${payload.profile?.preBuy || "unknown"}`,
      `keep_lean: ${payload.profile?.keepLean || "unknown"}`,
      `site: ${payload.product?.site || ""}`,
      `product: ${payload.product?.name || "unknown"}`,
      `product_id: ${payload.product?.id || ""}`,
      `price: ${payload.product?.price || "unknown"}`,
      `color: ${payload.product?.color || ""}`,
      `category: ${payload.product?.category || ""}`,
      `image_alt: ${payload.product?.alt || ""}`,
      `description: ${String(payload.product?.description || "").slice(0, 280)}`,
      `product_url: ${payload.product?.href || payload.product?.url || ""}`,
      `shopper mode: ${payload.profile?.mode || "browse"}`,
      `occasion: ${payload.profile?.purpose || "none"}`,
      `budget: ${payload.profile?.budget ?? "none"}`,
      `spent: ${payload.profile?.spent || 0}`,
      `remaining: ${remaining ?? "n/a"}`,
      `over_budget: ${over}`,
      `gift: ${Boolean(payload.profile?.gift)}`,
      payload.profile?.memory ? `memory: ${payload.profile.memory}` : "memory: none (do not invent a closet)",
      "this is the hovered/open product. name it or a trait unique to it. do not describe the listing page.",
      "write a read that would not apply to a different user_id OR a different product.",
    ].join("\n");
    advice =
      api.provider === "openai"
        ? await callOpenAI(api.key, payload.surface, user)
        : await callAnthropic(api.key, payload.surface, user);
  }

  if (!advice) advice = await callSharedBrain(payload);
  if (advice) cache.set(key, advice);
  return advice;
}

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
    return {
      quiet: Boolean(raw.quiet),
      stamp: raw.stamp || null,
      kind: raw.kind === "love" || raw.kind === "warn" ? raw.kind : "neutral",
      title: String(raw.title || "").slice(0, 90),
      body: String(raw.body || "").slice(0, 180),
      resolve: raw.resolve ? String(raw.resolve).slice(0, 280) : null,
      checkable: Boolean(raw.checkable),
    };
  } catch {
    return null;
  }
}

async function callAnthropic(key, surface, user) {
  const model = surface === "tile" ? "claude-haiku-4-5" : "claude-sonnet-4-5";
  const fallback = surface === "tile" ? "claude-3-5-haiku-latest" : "claude-sonnet-4-5";
  let res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.8,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (res.status === 404 && model !== fallback) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: fallback,
        max_tokens: 400,
        temperature: 0.8,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
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
      max_tokens: 400,
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
