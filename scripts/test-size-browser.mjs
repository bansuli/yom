/**
 * Browser-based live sizing test — loads real PDPs in Chromium so
 * client-hydrated pickers are visible. Uses lib/size-read.js for matching.
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
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

const SHOPPER = { us: "US 4", denim: "26", shoes: "7.5" };

/** Entry URLs — category or PDP; script follows first product link when needed */
const TARGETS = [
  { shop: "Reformation", tier: "mid", kind: "dress", url: "https://www.thereformation.com/products/agathe-dress/1320566.html" },
  { shop: "Reformation", tier: "mid", kind: "jeans", url: "https://www.thereformation.com/jeans" },
  { shop: "Aritzia", tier: "mid", kind: "pants", url: "https://www.aritzia.com/us/en/product/the-effortless-pant/104142.html" },
  { shop: "Aritzia", tier: "mid", kind: "dress", url: "https://www.aritzia.com/us/en/clothing/dresses" },
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
  { shop: "Everlane", tier: "mid", kind: "jeans", url: "https://www.everlane.com/collections/womens-denim" },
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
  { shop: "Nike", tier: "mid", kind: "shoes", url: "https://www.nike.com/t/dunk-low-womens-shoes-PPQKdP/DD1503-101" },
  { shop: "Adidas", tier: "mid", kind: "shoes", url: "https://www.adidas.com/us/samba-og-shoes/B75807.html" },
  { shop: "Levi's", tier: "mid", kind: "jeans", url: "https://www.levi.com/US/en_US/clothing/women/jeans/c/levi_clothing_women_jeans" },
  { shop: "Hoka", tier: "mid", kind: "shoes", url: "https://www.hoka.com/en/us/womens" },
  { shop: "New Balance", tier: "mid", kind: "shoes", url: "https://www.newbalance.com/women/shoes/" },
  { shop: "Birkenstock", tier: "mid", kind: "shoes", url: "https://www.birkenstock.com/us/women" },
  { shop: "Dr. Martens", tier: "mid", kind: "shoes", url: "https://www.drmartens.com/us/en/womens" },
  { shop: "Nordstrom", tier: "premium", kind: "shoes", url: "https://www.nordstrom.com/browse/women/shoes" },
  { shop: "SSENSE", tier: "premium", kind: "shoes", url: "https://www.ssense.com/en-us/women/shoes" },
  { shop: "Zara", tier: "budget", kind: "shoes", url: "https://www.zara.com/us/en/woman-shoes-l1251.html" },
  { shop: "H&M", tier: "budget", kind: "jeans", url: "https://www2.hm.com/en_us/women/products/jeans.html" },
  { shop: "Gap", tier: "budget", kind: "dress", url: "https://www.gap.com/browse/category.do?cid=13675" },
  { shop: "Quince", tier: "budget", kind: "dress", url: "https://www.quince.com/women/dresses" },
  { shop: "Sezane", tier: "mid", kind: "dress", url: "https://www.sezane.com/us-en/category/dresses" },
  { shop: "& Other Stories", tier: "mid", kind: "dress", url: "https://www.stories.com/en-us/women/dresses" },
  { shop: "Banana Republic", tier: "mid", kind: "pants", url: "https://bananarepublic.gap.com/browse/category.do?cid=1047994" },
  { shop: "Athleta", tier: "mid", kind: "pants", url: "https://athleta.gap.com/browse/category.do?cid=51588" },
  { shop: "Madewell", tier: "mid", kind: "dress", url: "https://www.madewell.com/womens/dresses" },
  { shop: "Anthropologie", tier: "mid", kind: "jeans", url: "https://www.anthropologie.com/jeans" },
  { shop: "Free People", tier: "mid", kind: "jeans", url: "https://www.freepeople.com/jeans/" },
];

