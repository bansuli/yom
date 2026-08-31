/**
 * Live shopper-review research for scans and on-site advice.
 * Pulls reddit, amazon, tiktok/youtube try-on hauls, instagram posts/reels,
 * shopmy, LTK, substack, the brand site, and clothing/sizing forums.
 * Never invents quotes — empty is better than a fake review.
 * Instagram stories are ephemeral and usually unreadble without login.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const REDDIT_UA = "web:yom-reviews:v1.0 (fashion shopping assistant)";

const FASHION_SUBS = [
  "femalefashionadvice",
  "malefashionadvice",
  "PetiteFashionAdvice",
  "plussize",
  "XXS",
  "tallfashionadvice",
  "ABraThatFits",
  "bigboobproblems",
  "Uniqlo",
  "Aritzia",
  "Reformation",
  "Ganni",
  "Sezane",
  "Madewell",
  "lululemon",
  "OutNOut",
  "fashion",
].join("+");

const SHOE_SUBS = ["sneakers", "RunningShoeGeeks", "WideFeet", "Nike", "adidas", "Newbalance", "Hoka"].join("+");

const SHOE_QUERY =
  /\b(shoe|shoes|heel|sandal|boot|mule|pump|loafer|sneaker|trainer|hoka|nike|adidas|veja|converse|birkenstock)\b/i;

const FORUM_HOSTS =
  /styleforum\.net|thefashionforum\.com|superthread\.com|thefashionspot\.com|makeupalley\.com|trustpilot\.com|sitejabber\.com|thecut\.com|refinery29\.com|whowhatwear\.com|reddit\.com|substack\.com/i;

const CHANNELS = new Set([
  "reddit",
  "amazon",
  "tiktok",
  "youtube",
  "instagram",
  "shopmy",
  "ltk",
  "substack",
  "brand",
  "forums",
]);

const SEARCHED = [
  "reddit",
  "amazon",
  "tiktok",
  "youtube",
  "instagram",
  "shopmy",
  "ltk",
  "substack",
  "brand",
  "forums",
];

function clip(value, max = 280) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+[—–−‒―]\s+/g, ". ")
    .replace(/(\w)[—―](\w)/g, "$1. $2")
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

export function reviewSearchQuery(product = {}, sourceUrl = "") {
  const brand = clip(product.brand, 40);
  const name = clip(product.name || product.guess, 80);
  const color = clip(product.color, 24);
  const category = clip(product.category, 24);
  const bits = [brand, name];
  if (color && !`${brand} ${name}`.toLowerCase().includes(color.toLowerCase())) bits.push(color);
  if (category && !`${brand} ${name}`.toLowerCase().includes(category.toLowerCase())) bits.push(category);
  const q = bits.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (q) return q;
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const slug = decodeURIComponent(new URL(sourceUrl).pathname)
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" ")
      .replace(/[-_]+/g, " ");
    return clip(`${host} ${slug}`, 90);
  } catch {
    return "";
  }
}

/**
 * Only for something she is deciding whether to buy.
 *
 * What strangers on tiktok think answers "is this worth ordering" — a question
 * about a page on a shop's website. It answers nothing about the dress already
 * hanging in her closet, and telling her the sizing runs small on a dress she
 * owns is noise on the way to the thing she asked: which day to wear it.
 *
 * So: a pasted link researches, a photo does not. Identifying a brand off a
 * photo is not the same as her shopping for it.
 */
export function shouldResearchReviews(product = {}, sourceUrl = "") {
  return Boolean(String(sourceUrl || "").trim());
}

function channelFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("reddit.com")) return "reddit";
    if (host.includes("amazon.")) return "amazon";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("instagram.com") || host.includes("instagr.am")) return "instagram";
    if (host.includes("shopmy") || host.includes("shopmyshelf")) return "shopmy";
    if (host.includes("ltk.com") || host.includes("liketoknow") || host.includes("rewardstyle") || host === "like.to") {
      return "ltk";
    }
    if (host.includes("substack.com")) return "substack";
    if (FORUM_HOSTS.test(host)) return "forums";
    return "web";
  } catch {
    return "web";
  }
}

