/**
 * CI-friendly golden PDP checks — known-good product pages that should
 * always return real sizes. Uses fetch (JSON-LD / Shopify) first; falls
 * back to a short Playwright pass when fetch finds nothing.
 */
import { readFileSync, writeFileSync } from "fs";
import { chromium } from "playwright";
import {
  collectOptions,
  detectFamily,
  detectPiece,
  jsonLdSizeOptions,
  matchUserSize,
  normalizeLabel,
  shopifyVariantOptions,
  shopifyOption1FromHtml,
} from "../lib/size-read.js";

const SHOPPER = { us: "US 4", denim: "26", shoes: "7.5" };
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const GOLDEN = JSON.parse(readFileSync(new URL("./size-golden-pdps.json", import.meta.url), "utf8"));

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
  for (const chunk of html.split(/"variants"\s*:/).slice(1, 6)) {
    const start = html.lastIndexOf("{", html.indexOf(chunk));
    if (start < 0) continue;
    const slice = html.slice(Math.max(0, start - 800), start + 220000);
    const brace = slice.indexOf("{");
    const end = slice.lastIndexOf("}");
    if (brace < 0 || end <= brace) continue;
    const parsed = parseJson(slice.slice(brace, end + 1));
    const product = parsed?.product || parsed;
    const fromShop = shopifyVariantOptions(product, family);
    if (fromShop.length) {
      rows.push(...fromShop);
      break;
    }
  }
  if (!rows.length) rows.push(...shopifyOption1FromHtml(html, family));
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

function extractFromHtml(html, url, kind) {
  const info = { name: kind, href: url, category: kind, text: html.slice(0, 4000) };
  const family = detectFamily(info);
  const piece = detectPiece(info);
  const ld = jsonLdProducts(html).flatMap((p) => jsonLdSizeOptions(p, family));
  const shopify = shopifyRows(html, family);
  const markup = htmlRows(html, family);
  const options = collectOptions([...ld, ...shopify, ...markup], family);
  const extracted = { family, piece, name: kind, href: url, options, labels: options.map((o) => o.label) };
  const match = matchUserSize(extracted, SHOPPER, { brand: "", piece, name: kind });
  return { family, options, match, labels: options.map((o) => o.label) };
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 16000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html", "accept-language": "en-US,en;q=0.9" },
    });
    return { ok: res.ok, status: res.status, html: await res.text(), url: res.url || url };
  } catch (e) {
    return { ok: false, status: 0, html: "", url, error: e?.message || "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

const DOM_EXTRACT = () => {
  const skip = (n) =>
    n.closest(
      "#yom-root, [class*='Recommend'], [class*='CrossSell'], [class*='CompleteTheLook'], [class*='carousel'], footer"
    );
  const clip = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const rows = [];
  const seen = new Set();
  const push = (raw) => {
    const t = clip(raw);
    if (!t || seen.has(t.toLowerCase()) || /select|choose|guide/i.test(t)) return;
    seen.add(t.toLowerCase());
    rows.push({ raw: t, label: t.toLowerCase(), available: true, selected: false });
  };
  const host = location.hostname.toLowerCase();
  if (/thereformation\.com/.test(host)) {
    document
      .querySelectorAll(
        "main [class*='SizeSelector'] button, [data-testid='product-form'] [class*='SizeSelector'] button"
      )
      .forEach((n) => {
        if (skip(n)) return;
        push(n.textContent || n.getAttribute("aria-label"));
      });
  }
  document.querySelectorAll("select[name*='size' i], select[aria-label*='size' i]").forEach((sel) => {
    [...sel.options].forEach((opt) => push(opt.textContent || opt.value));
  });
  document.querySelectorAll("[class*='size-selector'] button, [class*='SizePicker'] button").forEach((n) => {
    if (skip(n)) return;
    push(n.textContent || n.getAttribute("aria-label"));
  });
  return rows;
};

async function browserExtract(url, kind) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    return { ok: false, error: `browser unavailable: ${e?.message || "launch failed"}` };
  }
  const context = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 22000 });
    if (!res?.ok() && (res?.status() || 0) >= 400) {
      return { ok: false, status: res?.status() || 0, error: `http ${res?.status()}` };
    }
    await page.waitForTimeout(2500);
    const html = await page.content();
    const domRows = await page.evaluate(DOM_EXTRACT);
    const info = { name: kind, href: page.url(), category: kind, text: html.slice(0, 4000) };
    const family = detectFamily(info);
    const piece = detectPiece(info);
    const ld = jsonLdProducts(html).flatMap((p) => jsonLdSizeOptions(p, family));
    const shopify = shopifyRows(html, family);
    const dom = domRows
      .map((r) => {
        const parsed = normalizeLabel(r.raw || r.label, family);
        return parsed ? { raw: parsed.raw, label: parsed.label, available: true, selected: false } : null;
      })
      .filter(Boolean);
    const options = collectOptions([...dom, ...ld, ...shopify], family);
    const extracted = { family, piece, name: kind, href: page.url(), options, labels: options.map((o) => o.label) };
    const match = matchUserSize(extracted, SHOPPER, { brand: "", piece, name: kind });
    return { ok: true, url: page.url(), labels: extracted.labels, options, match };
  } finally {
    await context.close();
    await browser.close();
  }
}

