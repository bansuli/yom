/**
 * Fetch real storefronts and run the size matcher on whatever the HTML
 * actually contains (JSON-LD, Shopify variants, selects, size buttons).
 * This is not a full Chrome DOM, so button-only pickers that hydrate late
 * will under-count vs the extension. Fetch failures are recorded, not guessed.
 */
import {
  collectOptions,
  detectFamily,
  detectPiece,
  jsonLdSizeOptions,
  matchUserSize,
  normalizeLabel,
  parseFitNote,
  parseModelSize,
  shopifySizeIndex,
} from "../lib/size-read.js";
import { writeFileSync } from "fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const SHOPPER = {
  us: "US 4",
  denim: "26",
  shoes: "7.5",
};

const TARGETS = [
  { shop: "Reformation", tier: "mid", kind: "dress", url: "https://www.thereformation.com/products/agathe-dress/1320566.html" },
  { shop: "Reformation", tier: "mid", kind: "dress", url: "https://www.thereformation.com/dresses" },
  { shop: "Aritzia", tier: "mid", kind: "pants", url: "https://www.aritzia.com/us/en/product/the-effortless-pant/104142.html" },
  { shop: "Aritzia", tier: "mid", kind: "top", url: "https://www.aritzia.com/us/en/clothing/tops" },
  { shop: "COS", tier: "mid", kind: "dress", url: "https://www.cos.com/en-us/women/dresses" },
  { shop: "Arket", tier: "mid", kind: "knit", url: "https://www.arket.com/en-us/women/knitwear" },
  { shop: "Uniqlo", tier: "budget", kind: "top", url: "https://www.uniqlo.com/us/en/women/tops" },
  { shop: "Uniqlo", tier: "budget", kind: "jeans", url: "https://www.uniqlo.com/us/en/women/jeans" },
  { shop: "Gap", tier: "budget", kind: "jeans", url: "https://www.gap.com/browse/category.do?cid=5664" },
  { shop: "Old Navy", tier: "budget", kind: "jeans", url: "https://oldnavy.gap.com/browse/category.do?cid=3048896" },
  { shop: "H&M", tier: "budget", kind: "dress", url: "https://www2.hm.com/en_us/women/products/dresses.html" },
  { shop: "Zara", tier: "budget", kind: "dress", url: "https://www.zara.com/us/en/woman-dresses-l1066.html" },
  { shop: "Mango", tier: "budget", kind: "dress", url: "https://shop.mango.com/us/women/dresses" },
  { shop: "Madewell", tier: "mid", kind: "jeans", url: "https://www.madewell.com/womens/jeans" },
  { shop: "Everlane", tier: "mid", kind: "top", url: "https://www.everlane.com/collections/womens-tees" },
  { shop: "J.Crew", tier: "mid", kind: "dress", url: "https://www.jcrew.com/r/womens_dresses" },
  { shop: "Free People", tier: "mid", kind: "dress", url: "https://www.freepeople.com/dresses/" },
  { shop: "Urban Outfitters", tier: "mid", kind: "top", url: "https://www.urbanoutfitters.com/womens-tops" },
  { shop: "Anthropologie", tier: "mid", kind: "dress", url: "https://www.anthropologie.com/dresses" },
  { shop: "Abercrombie", tier: "budget", kind: "jeans", url: "https://www.abercrombie.com/shop/us/womens-jeans" },
  { shop: "Hollister", tier: "budget", kind: "jeans", url: "https://www.hollisterco.com/shop/us/womens-jeans" },
  { shop: "American Eagle", tier: "budget", kind: "jeans", url: "https://www.ae.com/us/en/c/women/jeans/cat4840004" },
  { shop: "Pacsun", tier: "budget", kind: "jeans", url: "https://www.pacsun.com/womens/jeans/" },
  { shop: "ASOS", tier: "budget", kind: "dress", url: "https://www.asos.com/us/women/dresses/" },
  { shop: "Revolve", tier: "mid", kind: "dress", url: "https://www.revolve.com/dresses/br/a8eb0c/" },
  { shop: "Shopbop", tier: "premium", kind: "dress", url: "https://www.shopbop.com/dresses/br/v=1/2534374302026437.htm" },
  { shop: "Nordstrom", tier: "premium", kind: "dress", url: "https://www.nordstrom.com/browse/women/clothing/dresses" },
  { shop: "SSENSE", tier: "premium", kind: "dress", url: "https://www.ssense.com/en-us/women/dresses" },
  { shop: "Farfetch", tier: "premium", kind: "dress", url: "https://www.farfetch.com/shopping/women/dresses-1/items.aspx" },
  { shop: "Net-a-Porter", tier: "premium", kind: "dress", url: "https://www.net-a-porter.com/en-us/shop/clothing/dresses" },
  { shop: "Saks", tier: "premium", kind: "dress", url: "https://www.saksfifthavenue.com/c/women/dresses" },
  { shop: "Ganni", tier: "premium", kind: "dress", url: "https://www.ganni.com/en-us/dresses" },
  { shop: "Toteme", tier: "premium", kind: "dress", url: "https://www.toteme.com/en-us/dresses" },
  { shop: "Acne Studios", tier: "premium", kind: "jeans", url: "https://www.acnestudios.com/us/en/women/jeans" },
  { shop: "Lululemon", tier: "mid", kind: "pants", url: "https://shop.lululemon.com/c/women-leggings/_/N-8r6" },
  { shop: "Alo", tier: "mid", kind: "pants", url: "https://www.aloyoga.com/collections/womens-pants" },
  { shop: "Skims", tier: "mid", kind: "top", url: "https://skims.com/collections/womens-tops" },
  { shop: "Princess Polly", tier: "budget", kind: "dress", url: "https://us.princesspolly.com/collections/dresses" },
  { shop: "Oh Polly", tier: "budget", kind: "dress", url: "https://www.ohpolly.com/collections/dresses" },
  { shop: "Nike", tier: "mid", kind: "shoes", url: "https://www.nike.com/w/womens-shoes-5e1x6zy7ok" },
  { shop: "Adidas", tier: "mid", kind: "shoes", url: "https://www.adidas.com/us/women-shoes" },
  { shop: "Levi's", tier: "mid", kind: "jeans", url: "https://www.levi.com/US/en_US/clothing/women/jeans/c/levi_clothing_women_jeans" },
  { shop: "Everlane", tier: "mid", kind: "jeans", url: "https://www.everlane.com/collections/womens-denim" },
  { shop: "COS", tier: "mid", kind: "pants", url: "https://www.cos.com/en-us/women/trousers" },
  { shop: "Reformation", tier: "mid", kind: "jeans", url: "https://www.thereformation.com/jeans" },
  { shop: "Aritzia", tier: "mid", kind: "dress", url: "https://www.aritzia.com/us/en/clothing/dresses" },
  { shop: "Madewell", tier: "mid", kind: "dress", url: "https://www.madewell.com/womens/dresses" },
  { shop: "Gap", tier: "budget", kind: "dress", url: "https://www.gap.com/browse/category.do?cid=13675" },
  { shop: "Uniqlo", tier: "budget", kind: "dress", url: "https://www.uniqlo.com/us/en/women/dresses" },
  { shop: "H&M", tier: "budget", kind: "jeans", url: "https://www2.hm.com/en_us/women/products/jeans.html" },
  { shop: "Zara", tier: "budget", kind: "shoes", url: "https://www.zara.com/us/en/woman-shoes-l1251.html" },
  { shop: "Mango", tier: "budget", kind: "jeans", url: "https://shop.mango.com/us/women/jeans" },
  { shop: "Free People", tier: "mid", kind: "jeans", url: "https://www.freepeople.com/jeans/" },
  { shop: "Anthropologie", tier: "mid", kind: "jeans", url: "https://www.anthropologie.com/jeans" },
  { shop: "Nordstrom", tier: "premium", kind: "shoes", url: "https://www.nordstrom.com/browse/women/shoes" },
  { shop: "SSENSE", tier: "premium", kind: "shoes", url: "https://www.ssense.com/en-us/women/shoes" },
  { shop: "Farfetch", tier: "premium", kind: "shoes", url: "https://www.farfetch.com/shopping/women/shoes-2/items.aspx" },
  { shop: "Nike", tier: "mid", kind: "shoes", url: "https://www.nike.com/t/dunk-low-womens-shoes-PPQKdP/DD1503-101" },
  { shop: "Adidas", tier: "mid", kind: "shoes", url: "https://www.adidas.com/us/samba-og-shoes/B75807.html" },
];

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function jsonLdProducts(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const parsed = parseJson(m[1].trim());
    if (!parsed) continue;
    const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
    for (const n of nodes) {
      const t = n?.["@type"];
      if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) out.push(n);
    }
  }
  return out;
}