/** In-page DOM extraction (mirrors extension/content/sizes.js) */
const DOM_EXTRACT = () => {
  const SIZE = /(?:^|[\s_-])(size|sizes|waist|length|width|fit)(?:$|[\s_-])/i;
  const COLOR = /color|colour|swatch/i;
  const OOS = /sold[- ]?out|unavailable|out[- ]of[- ]stock|\boos\b/i;
  const clip = (t, n = 40) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);
  const labels = [];
  const seen = new Set();
  const push = (raw, available = true) => {
    const t = clip(raw);
    if (!t || seen.has(t.toLowerCase())) return;
    if (/select|choose|guide|size chart/i.test(t)) return;
    seen.add(t.toLowerCase());
    labels.push({ raw: t, label: t.toLowerCase(), available, selected: false });
  };
  const host = location.hostname.toLowerCase();
  const skip = (n) =>
    n.closest(
      "#yom-root, [class*='Recommend'], [class*='CrossSell'], [class*='CompleteTheLook'], [class*='carousel'], footer"
    );
  const known = [
    [/thereformation\.com/, "main [class*='SizeSelector'] button, [data-testid='product-form'] [class*='SizeSelector'] button"],
    [/aritzia\.com/, "[data-testid*='size' i] button, fieldset[class*='Size'] button"],
    [/nike\.com/, "[data-testid='sku-item-selector'] button, fieldset[aria-label*='size' i] button"],
    [/adidas\./, "[data-testid='size-selector'] button, [class*='size-selector'] button"],
    [/ssense\.com/, ".pdp-product-sizes button, [class*='SizeButton']"],
    [/farfetch\.com/, "[data-testid*='size' i] button"],
    [/net-a-porter\.com/, "[class*='SizeSelector'] button"],
    [/zara\.com/, ".size-selector li, [class*='product-size'] button"],
    [/cos\.com|arket\.com|stories\.com/, "[class*='product-sizes'] button, [class*='SizePicker'] button"],
    [/uniqlo\.com/, "[class*='size-list'] button, [data-test*='size'] button"],
    [/lululemon\.com/, "[class*='sizeSelector'] button"],
    [/madewell\.com|jcrew\.com|gap\.com|oldnavy/, "[class*='size-selector'] button, [data-testid*='size'] button"],
    [/shopify/, "[class*='size'] button, [data-option-name='Size'] button"],
  ];
  for (const [re, sel] of known) {
    if (!re.test(host)) continue;
    document.querySelectorAll(sel).forEach((n) => {
      if (skip(n)) return;
      const t = clip(n.textContent) || n.getAttribute("aria-label") || n.getAttribute("data-value");
      const oos = OOS.test(`${t} ${n.className} ${n.getAttribute("aria-disabled")}`);
      push(t, !oos && !n.disabled);
    });
  }
  document.querySelectorAll("select[name*='size' i], select[aria-label*='size' i]").forEach((sel) => {
    [...sel.options].forEach((opt) => push(opt.textContent || opt.value, !opt.disabled));
  });
  document.querySelectorAll("fieldset, [role='radiogroup'], [class*='size-selector'], [class*='SizePicker']").forEach((g) => {
    const blob = `${g.className} ${g.getAttribute("aria-label") || ""}`;
    if (COLOR.test(blob) && !SIZE.test(blob)) return;
    if (!SIZE.test(blob) && !/size/i.test(g.textContent?.slice(0, 30) || "")) return;
    g.querySelectorAll("button, [role='radio'], [role='option'], li, label").forEach((n) => {
      if (COLOR.test(n.className) && !SIZE.test(n.className)) return;
      push(n.textContent || n.getAttribute("aria-label") || n.getAttribute("data-value"), !n.disabled);
    });
  });
  document.querySelectorAll("button[aria-label*='size' i], [data-attr-value]").forEach((n) => {
    push(n.textContent || n.getAttribute("aria-label") || n.getAttribute("data-attr-value"), !n.disabled);
  });
  return labels;
};

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
      rows.push({ raw: parsedOpt.raw, label: parsedOpt.label, available: v.available !== false, selected: false });
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
  for (const m of html.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)) push(m[1].replace(/<[^>]+>/g, " "));
  for (const m of html.matchAll(/aria-label=["']([^"']*size[^"']*)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/data-(?:attr-)?value=["']([^"']{1,20})["']/gi)) push(m[1]);
  return rows;
}

function mergeDomRows(domRows, family) {
  const rows = [];
  for (const r of domRows || []) {
    const parsed = normalizeLabel(r.raw || r.label, family);
    if (!parsed) continue;
    rows.push({ raw: parsed.raw, label: parsed.label, available: r.available !== false, selected: !!r.selected });
  }
  return rows;
}

function extractFromHtml(html, url, hintKind, domRows = []) {
  const info = { name: hintKind, href: url, category: hintKind, text: html.slice(0, 4000) };
  const family = detectFamily(info);
  const piece = detectPiece(info);
  const ld = jsonLdProducts(html).flatMap((p) => jsonLdSizeOptions(p, family));
  const shopify = shopifyRows(html, family);
  const markup = htmlRows(html, family);
  const dom = mergeDomRows(domRows, family);
  const options = collectOptions([...dom, ...ld, ...shopify, ...markup], family);
  const text = html.replace(/<[^>]+>/g, " ").slice(0, 8000);
  const fitNote = parseFitNote(text);
  const extracted = { family, piece, name: hintKind, href: url, options, labels: options.map((o) => o.label), fitNote };
  const match = matchUserSize(extracted, SHOPPER, { brand: "", piece, name: hintKind });
  const source = dom.length ? "dom" : ld.length ? "json-ld" : shopify.length ? "shopify" : markup.length ? "html" : "none";
  return { family, piece, source, options, match, fitNote };
}

function looksLikePdp(url) {
  return /\/products?\//i.test(url) || /\/product\//i.test(url) || /\/t\/[a-z0-9-]+/i.test(url) || /\/p\/|\/prd\/|\/dp\//i.test(url);
}

