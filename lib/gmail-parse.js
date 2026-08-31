/**
 * Parse shopping receipts and return emails for closet rows + size memory.
 * Conservative: only keep sizes that normalize cleanly.
 */
import { detectFamily, detectPiece, normalizeLabel } from "./size-read.js";

const KIND_WORDS = [
  ["jeans", "denim"],
  ["denim", "denim"],
  ["dress", "dress"],
  ["skirt", "skirt"],
  ["pant", "pants"],
  ["trouser", "pants"],
  ["legging", "pants"],
  ["jacket", "jacket"],
  ["blazer", "jacket"],
  ["coat", "jacket"],
  ["boot", "shoes"],
  ["sneaker", "shoes"],
  ["heel", "shoes"],
  ["sandal", "shoes"],
  ["mule", "shoes"],
  ["loafer", "shoes"],
  ["shoe", "shoes"],
  ["top", "top"],
  ["tee", "top"],
  ["shirt", "top"],
  ["sweater", "knit"],
  ["knit", "knit"],
  ["set", "set"],
];

function clip(text, max = 180) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function decodeGmailBody(payload) {
  const chunks = [];
  function walk(node) {
    if (!node) return;
    const mime = String(node.mimeType || "").toLowerCase();
    if (node.body?.data && (mime.includes("text/plain") || mime.includes("text/html") || !node.parts?.length)) {
      try {
        chunks.push(Buffer.from(node.body.data, "base64url").toString("utf8"));
      } catch {
        /* skip */
      }
    }
    for (const part of node.parts || []) walk(part);
  }
  walk(payload);
  const raw = decodeEntities(chunks.join("\n"));
  return raw.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 14000);
}

function kindFromText(text = "") {
  const t = text.toLowerCase();
  for (const [word, kind] of KIND_WORDS) {
    if (t.includes(word)) return kind;
  }
  return "";
}

function brandFromMail({ from_addr = "", subject = "", snippet = "", body = "" } = {}) {
  const blob = `${from_addr} ${subject} ${snippet} ${body}`.toLowerCase();
  const brands = [
    "reformation",
    "aritzia",
    "zara",
    "asos",
    "nordstrom",
    "ssense",
    "everlane",
    "j.crew",
    "jcrew",
    "gap",
    "old navy",
    "uniqlo",
    "mango",
    "cos",
    "skims",
    "lululemon",
    "ganni",
    "sezane",
    "revolve",
    "madewell",
    "anthropologie",
    "free people",
    "princess polly",
    "abercrombie",
    "toteme",
    "agolde",
    "levi's",
    "levis",
    "nike",
    "adidas",
    "h&m",
    "hm",
    "shopbop",
    "net-a-porter",
    "farfetch",
  ];
  const hit = brands.find((b) => blob.includes(b));
  if (!hit) return "";
  if (hit === "jcrew" || hit === "j.crew") return "J.Crew";
  if (hit === "levis" || hit === "levi's") return "Levi's";
  if (hit === "hm" || hit === "h&m") return "H&M";
  if (hit === "net-a-porter") return "Net-a-Porter";
  return hit.charAt(0).toUpperCase() + hit.slice(1);
}

function classifyMailKind(subject = "", snippet = "", body = "") {
  const t = `${subject} ${snippet} ${body}`.toLowerCase();
  if (/return|refund|exchange|return label|returned/.test(t)) return "return";
  if (/shipped|tracking|out for delivery|delivered/.test(t)) return "shipping";
  if (/order|confirmation|receipt|purchased|thank you for your order/.test(t)) return "order";
  if (/size|fit|alteration|hem|tailor/.test(t)) return "sizing";
  return "other";
}