function snippet(channel, text, url = "") {
  const t = clip(text, 240);
  if (!t || t.length < 24) return null;
  if (/write a review|be the first|star rating|sign in to/i.test(t)) return null;
  return { channel, text: t.toLowerCase(), url: String(url || "").slice(0, 300) };
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

async function searchReddit(query, product = {}) {
  if (!query) return [];
  const shoeish = SHOE_QUERY.test(`${query} ${product.category || ""} ${product.name || ""}`);
  const fitBits = shoeish
    ? `(review OR sizing OR "runs small" OR "half size up" OR "half size down" OR narrow OR wide OR "true to size")`
    : `(review OR sizing OR "runs small" OR "runs large" OR "true to size" OR fit)`;
  const q = encodeURIComponent(`${query} ${fitBits}`);
  const urls = [
    `https://www.reddit.com/search.json?q=${q}&sort=relevance&t=year&limit=10&type=link`,
    `https://www.reddit.com/r/${FASHION_SUBS}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&t=year&limit=8`,
  ];
  if (shoeish) {
    urls.push(
      `https://www.reddit.com/r/${SHOE_SUBS}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&t=year&limit=8`
    );
  }
  const rows = [];
  for (const url of urls) {
    const data = await fetchText(url, {
      timeout: 5500,
      json: true,
      headers: { "user-agent": REDDIT_UA },
    });
    const children = data?.data?.children || [];
    for (const child of children) {
      const post = child?.data || {};
      const permalink = post.permalink ? `https://www.reddit.com${post.permalink}` : post.url || "";
      const text = [post.title, post.selftext, post.body].filter(Boolean).join(" — ");
      const hit = snippet("reddit", text, permalink);
      if (hit) rows.push(hit);
      if (rows.length >= 8) break;
    }
    if (rows.length >= 8) break;
  }
  return rows;
}

async function searchDuckDuckGo(query, product = {}) {
  if (!query) return [];
  const shoeish = SHOE_QUERY.test(`${query} ${product.category || ""} ${product.name || ""}`);
  const searches = [
    `${query} review (reddit OR amazon OR tiktok OR shopmy OR ltk OR "like to know")`,
    `${query} ("try on" OR haul OR grwm OR "get ready with me") (tiktok OR youtube OR instagram OR ltk)`,
    `${query} (site:shopmy.us OR site:shopmyshelf.us OR site:shop.ltk.com OR site:liketoknow.it)`,
    `${query} (site:instagram.com OR site:substack.com) (review OR "try on" OR haul OR sizing)`,
    `${query} ("runs small" OR "true to size" OR "size up") (reddit OR forum OR sizing)`,
  ];
  if (shoeish) {
    searches.push(
      `${query} ("half size up" OR "half size down" OR "runs small" OR "narrow last" OR "true to size") (shoe OR sneaker OR boot)`,
      `${query} (site:runrepeat.com) (fit OR sizing OR size)`
    );
  }
  const rows = [];
  const seen = new Set();
  for (const q of searches) {
    const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { timeout: 5500 });
    if (!html) continue;
    const titles = [...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const snips = [...html.matchAll(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td class="result-snippet">([\s\S]*?)<\/td>/gi)].map(
      (m) => clip(m[1] || m[2], 220)
    );
    titles.forEach((m, i) => {
      const url = decodeDdgHref(m[1]);
      if (!url || seen.has(url)) return;
      seen.add(url);
      const hit = snippet(channelFromUrl(url), [clip(m[2], 140), snips[i] || ""].filter(Boolean).join(" — "), url);
      if (hit) rows.push(hit);
    });
    if (rows.length >= 10) break;
  }
  return rows.slice(0, 10);
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "").slice(0, 12);
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function tiktokUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("tiktok.com")) return "";
    if (/\/video\/\d+/.test(u.pathname) || u.hostname.startsWith("vm.")) return u.href.split("?")[0];
    return "";
  } catch {
    return "";
  }
}

function instagramUrl(url) {
  try {
    const u = new URL(url);
    if (!/instagram\.com|instagr\.am/i.test(u.hostname)) return "";
    // Stories expire and are not public oembed — skip rather than invent a caption.
    if (/\/stories\//i.test(u.pathname)) return "";
    if (/\/(p|reel|tv)\//i.test(u.pathname)) return u.href.split("?")[0];
    return "";
  } catch {
    return "";
  }
}

function creatorUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("shopmy") || host.includes("shopmyshelf")) return u.href.split("?")[0];
    if (host.includes("ltk.com") || host.includes("liketoknow") || host.includes("rewardstyle") || host === "like.to") {
      return u.href.split("?")[0];
    }
    return instagramUrl(url);
  } catch {
    return "";
  }
}

