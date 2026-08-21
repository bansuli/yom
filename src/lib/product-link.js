/** Store-link helpers for scan. Keep in sync with lib/product-link.js. */

const SKIP_PATH =
  /^(en|en-us|en-gb|us|uk|de|fr|shop|product|products|clothing|clothes|women|womens|women-s|men|mens|men-s|category|p|pd|dp)$/i;

const TRACKING_PARAM =
  /^(utm_|utm-|gclid|gad_|gbraid|wbraid|fbclid|mc_|msclkid|twclid|ttclid|dclid|gclsrc|vtp\d+$)/i;

export function cleanProductUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return s;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    return u.href;
  } catch {
    return s;
  }
}

export function noteFromProductUrl(raw) {
  try {
    const u = new URL(cleanProductUrl(raw));
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname
      .split("/")
      .map((p) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      })
      .filter(Boolean)
      .filter((p) => !SKIP_PATH.test(p) && !/^\d{6,}$/.test(p))
      .map((p) => p.replace(/[-_]+/g, " ").trim())
      .filter(Boolean);
    const slug = parts.join(" · ");
    return slug ? `${host}: ${slug}` : `product from ${host}`;
  } catch {
    return "";
  }
}

export function guessListingImage(raw) {
  try {
    const u = new URL(cleanProductUrl(raw));
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const id = (u.pathname.match(/\/(\d{6,})\/?$/) || u.pathname.match(/\/(\d{6,})\b/) || [])[1];
    if (!id) return "";
    if (/(^|\.)net-a-porter\.com$/.test(host)) {
      return `https://www.net-a-porter.com/variants/images/${id}/in/w920_q60.jpg`;
    }
    if (/(^|\.)mrporter\.com$/.test(host)) {
      return `https://www.mrporter.com/variants/images/${id}/in/w920_q60.jpg`;
    }
    return "";
  } catch {
    return "";
  }
}
