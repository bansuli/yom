/**
 * TikTok product evidence for yom.
 *
 * Discovery: duckduckgo + reddit posts linking tiktok videos, using broad query variants.
 * Verification: LLM filters false positives (e.g. roberto cavalli tiger jeans vs jaded london).
 * Extraction: structured sizing/fit claims from captions (oembed titles).
 *
 * Does not crawl tiktok at scale or scrape comments — uses public oembed + search snippets.
 * Results are cached per product fingerprint (memory + Supabase) so repeat PDP opens are cheap.
 */

import { loadTikTokEvidence, saveTikTokEvidence } from "./tiktok-store.js";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const REDDIT_UA = "web:yom-reviews:v1.0 (fashion shopping assistant)";

const REDDIT_FASHION_SUBS = [
  "femalefashionadvice",
  "malefashionadvice",
  "PetiteFashionAdvice",
  "plussize",
  "XXS",
  "tallfashionadvice",
  "ABraThatFits",
  "Uniqlo",
  "Aritzia",
  "Reformation",
  "Ganni",
  "Sezane",
  "Madewell",
  "lululemon",
  "fashion",
].join("+");

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const cache = new Map();

function clip(value, max = 280) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = String(text).indexOf("{");
    const end = String(text).lastIndexOf("}");
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

function withTimeout(promise, ms, fallback = null) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), Math.max(200, ms));
    }),
  ]).finally(() => clearTimeout(timer));
}

async function fetchText(url, { timeout = 6000, headers = {}, json = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: json ? "application/json,text/plain" : "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.8",
        "user-agent": headers["user-agent"] || BROWSER_UA,
        ...headers,
      },
      signal: controller.signal,
    });
    if (!res.ok) return json ? null : "";
    if (json) return await res.json().catch(() => null);
    return await res.text();
  } catch {
    return json ? null : "";
  } finally {
    clearTimeout(timer);
  }
}

function decodeDdgHref(href) {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (/^https?:/i.test(href)) return href;
    return u.href;
  } catch {
    return href;
  }
}

function tiktokVideoUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("tiktok.com")) return "";
    if (/\/video\/\d+/.test(u.pathname) || u.hostname.startsWith("vm.")) return u.href.split("?")[0];
    return "";
  } catch {
    return "";
  }
}

/** Pull tiktok video urls embedded in reddit posts, comments, or plain text. */
export function extractTikTokUrls(text) {
  const urls = [];
  const seen = new Set();
  for (const m of String(text || "").matchAll(/https?:\/\/(?:www\.|vm\.)?tiktok\.com\/[^\s"'<>)\]]+/gi)) {
    const clean = tiktokVideoUrl(m[0].replace(/[),.]+$/, ""));
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    urls.push(clean);
  }
  return urls;
}

async function searchRedditTikTokUrls(query, product = {}) {
  if (!query || process.env.TIKTOK_REDDIT === "0") return { urls: [], contextByUrl: new Map() };
  const brand = clip(product.brand, 40);
  const name = clip(product.name || product.guess, 80);
  const core = query || [brand, name].filter(Boolean).join(" ");
  const redditQ = encodeURIComponent(`${core} tiktok (try on OR haul OR sizing OR review OR fit)`);
  const subsQ = encodeURIComponent(`${core} tiktok`);
  const endpoints = [
    `https://www.reddit.com/search.json?q=${redditQ}&sort=relevance&t=year&limit=12&type=link`,
    `https://www.reddit.com/r/${REDDIT_FASHION_SUBS}/search.json?q=${subsQ}&restrict_sr=1&sort=relevance&t=year&limit=10`,
  ];
  const urls = [];
  const contextByUrl = new Map();
  const seen = new Set();

  const noteUrl = (url, context) => {
    const clean = tiktokVideoUrl(url);
    if (!clean) return;
    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
    const ctx = clip(context, 260).toLowerCase();
    if (!ctx || ctx.length < 16) return;
    const prev = contextByUrl.get(clean) || "";
    const merged = clip(`${prev} ${ctx}`.trim(), 300);
    contextByUrl.set(clean, merged);
  };

  for (const endpoint of endpoints) {
    const data = await fetchText(endpoint, {
      timeout: 5500,
      json: true,
      headers: { "user-agent": REDDIT_UA },
    });
    for (const child of data?.data?.children || []) {
      const post = child?.data || {};
      const title = clip(post.title, 200);
      const body = clip(post.selftext, 400);
      const blob = [title, body, post.url].filter(Boolean).join("\n");
      extractTikTokUrls(blob).forEach((url) => noteUrl(url, [title, body].filter(Boolean).join(" — ")));
      noteUrl(post.url || "", title);
      if (urls.length >= 12) break;
    }
    if (urls.length >= 12) break;
  }

  return { urls: urls.slice(0, 12), contextByUrl };
}

export function productFingerprint(product = {}, sourceUrl = "") {
  const brand = clip(product.brand, 40).toLowerCase();
  const name = clip(product.name || product.guess, 90).toLowerCase();
  const color = clip(product.color, 24).toLowerCase();
  let host = "";
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    /* ignore */
  }
  return [brand, name, color, host].filter(Boolean).join("|");
}