async function oembedTitle(url) {
  let endpoint = "";
  if (/tiktok\.com/i.test(url)) endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  else if (/youtube\.com|youtu\.be/i.test(url)) endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  else if (/instagram\.com/i.test(url)) endpoint = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
  else return null;
  const data = await fetchText(endpoint, { timeout: 4500, json: true });
  const title = clip(data?.title, 220);
  const author = clip(data?.author_name, 60);
  if (!title) return null;
  return snippet(channelFromUrl(url), author ? `${author}: ${title}` : title, url);
}

async function searchYoutubeHauls(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !query) return [];
  const q = `${query} try on OR haul OR grwm OR "get ready with me"`;
  const data = await fetchText(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`,
    { timeout: 5000, json: true }
  );
  const rows = [];
  for (const item of data?.items || []) {
    const id = item?.id?.videoId;
    const snip = item?.snippet || {};
    const url = id ? `https://www.youtube.com/watch?v=${id}` : "";
    const text = [snip.title, snip.description, snip.channelTitle].filter(Boolean).join(" — ");
    const hit = snippet("youtube", text, url);
    if (hit) rows.push(hit);
  }
  return rows.slice(0, 5);
}

async function searchHaulVideos(query) {
  if (!query) return [];
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${query} tiktok youtube instagram "try on" OR haul OR grwm OR "try-on haul" OR reel`)}`,
    { timeout: 5500 }
  );
  const urls = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/gi)) {
    const url = decodeDdgHref(m[1]);
    const tt = tiktokUrl(url);
    const yt = youtubeId(url);
    const ig = instagramUrl(url);
    const clean = tt || ig || (yt ? `https://www.youtube.com/watch?v=${yt}` : "");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    urls.push(clean);
    if (urls.length >= 8) break;
  }

  const [oembeds, youtube] = await Promise.all([
    Promise.all(urls.slice(0, 5).map((url) => oembedTitle(url))),
    searchYoutubeHauls(query),
  ]);

  return [...oembeds.filter(Boolean), ...youtube].slice(0, 8);
}

async function scrapeCreatorPage(url) {
  const html = await fetchText(url, { timeout: 5000 });
  if (!html) return null;
  const title =
    (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<title>([^<]+)<\/title>/i) ||
      [])[1] || "";
  const desc =
    (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      [])[1] || "";
  const fit = html.match(
    /((?:true to size|runs? (?:small|large|big|long|short)|size up|size down|wearing (?:a )?size)[^.!?<]{0,80})/i
  );
  const text = [title, desc, fit?.[1]].filter(Boolean).join(" — ");
  return snippet(channelFromUrl(url), text, url);
}