function extractSizeCandidates(text = "", family = "clothes") {
  const found = [];
  const seen = new Set();
  const push = (raw) => {
    const parsed = normalizeLabel(raw, family);
    if (!parsed) return;
    const key = `${parsed.system}:${parsed.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(parsed.label);
  };

  const patterns = [
    /\bsize\s*[:#]?\s*([a-z0-9./\s-]{1,16})/gi,
    /\bsz\s*[:#]?\s*([a-z0-9./\s-]{1,12})/gi,
    /\b(us|uk|eu)\s*[:#]?\s*(\d{1,2}(?:\.\d)?)/gi,
    /\b(xxx?s|xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,2}x\d{2})\b/gi,
    /\bwaist\s*[:#]?\s*(\d{2})\b/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const raw = m[2] ? `${m[1]} ${m[2]}` : m[1];
      push(raw);
    }
  }
  return found;
}

function extractItemLines(text = "") {
  const lines = String(text || "")
    .split(/\n|•|·|\||(?<=[a-z])\s{2,}/i)
    .map((l) => clip(l, 120))
    .filter((l) => l.length >= 6 && l.length <= 120);
  const items = [];
  for (const line of lines) {
    if (/^items in your order|^order summary|^your order/i.test(line)) continue;
    if (!/(dress|jean|pant|skirt|top|tee|shirt|jacket|blazer|coat|boot|shoe|sneaker|heel|sandal|mule|loafer|set|sweater|knit|legging)/i.test(line)) {
      continue;
    }
    if (/subtotal|shipping|tax|total|discount|gift card|order number|tracking/i.test(line)) continue;
    items.push(line);
    if (items.length >= 6) break;
  }
  return items;
}

function itemNameFromLine(line = "", brand = "") {
  let name = clip(line, 100);
  name = name.replace(/^items in your order[:\s-]*/i, "");
  name = name.replace(/\bsize\s*[:#]?\s*[a-z0-9./\s-]+/gi, "");
  name = name.replace(/\b(qty|quantity)\s*[:#]?\s*\d+/gi, "");
  name = name.replace(/\$\s?\d+(?:\.\d{2})?/g, "");
  name = name.replace(/\b(us|uk|eu)\s*\d+(?:\.\d)?/gi, "");
  name = name.replace(/\b(xxx?s|xxs|xs|s|m|l|xl|xxl|xxxl)\b/gi, "");
  name = clip(name.replace(/^[-–—•\s]+|[-–—•\s]+$/g, ""), 80);
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
    name = clip(name.slice(brand.length).replace(/^[\s-]+/, ""), 80);
  }
  return name;
}

function sizeFromLine(line = "", family = "clothes") {
  const tagged = line.match(/\bsize\s*[:#]?\s*([a-z0-9./\s-]{1,16})/i);
  if (tagged) {
    const parsed = normalizeLabel(tagged[1], family);
    if (parsed) return parsed.label;
  }
  const candidates = extractSizeCandidates(line, family);
  return candidates[0] || "";
}

/**
 * Parse one gmail message into zero or more purchase/return rows.
 */
export function parseGmailMessage(msg = {}) {
  const subject = clip(msg.subject, 160);
  const snippet = clip(msg.snippet, 280);
  const body = clip(decodeEntities(msg.body || ""), 12000);
  const blob = `${subject}\n${snippet}\n${body}`;
  const signal_kind = msg.signal_kind || classifyMailKind(subject, snippet, body);
  const brand = msg.brand || brandFromMail(msg);
  const sent_at = msg.sent_at || msg.internal_date || "";

  if (!["order", "return", "sizing", "shipping"].includes(signal_kind)) {
    return { signal_kind, brand, items: [], sizes: [], summary: "" };
  }

  const itemLines = extractItemLines(blob);
  if (!itemLines.length && subject) itemLines.push(subject);

  const items = [];
  const sizes = [];
  const seenNames = new Set();
  for (const line of itemLines) {
    const kind = kindFromText(line) || kindFromText(subject) || "";
    const family = detectFamily({ name: line, category: kind, href: "" });
    const piece = detectPiece({ name: line, category: kind, href: "" });
    const size = sizeFromLine(line, family) || sizeFromLine(blob, family);
    const name = itemNameFromLine(line, brand) || itemNameFromLine(subject, brand);
    if (!name || name.length < 3) continue;
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    if (size) sizes.push(size);
    items.push({
      item: name,
      brand,
      kind: kind || piece || "",
      size: size || "",
      kept: signal_kind !== "return",
      return_reason: signal_kind === "return" ? clip(snippet || subject, 120) : "",
      purchased_at: sent_at ? String(sent_at).slice(0, 10) : "",
      note: signal_kind === "return" ? "returned (gmail)" : "ordered (gmail)",
      source: "gmail",
      gmail_id: msg.gmail_id || "",
    });
    if (items.length >= 4) break;
  }

  const uniqueSizes = [...new Set(sizes)];
  const summary =
    items.length && uniqueSizes.length
      ? `${brand || "order"}: ${items[0].item} in ${uniqueSizes[0]}`
      : items.length
        ? `${brand || "order"}: ${items[0].item}`
        : "";

  return { signal_kind, brand, items, sizes: uniqueSizes, summary };
}

/** Merge parsed gmail sizes into a profile sizes object. */
export function mergeGmailSizes(sizes = {}, parsedItems = []) {
  const out = {
    us: sizes.us || "",
    denim: sizes.denim || "",
    shoes: sizes.shoes || "",
    brands: { ...(sizes.brands || {}) },
  };
  for (const row of parsedItems) {
    if (!row.size || !row.brand) continue;
    out.brands[row.brand] = row.size;
    const family = detectFamily({ name: row.item, category: row.kind, href: "" });
    if (family === "shoes" && !out.shoes) out.shoes = row.size;
    else if (family === "denim" && !out.denim) out.denim = String(row.size).replace(/^(us|eu|uk)\s*/i, "").split(/[x/]/)[0];
    else if (family === "clothes" && !out.us && /^us\s/i.test(row.size)) out.us = row.size;
  }
  return out;
}