function distinctiveTokens(text) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "women",
    "womens",
    "men",
    "mens",
    "size",
    "new",
    "sale",
    "shop",
    "collection",
  ]);
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

/**
 * Broad recall queries — product name alone misses captions like "tiger print jeans".
 */
export function buildTikTokSearchQueries(product = {}) {
  const brand = clip(product.brand, 40);
  const name = clip(product.name || product.guess, 90);
  const color = clip(product.color, 24);
  const category = clip(product.category, 30);
  const tokens = distinctiveTokens(`${name} ${color} ${category}`);
  const queries = [];
  const seen = new Set();
  const add = (q) => {
    const clean = clip(q, 120).replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 8 || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    queries.push(clean);
  };

  if (brand && name) add(`${brand} ${name}`);
  if (brand && color) add(`${brand} ${color} ${category || "jeans"}`);
  if (name) add(`${name} try on`);
  if (name) add(`${name} review sizing`);

  const visual = [];
  if (/tiger|leopard|zebra|snake|animal/i.test(`${name} ${color}`)) visual.push("tiger print", "animal print");
  if (/bootcut|wide leg|straight leg|flare|baggy|low rise|high rise|slouchy/i.test(name)) {
    const m = name.match(/(bootcut|wide leg|straight leg|flare|baggy|low rise|high rise|slouchy)/i);
    if (m) visual.push(m[1].toLowerCase());
  }
  if (color) visual.push(`${color.toLowerCase()} ${category || "jeans"}`);
  visual.forEach((v) => {
    if (brand) add(`${brand} ${v}`);
    add(`${v} try on`);
    add(`${v} haul`);
  });

  if (tokens.length >= 2) {
    add(tokens.slice(0, 4).join(" "));
    if (brand) add(`${brand} ${tokens.slice(0, 3).join(" ")}`);
  }
  if (brand) add(`${brand} haul grwm`);
  if (name) {
    const short = tokens.slice(0, 3).join(" ");
    if (short) add(`${short} tiktok sizing`);
  }

  return queries.slice(0, 12);
}

async function searchTikTokUrls(query) {
  if (!query) return [];
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:tiktok.com/video ${query}`)}`,
    { timeout: 5500 }
  );
  if (!html) return [];
  const urls = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/gi)) {
    const clean = tiktokVideoUrl(decodeDdgHref(m[1]));
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    urls.push(clean);
    if (urls.length >= 6) break;
  }
  return urls;
}