async function searchCreatorShelves(query) {
  if (!query) return [];
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      `${query} (site:shopmy.us OR site:shopmyshelf.us OR site:shop.ltk.com OR site:liketoknow.it OR site:instagram.com/p OR site:instagram.com/reel)`
    )}`,
    { timeout: 5500 }
  );
  const urls = [];
  const seen = new Set();
  for (const m of (html || "").matchAll(/href="([^"]+)"/gi)) {
    const url = decodeDdgHref(m[1]);
    const clean = creatorUrl(url);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    urls.push(clean);
    if (urls.length >= 6) break;
  }
  const rows = await Promise.all(urls.slice(0, 5).map((url) => scrapeCreatorPage(url)));
  return rows.filter(Boolean).slice(0, 6);
}

function walkJsonLd(node, out, depth = 0) {
  if (!node || depth > 8 || out.length >= 8) return;
  if (Array.isArray(node)) {
    node.forEach((item) => walkJsonLd(item, out, depth + 1));
    return;
  }
  if (typeof node !== "object") return;
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Review") && (node.reviewBody || node.description)) {
    const hit = snippet("brand", node.reviewBody || node.description, node.url || "");
    if (hit) out.push(hit);
  }
  if (types.includes("AggregateRating") && (node.ratingValue || node.reviewCount)) {
    const hit = snippet(
      "brand",
      `${node.ratingValue || "?"} / ${node.bestRating || 5} from ${node.reviewCount || "?"} reviews`,
      ""
    );
    if (hit) out.push(hit);
  }
  walkJsonLd(node.review, out, depth + 1);
  walkJsonLd(node.reviews, out, depth + 1);
  walkJsonLd(node["@graph"], out, depth + 1);
}

async function scrapeBrandPage(url) {
  if (!url) return [];
  const html = await fetchText(url, { timeout: 6000 });
  if (!html) return [];
  const rows = [];
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      walkJsonLd(JSON.parse(block[1]), rows);
    } catch {
      /* ignore broken json-ld */
    }
  }
  const fit = html.match(
    /((?:true to size|runs? (?:small|large|big|long|short|tight)|size up|size down|fits (?:true|small|large))[^.!?<]{0,90})/i
  );
  if (fit?.[1]) {
    const hit = snippet("brand", fit[1], url);
    if (hit) rows.push(hit);
  }
  const bodies = html.matchAll(
    /<(?:p|div|span)[^>]*(?:review-body|review__body|ReviewContent|yotpo|okendo|judgeme)[^>]*>[\s\S]{40,360}<\/(?:p|div|span)>/gi
  );
  for (const m of bodies) {
    const hit = snippet("brand", m[0], url);
    if (hit) rows.push(hit);
    if (rows.length >= 6) break;
  }
  return rows.slice(0, 6);
}

function textFromResponses(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    if (item?.type !== "message") continue;
    for (const c of item.content || []) {
      if (c?.text) parts.push(c.text);
    }
  }
  return parts.join("\n");
}

function reviewPrompt(product, sourceUrl, query, snippets) {
  const blob = (snippets || [])
    .slice(0, 12)
    .map((s) => `- [${s.channel}] ${s.text}${s.url ? ` (${s.url})` : ""}`)
    .join("\n");
  return `Research real shopper thoughts for this clothing product. Cover ALL of these that exist — do not invent a channel you did not find:
1. reddit (fashion + sizing + shoe subs)
2. amazon reviews
3. tiktok try-on hauls / GRWMs
4. youtube try-on hauls / GRWMs
5. instagram posts and reels (public captions only — disappearing stories cannot be read)
6. shopmy shelves / creator product notes
7. LTK / liketoknow.it
8. substack
9. the brand's own website reviews
10. clothing and sizing forums (styleforum, superthread, thefashionspot)

Product: ${query || [product.brand, product.name, product.color, product.category].filter(Boolean).join(" ")}
Brand: ${product.brand || "unknown"}
Piece: ${product.category || product.name || "unknown"}
Listing: ${sourceUrl || "none"}

Snippets we already fetched (may be incomplete):
${blob || "(none yet — search the live web)"}

Return ONLY json:
{
  "summary": "1-2 lowercase sentences of consensus, not an essay",
  "fit": "runs small|true to size|runs large|mixed|unknown",
  "fit_note": "one lowercase line on THIS piece's sizing, or empty",
  "size_shift": 0,
  "quality": "one lowercase line on fabric/quality/longevity, or empty",
  "occasions": "one lowercase line on when people wear it, or empty",
  "sentiment": "positive|mixed|negative|unknown",
  "channels": ["reddit","tiktok","shopmy","ltk","instagram","youtube","brand"],
  "highlights": [{"channel":"ltk","text":"...","url":"https://..."}]
}