function assertCase(target, got) {
  const fails = [];
  if (!got.ok) fails.push(got.error || `http ${got.status}`);
  if ((got.options?.length || 0) < target.minOptions) {
    fails.push(`expected >= ${target.minOptions} options, got ${got.options?.length || 0}`);
  }
  for (const label of target.labelsContain || []) {
    if (!got.labels.some((l) => l.includes(label))) fails.push(`missing label containing "${label}"`);
  }
  for (const label of target.forbidLabels || []) {
    if (got.labels.includes(label)) fails.push(`forbidden label "${label}"`);
  }
  if (target.matchStatus && got.match?.status !== target.matchStatus) {
    fails.push(`match status ${got.match?.status || "none"} != ${target.matchStatus}`);
  }
  if (target.listingLabel && got.match?.listingLabel !== target.listingLabel) {
    fails.push(`listing ${got.match?.listingLabel || "none"} != ${target.listingLabel}`);
  }
  return fails;
}

const results = [];
let failed = 0;

for (const target of GOLDEN) {
  const fetched = await fetchHtml(target.url);
  let got = { ok: fetched.ok, status: fetched.status, error: fetched.error };
  if (fetched.ok) {
    const extracted = extractFromHtml(fetched.html, fetched.url, target.kind);
    got = {
      ok: true,
      url: fetched.url,
      labels: extracted.labels,
      options: extracted.options,
      match: extracted.match,
      source: "fetch",
    };
  }
  if ((got.options?.length || 0) < target.minOptions) {
    const browser = await browserExtract(target.url, target.kind);
    if (browser.ok && (browser.options?.length || 0) > (got.options?.length || 0)) {
      got = { ...browser, source: "browser" };
    } else if (!got.ok && browser.ok) {
      got = { ...browser, source: "browser" };
    }
  }
  const fails = assertCase(target, got);
  if (fails.length) failed++;
  results.push({ shop: target.shop, kind: target.kind, url: got.url || target.url, source: got.source, labels: got.labels?.slice(0, 8), fails });
  const mark = fails.length ? "FAIL" : "ok";
  console.log(`${mark.padEnd(4)} ${target.shop.padEnd(16)} ${target.kind.padEnd(6)} ${String(got.options?.length || 0).padStart(2)} ${fails[0] || got.match?.line || ""}`);
}

writeFileSync(new URL("../.tmp-size-golden.json", import.meta.url), JSON.stringify({ failed, results }, null, 2));
if (failed) {
  console.error(`\n${failed}/${GOLDEN.length} golden PDP checks failed`);
  process.exit(1);
}
console.log(`\n${GOLDEN.length} golden PDP checks passed`);