async function discoverTikTokUrls(product, budgetMs = 7000) {
  const queries = buildTikTokSearchQueries(product);
  const started = Date.now();
  const left = () => Math.max(0, budgetMs - (Date.now() - started));
  const urls = [];
  const seen = new Set();
  const redditContextByUrl = new Map();
  const primary = queries[0] || [product.brand, product.name].filter(Boolean).join(" ");

  const redditPromise = withTimeout(
    searchRedditTikTokUrls(primary, product),
    Math.min(5000, left()),
    { urls: [], contextByUrl: new Map() }
  );

  for (const q of queries) {
    if (left() < 400) break;
    const batch = await withTimeout(searchTikTokUrls(q), Math.min(3500, left()), []);
    batch.forEach((url) => {
      if (seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    });
    if (urls.length >= 24) break;
  }

  const redditHits = await redditPromise;
  redditHits.urls.forEach((url) => {
    if (!seen.has(url)) {
      seen.add(url);
      urls.unshift(url);
    }
    const ctx = redditHits.contextByUrl.get(url);
    if (ctx) redditContextByUrl.set(url, ctx);
  });

  return { urls: urls.slice(0, 24), queries, redditContextByUrl };
}

async function fetchTikTokOembed(url) {
  const data = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    timeout: 4500,
    json: true,
  });
  if (!data?.title) return null;
  return {
    url,
    title: clip(data.title, 400).toLowerCase(),
    author: clip(data.author_name, 60).toLowerCase(),
    thumbnail: String(data.thumbnail_url || "").slice(0, 400),
  };
}