function shopifyRows(html, family) {
  const rows = [];
  const chunks = html.split(/"variants"\s*:/);
  for (const chunk of chunks.slice(1, 4)) {
    const start = html.lastIndexOf("{", html.indexOf(chunk));
    if (start < 0) continue;
    const slice = html.slice(Math.max(0, start - 800), start + 180000);
    const brace = slice.indexOf("{");
    const end = slice.lastIndexOf("}");
    if (brace < 0 || end <= brace) continue;
    const parsed = parseJson(slice.slice(brace, end + 1));
    const product = parsed?.product || parsed;
    const variants = product?.variants;
    if (!Array.isArray(variants) || !variants.length) continue;
    const options = product?.options || [];
    const sizeIdx = shopifySizeIndex(options);
    if (sizeIdx < 0) continue;
    for (const v of variants) {
      const raw = v[`option${sizeIdx + 1}`] || v.options?.[sizeIdx];
      const parsedOpt = normalizeLabel(raw, family);
      if (!parsedOpt) continue;
      rows.push({
        raw: parsedOpt.raw,
        label: parsedOpt.label,
        available: v.available !== false,
        selected: false,
      });
    }
    if (rows.length) break;
  }
  return rows;
}

function htmlRows(html, family) {
  const rows = [];
  const push = (raw, available = true) => {
    const parsed = normalizeLabel(raw, family);
    if (!parsed) return;
    rows.push({ raw: parsed.raw, label: parsed.label, available, selected: false });
  };
  const selects = html.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi);
  for (const m of selects) push(m[1].replace(/<[^>]+>/g, " "));
  const arias = html.matchAll(/aria-label=["']([^"']*size[^"']*)["']/gi);
  for (const m of arias) push(m[1]);
  const dataVals = html.matchAll(/data-(?:attr-)?value=["']([^"']{1,20})["']/gi);
  for (const m of dataVals) push(m[1]);
  const buttons = html.matchAll(/<(?:button|li|span)[^>]{0,180}(?:size)[^>]{0,80}>([\s\S]{0,40}?)<\//gi);
  for (const m of buttons) push(m[1].replace(/<[^>]+>/g, " "));
  return rows;
}

function firstProductUrl(html, base) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    if (/\/products?\//i.test(href) || /\/product\//i.test(href) || /\/t\/[a-z0-9-]+/i.test(href)) {
      try {
        return new URL(href, base).href.split("?")[0];
      } catch {
        /* skip */
      }
    }
  }
  return "";
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html, finalUrl: res.url || url };
  } catch (e) {
    return { ok: false, status: 0, html: "", error: e?.message || "fetch failed", finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

function extract(html, url, hintKind) {
  const info = { name: hintKind, href: url, category: hintKind, text: html.slice(0, 4000) };
  const family = detectFamily(info);
  const piece = detectPiece(info);
  const products = jsonLdProducts(html);
  const ld = products.flatMap((p) => jsonLdSizeOptions(p, family));
  const shopify = shopifyRows(html, family);
  const markup = htmlRows(html, family);
  const options = collectOptions([...ld, ...shopify, ...markup], family);
  const fitNote = parseFitNote(html.replace(/<[^>]+>/g, " ").slice(0, 8000));
  const modelSize = parseModelSize(html.replace(/<[^>]+>/g, " ").slice(0, 8000));
  const source = ld.length ? "json-ld" : shopify.length ? "shopify" : markup.length ? "html" : "none";
  const extracted = {
    family,
    piece,
    name: hintKind,
    href: url,
    options,
    labels: options.map((o) => o.label),
    fitNote,
    modelSize,
  };
  const match = matchUserSize(extracted, SHOPPER, { brand: "", piece, name: hintKind });
  return { family, piece, source, options, match, fitNote };
}

function looksLikePdp(url, html) {
  if (/\/products?\//i.test(url) || /\/product\//i.test(url) || /\/t\/[a-z0-9-]+/i.test(url)) return true;
  return /"@type"\s*:\s*"Product"/.test(html) && /add to (bag|cart)/i.test(html);
}

async function runOne(target) {
  const first = await fetchHtml(target.url);
  if (!first.ok) {
    return {
      shop: target.shop,
      tier: target.tier,
      kind: target.kind,
      url: target.url,
      status: first.status,
      error: first.error || `http ${first.status}`,
      optionCount: 0,
      labels: [],
      family: "",
      source: "blocked",
      line: "",
      matchStatus: "",
      listingLabel: "",
    };
  }
  let pageUrl = first.finalUrl;
  let html = first.html;
  if (!looksLikePdp(pageUrl, html)) {
    const next = firstProductUrl(html, pageUrl);
    if (next && next !== pageUrl) {
      const pdp = await fetchHtml(next);
      if (pdp.ok) {
        pageUrl = pdp.finalUrl;
        html = pdp.html;
      }
    }
  }
  const got = extract(html, pageUrl, target.kind);
  return {
    shop: target.shop,
    tier: target.tier,
    kind: target.kind,
    url: pageUrl,
    status: 200,
    error: "",
    optionCount: got.options.length,
    labels: got.options.slice(0, 8).map((o) => o.label),
    family: got.family,
    source: got.source,
    line: got.match.line || "",
    matchStatus: got.match.status || (got.match.ask ? "ask" : ""),
    listingLabel: got.match.listingLabel || "",
    fitNote: got.fitNote || "",
  };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

const rows = await pool(TARGETS, 6, runOne);
const fetched = rows.filter((r) => r.status === 200);
const withSizes = fetched.filter((r) => r.optionCount > 0);
const matched = withSizes.filter((r) => r.matchStatus && r.matchStatus !== "unknown" && r.matchStatus !== "ask");
const summary = {
  attempted: rows.length,
  fetched: fetched.length,
  withSizes: withSizes.length,
  matched: matched.length,
  blocked: rows.filter((r) => r.status !== 200).length,
  emptyPicker: fetched.filter((r) => r.optionCount === 0).length,
};
const outPath = new URL("../.tmp-size-live.json", import.meta.url);
writeFileSync(outPath, JSON.stringify({ summary, shopper: SHOPPER, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
for (const r of rows) {
  const mark = r.optionCount > 0 ? "ok" : r.status !== 200 ? "no" : "empty";
  console.log(
    `${mark.padEnd(5)} ${String(r.shop).padEnd(18)} ${r.kind.padEnd(7)} ${String(r.optionCount).padStart(2)} ${r.source.padEnd(8)} ${r.listingLabel || r.error || r.matchStatus || ""}`
  );
}
console.log(`\nwrote ${outPath.pathname}`);