Rules:
- never invent a quote, rating, url, or channel
- only list channels you actually found
- fit and size_shift are for THIS piece (this dress, these jeans, this sneaker), not the brand in general
- size_shift is how much to move from usual size: 0, 0.5, 1, -0.5, or -1. null if unknown. shoes often 0.5. do not invent a shift.
- for shoes: mention half sizes, width (narrow/wide last), and toe room when sources do
- prefer fit, fabric, pilling, shrinking, returns, size worn in a haul over "cute dress"
- max 5 highlights, lowercase, short
- if sources disagree, fit=mixed
- if nothing real is found, summary="" and channels=[]`;
}

async function openaiWebReviewSearch(key, product, sourceUrl, query, snippets) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_REVIEW_MODEL || "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      temperature: 0.2,
      input: reviewPrompt(product, sourceUrl, query, snippets),
    }),
  });
  if (res.ok) {
    const data = await res.json();
    return parseJson(textFromResponses(data));
  }

  const chat = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || "gpt-4o-mini-search-preview",
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "you research clothing reviews across reddit, amazon, tiktok/youtube try-on hauls, instagram posts/reels, shopmy, ltk, substack, brand sites, and sizing forums. never invent sources. you cannot read instagram stories.",
        },
        { role: "user", content: reviewPrompt(product, sourceUrl, query, snippets) },
      ],
    }),
  });
  if (!chat.ok) return null;
  const data = await chat.json();
  return parseJson(data.choices?.[0]?.message?.content);
}

async function synthesizeFromSnippets(key, product, sourceUrl, query, snippets) {
  if (!snippets.length) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SCAN_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "summarize only the review snippets given. do not invent a source, quote, or channel that is not in the snippets.",
        },
        { role: "user", content: reviewPrompt(product, sourceUrl, query, snippets) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseJson(data.choices?.[0]?.message?.content);
}

function fallbackSummary(snippets) {
  const fit = snippets.find((s) => /runs? (small|large)|true to size|size up|size down|tight in the/i.test(s.text));
  const first = snippets[0];
  if (!first) return "";
  if (fit) return clip(`shoppers keep mentioning fit: ${fit.text}`, 220);
  return clip(`from ${first.channel}: ${first.text}`, 220);
}

function compactBrief(raw, gathered) {
  const highlights = [];
  const seen = new Set();
  const push = (item) => {
    if (!item?.text) return;
    let channel = CHANNELS.has(item.channel) ? item.channel : channelFromUrl(item.url || "");
    if (channel === "web") {
      channel = FORUM_HOSTS.test(item.url || "") ? "forums" : channelFromUrl(item.url || "");
    }
    if (channel === "web") return;
    const key = `${channel}:${item.text.slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    highlights.push({
      channel,
      text: clip(item.text, 200).toLowerCase(),
      url: String(item.url || "").slice(0, 300),
    });
  };
  gathered.forEach(push);
  (Array.isArray(raw?.highlights) ? raw.highlights : []).forEach(push);

  const channels = [];
  const addCh = (c) => {
    if (c === "web") return;
    if (!CHANNELS.has(c)) return;
    if (!channels.includes(c)) channels.push(c);
  };
  (Array.isArray(raw?.channels) ? raw.channels : []).forEach(addCh);
  highlights.forEach((h) => addCh(h.channel));

  const summary = clip(raw?.summary || fallbackSummary(gathered), 280).toLowerCase();
  if (!summary && !highlights.length) return null;

  const blob = `${summary} ${highlights.map((h) => h.text).join(" ")}`;
  const fitRaw = String(raw?.fit || "").toLowerCase();
  const fit = /runs small|true to size|runs large|mixed|unknown/.test(fitRaw)
    ? fitRaw.match(/runs small|true to size|runs large|mixed|unknown/)[0]
    : /runs small|size up|tight/i.test(blob)
      ? "runs small"
      : /runs large|size down|roomy/i.test(blob)
        ? "runs large"
        : /true to size/i.test(blob)
          ? "true to size"
          : highlights.length
            ? "mixed"
            : "unknown";

  const shiftRaw = Number(raw?.size_shift);
  const size_shift = [-1, -0.5, 0, 0.5, 1].includes(shiftRaw) ? shiftRaw : null;

  const brief = {
    summary,
    fit,
    fit_note: clip(raw?.fit_note, 180).toLowerCase(),
    size_shift,
    quality: clip(raw?.quality, 180).toLowerCase(),
    occasions: clip(raw?.occasions, 140).toLowerCase(),
    sentiment: /^(positive|mixed|negative|unknown)$/.test(String(raw?.sentiment || ""))
      ? String(raw.sentiment).toLowerCase()
      : "unknown",
    channels: channels.slice(0, 8),
    highlights: highlights.slice(0, 5),
    coverage: { searched: SEARCHED, found: channels.slice(0, 8) },
  };
  brief.regret_delta = reviewRegretDelta(brief);
  return brief;
}