function analysisPrompt(product, sourceUrl, candidates) {
  const target = [
    product.brand ? `brand: ${product.brand}` : "",
    product.name ? `name: ${product.name}` : "",
    product.color ? `color: ${product.color}` : "",
    product.category ? `category: ${product.category}` : "",
    sourceUrl ? `listing: ${sourceUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const list = candidates
    .map((c, i) => {
      const reddit = c.reddit_context ? `\n   reddit context: ${c.reddit_context}` : "";
      return `${i + 1}. url: ${c.url}\n   caption: ${c.title}\n   creator: ${c.author || "unknown"}${c.thumbnail ? `\n   thumbnail: ${c.thumbnail}` : ""}${reddit}`;
    })
    .join("\n\n");

  return `You verify whether TikTok try-on videos show the SAME clothing product as the target listing.

Target product:
${target || "unknown product"}

Candidate TikToks (caption from oembed; some include reddit context where a shopper linked the video):
${list}

Return ONLY json:
{
  "videos": [
    {
      "url": "https://...",
      "match": "exact|possible|reject",
      "confidence": 0.0,
      "reason": "short lowercase reason",
      "claims": [
        {
          "text": "lowercase sizing/fit claim from caption only",
          "height": "5'3\" or empty",
          "size_worn": "26 or empty",
          "recommendation": "size down|size up|true to size|empty"
        }
      ]
    }
  ],
  "consensus": "1-2 lowercase sentences summarizing verified tiktok evidence for THIS exact product, or empty",
  "fit": "runs small|true to size|runs large|mixed|unknown",
  "fit_claims": [{"claim":"runs long","mentions":2}],
  "sentiment": {"positive":0,"mixed":0,"negative":0}
}

Rules:
- reject if caption explicitly names a different brand/product (e.g. roberto cavalli when target is jaded london)
- reject obvious mismatches even if keywords overlap (different tiger print jeans)
- exact = high confidence same sku; possible = same item likely but weaker evidence
- only extract claims literally supported by the caption or reddit context for that url — never invent height/size
- if nothing matches, videos=[] and consensus=""
- fit_claims only from verified exact matches`;
}

async function analyzeCandidates(openaiKey, product, sourceUrl, candidates) {
  if (!openaiKey || !candidates.length) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TIKTOK_MODEL || process.env.OPENAI_SCAN_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "you verify fashion tiktok videos against a product listing. never invent sizing claims or sources. explicit contradictory brand names override visual similarity.",
        },
        { role: "user", content: analysisPrompt(product, sourceUrl, candidates) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseJson(data.choices?.[0]?.message?.content);
}

async function visionBoost(openaiKey, product, verified) {
  const image = String(product.image || "").trim();
  if (!image || !openaiKey) return verified;
  const borderline = (verified?.videos || []).filter(
    (v) => v.match === "possible" && v.confidence >= 0.55 && v.confidence < 0.9
  );
  if (!borderline.length) return verified;

  const thumbs = borderline
    .map((v) => candidatesByUrl.get(v.url))
    .filter((c) => c?.thumbnail)
    .slice(0, 3);
  if (!thumbs.length) return verified;

  const content = [
    {
      type: "text",
      text: `Do these tiktok thumbnails show the same item as the product image?
Product: ${[product.brand, product.name, product.color].filter(Boolean).join(" ")}
Return json: {"urls":["only urls that visually match the product"],"notes":"short"}`,
    },
    { type: "image_url", image_url: { url: image } },
    ...thumbs.map((t) => ({ type: "image_url", image_url: { url: t.thumbnail } })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) return verified;
  const data = await res.json();
  const boost = parseJson(data.choices?.[0]?.message?.content);
  const boosted = new Set((boost?.urls || []).map((u) => String(u).split("?")[0]));
  if (!boosted.size) return verified;

  return {
    ...verified,
    videos: (verified.videos || []).map((v) => {
      if (boosted.has(String(v.url).split("?")[0])) {
        return { ...v, match: "exact", confidence: Math.max(Number(v.confidence) || 0, 0.88) };
      }
      return v;
    }),
  };
}

let candidatesByUrl = new Map();

function compactEvidence(raw, metaByUrl, queries, redditContextByUrl = new Map()) {
  const videos = [];
  const sizing_signals = [];
  const seenUrl = new Set();

  for (const row of raw?.videos || []) {
    const url = tiktokVideoUrl(row.url) || String(row.url || "").split("?")[0];
    if (!url || seenUrl.has(url)) continue;
    const match = String(row.match || "").toLowerCase();
    if (match === "reject") continue;
    const confidence = Math.max(0, Math.min(1, Number(row.confidence) || 0));
    if (match !== "exact" && confidence < 0.72) continue;
    seenUrl.add(url);
    const meta = metaByUrl.get(url) || {};
    videos.push({
      url,
      title: meta.title || "",
      author: meta.author || "",
      confidence,
      match: match === "exact" ? "exact" : "possible",
      reason: clip(row.reason, 120).toLowerCase(),
    });
    for (const claim of row.claims || []) {
      const text = clip(claim.text, 180).toLowerCase();
      if (!text || text.length < 12) continue;
      sizing_signals.push({
        text,
        height: clip(claim.height, 24).toLowerCase(),
        size_worn: clip(claim.size_worn, 24).toLowerCase(),
        recommendation: clip(claim.recommendation, 24).toLowerCase(),
        url,
        confidence,
      });
    }
  }

  const fit_claims = (raw?.fit_claims || [])
    .map((f) => ({
      claim: clip(f.claim, 80).toLowerCase(),
      mentions: Math.max(1, Number(f.mentions) || 1),
    }))
    .filter((f) => f.claim)
    .slice(0, 8);

  const fitRaw = String(raw?.fit || "").toLowerCase();
  const fit = /runs small|true to size|runs large|mixed|unknown/.test(fitRaw)
    ? fitRaw.match(/runs small|true to size|runs large|mixed|unknown/)[0]
    : "unknown";

  const sentiment = {
    positive: Math.max(0, Number(raw?.sentiment?.positive) || 0),
    mixed: Math.max(0, Number(raw?.sentiment?.mixed) || 0),
    negative: Math.max(0, Number(raw?.sentiment?.negative) || 0),
  };

  const consensus = clip(raw?.consensus, 280).toLowerCase();
  if (!consensus && !videos.length) return null;

  return {
    video_count: videos.length,
    consensus,
    fit,
    fit_claims,
    sizing_signals: sizing_signals.slice(0, 8),
    sentiment,
    videos: videos.slice(0, 8),
    queries_used: queries.slice(0, 12),
    coverage: {
      discovered: metaByUrl.size,
      verified: videos.length,
      reddit_links: redditContextByUrl.size,
    },
  };
}

export function tiktokReviewLine(evidence) {
  if (!evidence) return "";
  if (evidence.consensus) return clip(evidence.consensus, 200);
  const sig = evidence.sizing_signals?.[0];
  if (sig?.text) {
    const bits = [sig.height, sig.size_worn ? `size ${sig.size_worn}` : "", sig.text].filter(Boolean);
    return clip(`tiktok: ${bits.join(", ")}`, 200);
  }
  const top = evidence.fit_claims?.[0];
  if (top) return clip(`tiktok: ${top.claim} (${top.mentions} mentions)`, 200);
  if (evidence.video_count) return clip(`tiktok: ${evidence.video_count} relevant try-ons found`, 160);
  return "";
}

export function tiktokHighlights(evidence) {
  if (!evidence) return [];
  const out = [];
  const seen = new Set();
  for (const sig of evidence.sizing_signals || []) {
    const key = sig.text.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      channel: "tiktok",
      text: sig.text,
      url: sig.url || "",
    });
    if (out.length >= 4) break;
  }
  for (const v of evidence.videos || []) {
    if (!v.title || seen.has(v.title.slice(0, 60))) continue;
    seen.add(v.title.slice(0, 60));
    out.push({
      channel: "tiktok",
      text: v.title,
      url: v.url || "",
    });
    if (out.length >= 5) break;
  }
  return out;
}

export async function researchTikTokEvidence({
  product = {},
  sourceUrl = "",
  openaiKey = "",
  timeoutMs = 10000,
  imageUrl = "",
} = {}) {
  if (process.env.TIKTOK_RESEARCH === "0") return null;
  if (!sourceUrl && !product.name) return null;

  const enriched = { ...product, image: imageUrl || product.image || "" };
  const key = productFingerprint(enriched, sourceUrl);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const dbCached = await loadTikTokEvidence(key);
  if (dbCached !== undefined) {
    cache.set(key, { at: Date.now(), data: dbCached });
    return dbCached;
  }

  const budget = Math.max(3500, timeoutMs);
  const started = Date.now();
  const left = () => Math.max(300, budget - (Date.now() - started));

  const { urls, queries, redditContextByUrl } = await discoverTikTokUrls(enriched, Math.min(6500, left()));
  if (!urls.length) {
    cache.set(key, { at: Date.now(), data: null });
    saveTikTokEvidence({ fingerprint: key, product: enriched, sourceUrl, evidence: null, queries }).catch(() => {});
    return null;
  }

  const metas = await Promise.all(
    urls.slice(0, 18).map((url) => withTimeout(fetchTikTokOembed(url), Math.min(4000, left()), null))
  );
  const metaByUrl = new Map();
  const candidates = [];
  metas.forEach((m) => {
    if (!m?.url) return;
    const reddit = redditContextByUrl.get(m.url);
    if (reddit) m.reddit_context = reddit;
    metaByUrl.set(m.url, m);
    candidates.push(m);
  });
  if (!candidates.length) {
    cache.set(key, { at: Date.now(), data: null });
    saveTikTokEvidence({ fingerprint: key, product: enriched, sourceUrl, evidence: null, queries }).catch(() => {});
    return null;
  }

  candidatesByUrl = metaByUrl;
  let raw = await withTimeout(
    analyzeCandidates(openaiKey, enriched, sourceUrl, candidates.slice(0, 16)),
    Math.min(9000, left()),
    null
  );
  if (!raw && openaiKey) {
    cache.set(key, { at: Date.now(), data: null });
    saveTikTokEvidence({ fingerprint: key, product: enriched, sourceUrl, evidence: null, queries }).catch(() => {});
    return null;
  }

  if (raw && enriched.image) {
    raw = await withTimeout(visionBoost(openaiKey, enriched, raw), Math.min(5000, left()), raw);
  }

  const evidence = compactEvidence(raw, metaByUrl, queries, redditContextByUrl);
  cache.set(key, { at: Date.now(), data: evidence });
  saveTikTokEvidence({ fingerprint: key, product: enriched, sourceUrl, evidence, queries }).catch(() => {});
  return evidence;
}