async function followFirstProduct(page) {
  const href = await page.evaluate(() => {
    const links = [...document.querySelectorAll("a[href]")];
    for (const a of links) {
      const h = a.getAttribute("href") || "";
      if (/\/products?\//i.test(h) || /\/product\//i.test(h) || /\/t\/[a-z0-9-]+/i.test(h) || /\/p\/|\/prd\/|\/dp\//i.test(h)) {
        try {
          return new URL(h, location.href).href.split("?")[0];
        } catch {
          /* skip */
        }
      }
    }
    return "";
  });
  if (!href || href === page.url().split("?")[0]) return false;
  const res = await page.goto(href, { waitUntil: "domcontentloaded", timeout: 18000 });
  return res?.ok() || (res?.status() || 0) < 400;
}

async function dismissOverlays(page) {
  const selectors = [
    "button:has-text('Accept')",
    "button:has-text('Accept All')",
    "button:has-text('I Accept')",
    "button:has-text('Agree')",
    "button:has-text('Got it')",
    "button:has-text('Continue')",
    "#onetrust-accept-btn-handler",
    "[data-testid='cookie-accept']",
    ".cookie-accept",
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      /* no banner */
    }
  }
}

async function runOne(context, target) {
  const page = await context.newPage();
  const result = {
    shop: target.shop,
    tier: target.tier,
    kind: target.kind,
    url: target.url,
    status: 0,
    error: "",
    optionCount: 0,
    labels: [],
    family: "",
    source: "",
    line: "",
    matchStatus: "",
    listingLabel: "",
    fitNote: "",
  };
  try {
    const res = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 22000 });
    result.status = res?.status() || 0;
    if (!res?.ok() && result.status >= 400) {
      result.error = `http ${result.status}`;
      return result;
    }
    await page.waitForTimeout(2200);
    await dismissOverlays(page);
    if (!looksLikePdp(page.url())) {
      const followed = await followFirstProduct(page);
      if (followed) await page.waitForTimeout(2200);
    }
    try {
      await page.waitForSelector(
        "select[name*='size' i], [class*='size-selector'], [class*='SizeSelector'], [data-testid*='size' i], .pdp-product-sizes, fieldset[aria-label*='size' i]",
        { timeout: 4000 }
      );
    } catch {
      /* picker may still be in JSON-LD */
    }
    const finalUrl = page.url();
    const html = await page.content();
    const domRows = await page.evaluate(DOM_EXTRACT);
    const got = extractFromHtml(html, finalUrl, target.kind, domRows);
    result.url = finalUrl;
    result.optionCount = got.options.length;
    result.labels = got.options.slice(0, 10).map((o) => o.label);
    result.family = got.family;
    result.source = got.source;
    result.line = got.match.line || "";
    result.matchStatus = got.match.status || (got.match.ask ? "ask" : "");
    result.listingLabel = got.match.listingLabel || "";
    result.fitNote = got.fitNote || "";
    if (result.optionCount === 0 && !result.matchStatus) result.matchStatus = got.match.status || "empty";
  } catch (e) {
    result.error = e?.message?.slice(0, 120) || "page error";
  } finally {
    await page.close().catch(() => {});
  }
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "media", "font"].includes(type)) return route.abort();
    return route.continue();
  });
  const rows = [];
  for (const target of TARGETS) {
    rows.push(await runOne(context, target));
    process.stdout.write(".");
  }
  await context.close();
  await browser.close();

  const fetched = rows.filter((r) => !r.error && r.status < 400);
  const withSizes = rows.filter((r) => r.optionCount > 0);
  const matched = withSizes.filter((r) => r.matchStatus && !["unknown", "ask", "empty"].includes(r.matchStatus));
  const byTier = (tier) => ({
    total: rows.filter((r) => r.tier === tier).length,
    withSizes: withSizes.filter((r) => r.tier === tier).length,
    matched: matched.filter((r) => r.tier === tier).length,
  });
  const summary = {
    attempted: rows.length,
    fetched: fetched.length,
    withSizes: withSizes.length,
    matched: matched.length,
    blocked: rows.filter((r) => r.error || r.status >= 400).length,
    emptyPicker: fetched.filter((r) => r.optionCount === 0).length,
    byTier: { budget: byTier("budget"), mid: byTier("mid"), premium: byTier("premium") },
    byKind: Object.fromEntries(
      [...new Set(rows.map((r) => r.kind))].map((k) => [
        k,
        { withSizes: withSizes.filter((r) => r.kind === k).length, total: rows.filter((r) => r.kind === k).length },
      ])
    ),
  };
  const outPath = new URL("../.tmp-size-browser.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify({ summary, shopper: SHOPPER, rows }, null, 2));
  console.log("\n" + JSON.stringify(summary, null, 2));
  for (const r of rows) {
    const mark = r.optionCount > 0 ? "ok" : r.error || r.status >= 400 ? "no" : "empty";
    console.log(
      `${mark.padEnd(5)} ${String(r.shop).padEnd(18)} ${r.kind.padEnd(7)} ${String(r.optionCount).padStart(2)} ${(r.source || "—").padEnd(8)} ${r.listingLabel || r.line?.slice(0, 50) || r.error || r.matchStatus || ""}`
    );
  }
  console.log(`\nwrote ${outPath.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