export function reviewRegretDelta(brief) {
  if (!brief?.channels?.length && !brief?.highlights?.length) return 0;
  let n = 0;
  if (brief.fit === "runs small") n += 8;
  if (brief.fit === "runs large") n += 4;
  if (brief.fit === "true to size") n -= 4;
  if (brief.sentiment === "negative") n += 14;
  if (brief.sentiment === "positive") n -= 6;
  if (brief.sentiment === "mixed") n += 4;
  const blob = `${brief.fit_note || ""} ${brief.quality || ""} ${brief.summary || ""} ${(brief.highlights || [])
    .map((h) => h.text)
    .join(" ")}`;
  if (/pill|thin|sheer|cheap|scratch|fell apart|return/i.test(blob)) n += 10;
  if (/worth it|kept it|true to size/i.test(blob) && brief.sentiment === "positive") n -= 4;
  return Math.max(-18, Math.min(18, n));
}

export function reviewLine(brief) {
  if (!brief) return "";
  if (brief.fit_note) return clip(brief.fit_note, 160);
  const hit =
    (brief.highlights || []).find((h) => /fit|size|run|pill|fabric|quality|haul/i.test(h.text)) ||
    brief.highlights?.[0];
  if (hit) return clip(`${hit.channel}: ${hit.text}`, 160);
  return clip(brief.summary, 160);
}

export function formatReviewsForPrompt(brief) {
  if (!brief?.summary && !brief?.highlights?.length) return "";
  return [
    brief.summary ? `summary: ${brief.summary}` : "",
    brief.fit_note ? `fit: ${brief.fit_note}` : brief.fit && brief.fit !== "unknown" ? `fit: ${brief.fit}` : "",
    brief.size_shift != null && brief.size_shift !== 0 ? `size_shift: ${brief.size_shift}` : "",
    brief.quality ? `quality: ${brief.quality}` : "",
    brief.occasions ? `occasions: ${brief.occasions}` : "",
    brief.channels?.length ? `channels found: ${brief.channels.join(", ")}` : "",
    brief.coverage?.searched?.length ? `channels searched: ${brief.coverage.searched.join(", ")}` : "",
    ...(brief.highlights || []).slice(0, 6).map((h) => `- [${h.channel}] ${h.text}${h.url ? ` (${h.url})` : ""}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function attachReviews(verdict, brief) {
  if (!brief?.summary && !brief?.highlights?.length) return verdict;
  const details = Array.isArray(verdict?.details) ? [...verdict.details] : [];
  if (brief.summary && !details.some((d) => d.key === "reviews")) {
    details.push({ key: "reviews", label: "what people say", text: brief.summary });
  }
  if (brief.fit_note && !details.some((d) => d.key === "fit")) {
    details.push({ key: "fit", label: "fit from reviews", text: brief.fit_note });
  }
  if (brief.quality && !details.some((d) => d.key === "material")) {
    details.push({ key: "material", label: "material", text: brief.quality });
  }
  return {
    ...(verdict || {}),
    details,
    reviews: brief,
  };
}

export async function researchProductReviews({
  product = {},
  sourceUrl = "",
  openaiKey = "",
  pageReviews = "",
  timeoutMs = 12000,
} = {}) {
  if (!shouldResearchReviews(product, sourceUrl)) return null;
  const query = reviewSearchQuery(product, sourceUrl);
  if (!query) return null;

  const budget = Math.max(4000, timeoutMs);
  const started = Date.now();
  const left = () => Math.max(400, budget - (Date.now() - started));

  const pageHits = pageReviews ? [snippet("brand", pageReviews, sourceUrl)].filter(Boolean) : [];

  const [reddit, web, brand, hauls, creators] = await Promise.all([
    withTimeout(searchReddit(query, product), Math.min(6500, left()), []),
    withTimeout(searchDuckDuckGo(query, product), Math.min(6500, left()), []),
    sourceUrl ? withTimeout(scrapeBrandPage(sourceUrl), Math.min(6500, left()), []) : [],
    withTimeout(searchHaulVideos(query), Math.min(7000, left()), []),
    withTimeout(searchCreatorShelves(query), Math.min(6500, left()), []),
  ]);

  const gathered = [...reddit, ...web, ...brand, ...hauls, ...creators, ...pageHits].filter(Boolean);

  let raw = null;
  if (openaiKey) {
    raw = await withTimeout(
      openaiWebReviewSearch(openaiKey, product, sourceUrl, query, gathered),
      Math.min(9000, left()),
      null
    );
    if (!raw?.summary && gathered.length) {
      raw = await withTimeout(
        synthesizeFromSnippets(openaiKey, product, sourceUrl, query, gathered),
        Math.min(5000, left()),
        raw
      );
    }
  }

  return compactBrief(raw, gathered);
}
