import { cleanProductUrl, guessListingImage, noteFromProductUrl } from "./product-link.js";

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|\[::1\])/i;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function asUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (PRIVATE_HOST.test(u.hostname) || u.hostname === "0.0.0.0") return null;
    return u;
  } catch {
    return null;
  }
}

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

function pickMeta(html, keys) {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const m = html.match(re);
    if (m?.[1]) return m[1];
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return m2[1];
  }
  return "";
}

function pickJsonLdImage(html) {
  const blocks = String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      const nodes = Array.isArray(data) ? data : [data, ...(data?.["@graph"] || [])];
      for (const node of nodes) {
        const img = node?.image;
        if (typeof img === "string" && /^https?:\/\//i.test(img)) return img;
        if (Array.isArray(img) && img[0]) {
          const first = typeof img[0] === "string" ? img[0] : img[0]?.url;
          if (first && /^https?:\/\//i.test(first)) return first;
        }
        if (img?.url && /^https?:\/\//i.test(img.url)) return img.url;
      }
    } catch {
      /* ignore bad json-ld */
    }
  }
  return "";
}

function listingFallback(page, extra = {}) {
  const guessed = guessListingImage(page.href);
  const title = extra.title || noteFromProductUrl(page.href);
  if (!guessed && !title) return { ok: false, error: extra.error || "couldn’t open that link." };
  return {
    ok: true,
    url: page.href,
    image: guessed,
    title,
    source: page.hostname.replace(/^www\./, ""),
  };
}

export async function fetchLinkPreview(rawUrl) {
  const page = asUrl(cleanProductUrl(rawUrl) || rawUrl);
  if (!page) return { ok: false, error: "need a real http(s) link." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let html = "";
  try {
    const res = await fetch(page.href, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": BROWSER_UA,
      },
      signal: controller.signal,
    });
    if (!res.ok) return listingFallback(page, { error: "couldn’t open that link." });
    const ctype = String(res.headers.get("content-type") || "");
    if (/^image\//i.test(ctype)) {
      return { ok: true, url: page.href, image: page.href, title: "", source: page.hostname };
    }
    html = await res.text();
  } catch {
    return listingFallback(page);
  } finally {
    clearTimeout(timer);
  }

  html = String(html || "").slice(0, 250_000);
  const image =
    pickMeta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ||
    pickJsonLdImage(html) ||
    (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] ||
    "";
  const title = pickMeta(html, ["og:title", "twitter:title"]) || (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
  const imageUrl = image ? absUrl(image, page.href) : guessListingImage(page.href);
  if (!imageUrl && !title) return listingFallback(page);
  return {
    ok: true,
    url: page.href,
    image: imageUrl,
    title: String(title || noteFromProductUrl(page.href)).replace(/\s+/g, " ").trim().slice(0, 140),
    source: page.hostname.replace(/^www\./, ""),
  };
}

export async function fetchImageAsDataUrl(imageUrl, maxBytes = 2_400_000) {
  const u = asUrl(imageUrl);
  if (!u) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(u.href, {
      redirect: "follow",
      headers: { accept: "image/*", "user-agent": BROWSER_UA },
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return "";
    const ctype = String(res.headers.get("content-type") || "image/jpeg").split(";")[0] || "image/jpeg";
    if (!/^image\//i.test(ctype)) return "";
    return `data:${ctype};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
