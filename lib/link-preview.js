const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|\[::1\])/i;

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

export async function fetchLinkPreview(rawUrl) {
  const page = asUrl(rawUrl);
  if (!page) return { ok: false, error: "need a real http(s) link." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let html = "";
  try {
    const res = await fetch(page.href, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "yom-preview/1 (+https://youryom.com)",
      },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: "couldn’t open that link." };
    const ctype = String(res.headers.get("content-type") || "");
    if (/^image\//i.test(ctype)) {
      return { ok: true, url: page.href, image: page.href, title: "", source: page.hostname };
    }
    html = await res.text();
  } catch {
    return { ok: false, error: "couldn’t open that link." };
  } finally {
    clearTimeout(timer);
  }

  html = String(html || "").slice(0, 250_000);
  const image =
    pickMeta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ||
    (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] ||
    "";
  const title = pickMeta(html, ["og:title", "twitter:title"]) || (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
  const imageUrl = image ? absUrl(image, page.href) : "";
  return {
    ok: true,
    url: page.href,
    image: imageUrl,
    title: String(title).replace(/\s+/g, " ").trim().slice(0, 140),
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
      headers: { accept: "image/*", "user-agent": "yom-preview/1" },
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
