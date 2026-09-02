/**
 * Size reading — normalize listing labels, match a person to this product.
 * Conservative: never invent a size. Convert only when the listing uses a
 * different system than the one on file.
 */

const ALPHA_ORDER = ["xxxs", "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "0x", "1x", "2x", "3x"];

const ALPHA_ALIAS = {
  xxxs: "xxxs",
  xxxsmall: "xxxs",
  xxs: "xxs",
  xxsmall: "xxs",
  xs: "xs",
  xsmall: "xs",
  extra: "xs",
  s: "s",
  small: "s",
  m: "m",
  medium: "m",
  l: "l",
  large: "l",
  xl: "xl",
  xlarge: "xl",
  xxl: "xxl",
  xxlarge: "xxl",
  xxxl: "xxxl",
  xxxlarge: "xxxl",
  "0x": "0x",
  "1x": "1x",
  "2x": "2x",
  "3x": "3x",
};

// Typical US RTW → letter. Brands vary; we keep the usual match plus neighbors.
const US_TO_ALPHA = {
  "00": ["xxs", "xxxs"],
  0: ["xs", "xxs"],
  2: ["xs", "s"],
  4: ["s"],
  6: ["s", "m"],
  8: ["m"],
  10: ["m", "l"],
  12: ["l"],
  14: ["l", "xl"],
  16: ["xl"],
  18: ["xl", "xxl"],
};

const US_TO_EU_CLOTHES = {
  "00": "30",
  0: "32",
  2: "34",
  4: "36",
  6: "38",
  8: "40",
  10: "42",
  12: "44",
  14: "46",
  16: "48",
  18: "50",
};

// Women's shoe US → EU. Half sizes included. Neighbors listed when brands split.
const US_SHOE_TO_EU = {
  5: ["35"],
  5.5: ["35.5", "36"],
  6: ["36"],
  6.5: ["36.5", "37"],
  7: ["37", "37.5"],
  7.5: ["38"],
  8: ["38.5", "39"],
  8.5: ["39"],
  9: ["40"],
  9.5: ["40.5", "41"],
  10: ["41"],
  10.5: ["41.5", "42"],
  11: ["42"],
};

const US_SHOE_TO_UK = {
  5: ["2.5", "3"],
  5.5: ["3"],
  6: ["3.5"],
  6.5: ["4"],
  7: ["4.5"],
  7.5: ["5"],
  8: ["5.5"],
  8.5: ["6"],
  9: ["6.5"],
  9.5: ["7"],
  10: ["7.5"],
  11: ["8.5"],
};

// Foot length in mm (mondopoint-ish). Labels are not the last; brands still vary.
const US_SHOE_TO_MM = {
  5: 220,
  5.5: 225,
  6: 230,
  6.5: 235,
  7: 237,
  7.5: 240,
  8: 245,
  8.5: 248,
  9: 253,
  9.5: 257,
  10: 262,
  10.5: 267,
  11: 270,
};

const SHOE_WIDTH = {
  n: "n",
  narrow: "n",
  aa: "n",
  aaaa: "n",
  aaa: "n",
  a: "n",
  b: "n",
  m: "m",
  medium: "m",
  regular: "m",
  c: "m",
  w: "w",
  wide: "w",
  d: "w",
  e: "w",
  ee: "w",
  xw: "w",
  "2e": "w",
  "3e": "w",
  "4e": "w",
};

/**
 * Conservative brand + piece run notes. Consensus from official charts and
 * long-running shopper threads — not a scraped proprietary database.
 * Never overrides this listing's picker or a size she already told us for the brand.
 */
const BRAND_FIT = {
  reformation: {
    default: { run: "small", note: "reformation often runs small, especially in the bust" },
    dress: { run: "small", note: "reformation dresses often run small in the bust" },
    top: { run: "small", note: "reformation tops often run small in the bust" },
    denim: { run: "tts", note: "reformation denim is closer to true to size" },
  },
  aritzia: {
    default: { run: "small", note: "aritzia often runs small" },
    pants: { run: "small", note: "aritzia trousers (effortless etc) often need a size up" },
    denim: { run: "tts", note: "aritzia denim is closer to true to size than their trousers" },
    knit: { run: "tts", note: "aritzia knits are closer to true to size" },
  },
  ganni: { default: { run: "small", note: "ganni often runs small" } },
  sezane: { default: { run: "small", note: "sezane often runs small. french sizing" } },
  doen: { default: { run: "small", note: "doen often runs a touch small" } },
  toteme: { default: { run: "large", note: "toteme is usually relaxed. don't size up" } },
  cos: { default: { run: "tts", note: "cos is closer to true to size, eu numbers" } },
  arket: { default: { run: "tts", note: "arket is closer to true to size" } },
  uniqlo: { default: { run: "tts", note: "uniqlo is usually true to size. some cuts run small in the shoulders" } },
  everlane: { default: { run: "tts", note: "everlane is usually true to size" } },
  madewell: {
    default: { run: "tts", note: "madewell is usually true to size" },
    denim: { run: "large", note: "madewell jeans often run roomy in the waist" },
  },
  agolde: { denim: { run: "small", note: "agolde denim often runs small. size up" }, default: { run: "small", note: "agolde often runs small" } },
  levi: { denim: { run: "tts", note: "levi's fit depends on the cut. 501s shrink" }, default: { run: "tts", note: "levi's fit depends on the cut" } },
  levis: { denim: { run: "tts", note: "levi's fit depends on the cut. 501s shrink" } },
  skims: { default: { run: "small", note: "skims is stretchy but labeled small" } },
  alo: { default: { run: "small", note: "alo often runs small" } },
  lululemon: { default: { run: "tts", note: "lululemon is usually true to size. align can feel small if you're between" } },
  zara: { default: { run: "small", note: "zara is inconsistent and often small" } },
  mango: { default: { run: "small", note: "mango often runs a touch small" } },
  hm: { default: { run: "tts", note: "h&m is inconsistent. check the listing" } },
  "princess polly": { default: { run: "small", note: "princess polly often runs small" } },
  ohpolly: { default: { run: "small", note: "oh polly often runs small" } },
  nike: { shoes: { run: "small", shift: 0.5, width: "narrow", note: "nike often runs small and narrow. half size up is common" } },
  adidas: { shoes: { run: "tts", width: "standard", note: "adidas is closer to true to size. sambas can feel tight" } },
  on: { shoes: { run: "small", shift: 0.5, note: "on running often runs small. half size up" } },
  hoka: { shoes: { run: "large", shift: -0.5, width: "wide", note: "hoka is often roomy. size down if you're between" } },
  "new balance": { shoes: { run: "tts", width: "wide", note: "new balance is usually true to size and wider than nike" } },
  asics: { shoes: { run: "tts", width: "wide", note: "asics is usually true to size with a roomier toe" } },
  converse: { shoes: { run: "small", shift: 0.5, note: "converse often runs small. half size up" } },
  vans: { shoes: { run: "small", shift: 0.5, note: "vans can run small. half size up if you know them snug" } },
  birkenstock: { shoes: { run: "tts", width: "wide", note: "birkenstock is eu sizing. true to size in eu, wide last" } },
  ugg: { shoes: { run: "large", note: "uggs often feel roomy" } },
  repetto: { shoes: { run: "small", shift: 0.5, width: "narrow", note: "repetto runs small and narrow. french last" } },
  "manolo blahnik": { shoes: { run: "small", shift: 0.5, width: "narrow", note: "manolos run small and narrow. half to full size up" } },
  louboutin: { shoes: { run: "small", shift: 0.5, width: "narrow", note: "louboutins run small and narrow. half to full size up" } },
  "christian louboutin": { shoes: { run: "small", shift: 0.5, width: "narrow", note: "louboutins run small and narrow. half to full size up" } },
  "jimmy choo": { shoes: { run: "small", shift: 0.5, width: "narrow", note: "jimmy choo often runs small. half size up" } },
  "steve madden": { shoes: { run: "small", shift: 0.5, note: "steve madden often runs small. half size up" } },
  "sam edelman": { shoes: { run: "tts", note: "sam edelman is usually true to size" } },
  veja: { shoes: { run: "small", shift: 0.5, note: "veja often runs small. half size up" } },
  "golden goose": { shoes: { run: "large", note: "golden goose often feels roomy" } },
  "stuart weitzman": { shoes: { run: "tts", note: "stuart weitzman is usually true to size" } },
};

const BRAND_ALIAS = [
  [/reformation/, "reformation"],
  [/aritzia/, "aritzia"],
  [/louboutin/, "louboutin"],
  [/blahnik|manolo/, "manolo blahnik"],
  [/new ?balance|^nb$/, "new balance"],
  [/lululemon|^lulu$/, "lululemon"],
  [/^h&?m$|hennes/, "hm"],
  [/levi/, "levi"],
  [/christian louboutin/, "louboutin"],
  [/^on$|^on running$/, "on"],
];

const JUNK =
  /^(size|select|choose|qty|quantity|guide|chart|find your|size guide|size chart|notify|waitlist|sold out|out of stock|oos|n\/a|–|—|-)$/i;

const SHOE_WORDS =
  /\b(shoe|shoes|heel|heels|sandal|sandals|boot|boots|mule|mules|pump|pumps|loafer|loafers|sneaker|sneakers|slingback|flat|flats|slide|slides|thong|espadrille|ballet|trainer|trainers)\b/i;

const DENIM_WORDS = /\b(jean|jeans)\b/i;

const FIT_NOTE =
  /((?:true to size|runs? (?:small|large|big|long|short|tight|narrow)|size up|size down|fits? (?:true|small|large|snug|roomy)|intended to be (?:fitted|relaxed|oversized))[^.!?\n]{0,80})/i;

const MODEL_WEARING =
  /model(?:s)?\s+(?:is |are )?wearing\s+(?:a |size )?([a-z0-9./+-]+(?:\s*(?:us|uk|eu))?)/i;

export function clip(value, max = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function detectFamily(info = {}) {
  const blob = `${info.name || ""} ${info.category || ""} ${info.href || ""} ${info.alt || ""} ${info.text || ""}`.toLowerCase();
  if (SHOE_WORDS.test(blob) || /\/shoes?\//i.test(blob)) return "shoes";
  if (DENIM_WORDS.test(blob) && !/\b(jacket|coat|shirt|dress)\b/i.test(blob)) return "denim";
  return "clothes";
}

export function detectPiece(info = {}) {
  const blob = `${info.name || ""} ${info.category || ""} ${info.href || ""} ${info.alt || ""} ${info.text || ""}`.toLowerCase();
  if (SHOE_WORDS.test(blob) || /\/shoes?\//i.test(blob)) return "shoes";
  if (/\b(jean|jeans)\b/.test(blob) && !/\b(jacket|shirt)\b/.test(blob)) return "denim";
  if (/\b(dress|slip)\b/.test(blob)) return "dress";
  if (/\b(trouser|pant|chino)\b/.test(blob)) return "pants";
  if (/\b(sweater|cardigan|knit|cashmere)\b/.test(blob)) return "knit";
  if (/\b(skirt)\b/.test(blob)) return "skirt";
  if (/\b(jacket|coat|blazer)\b/.test(blob)) return "jacket";
  if (/\b(tee|t-shirt|top|blouse|shirt|cami|tank)\b/.test(blob)) return "top";
  return detectFamily(info) === "denim" ? "denim" : "default";
}

function brandKey(brand) {
  return String(brand || "")
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.(com|co\.uk|us|net)$/g, "")
    .replace(/^(the|shop)\s+/, "")
    .replace(/[^a-z0-9&+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupBrandFit(brand, piece, family, name = "") {
  const key = brandKey(brand);
  if (!key) return null;
  let resolved = key;
  for (const [re, alias] of BRAND_ALIAS) {
    if (re.test(key)) {
      resolved = alias;
      break;
    }
  }
  const row = BRAND_FIT[resolved] || BRAND_FIT[key];
  if (!row) return null;
  const blob = `${name || ""}`.toLowerCase();
  if (resolved === "adidas" && /samba|gazelle|spezial/i.test(blob)) {
    return { run: "small", shift: 0.5, note: "sambas and gazelles often feel tight. half size up is common" };
  }
  const pieceKey = family === "shoes" || piece === "shoes" ? "shoes" : piece || "default";
  return row[pieceKey] || row.default || row.shoes || null;
}

function reviewShift(reviewFit) {
  const n = Number(reviewFit?.size_shift);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

export function resolveRun({ fitNote = "", reviewFit = null, brand = "", piece = "", family = "clothes", name = "" } = {}) {
  const page = String(fitNote || "");
  if (/runs? small|size up|tight in the/i.test(page)) {
    return { run: "small", note: clip(page, 90), source: "page" };
  }
  if (/runs? large|size down|roomy|oversized/i.test(page) && !/don't size down|do not size down/i.test(page)) {
    return { run: "large", note: clip(page, 90), source: "page" };
  }
  if (/true to size/i.test(page)) {
    return { run: "tts", note: clip(page, 90), source: "page" };
  }
  const revFit = String(reviewFit?.fit || "");
  const revNote = clip(reviewFit?.fit_note || "", 90);
  const shift = reviewShift(reviewFit);
  if (revFit === "runs small" || (shift != null && shift > 0)) {
    return { run: "small", note: revNote || "reviews say it runs small", source: "reviews", shift: shift > 0 ? shift : 0.5 };
  }
  if (revFit === "runs large" || (shift != null && shift < 0)) {
    return { run: "large", note: revNote || "reviews say it runs large", source: "reviews", shift: shift < 0 ? shift : -0.5 };
  }
  if (revFit === "true to size") {
    return { run: "tts", note: revNote || "reviews say true to size", source: "reviews" };
  }
  const brandRow = lookupBrandFit(brand, piece, family, name);
  if (brandRow?.run) {
    return {
      run: brandRow.run,
      note: brandRow.note || "",
      source: "brand",
      shift: brandRow.shift,
      width: brandRow.width || "",
    };
  }
  return { run: "tts", note: "", source: "none" };
}

function stripSizeWord(raw) {
  return clip(raw, 80)
    .replace(/^(size|sz)\s*[:.]?\s*/i, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pull the actual size token out of noisy picker copy.
 * "Select Size 8 · Sold out" → "8". "US 4 / EU 36" → "US 4".
 */
export function extractSizeCore(raw, family = "clothes") {
  const original = clip(raw, 80);
  if (!original || JUNK.test(original)) return "";
  const s = stripSizeWord(original);
  if (!s || JUNK.test(s)) return "";
  if (/\b(stars?|reviews?)\b/i.test(s) && !/\bsize\b/i.test(s)) return "";
  if (/^\d+(?:\.\d+)?\s*(left|pcs|pieces|days?)$/i.test(s)) return "";
  if (/\b(qty|quantity|notify|waitlist|size guide|size chart)\b/i.test(s) && !/\b(us|eu|uk|xs|s|m|l)\b/i.test(s)) {
    return "";
  }

  const us = s.match(/\b(us\s*[:.]?\s*\d+(?:\.\d+)?)\b/i);
  const uk = s.match(/\b(uk\s*[:.]?\s*\d+(?:\.\d+)?)\b/i);
  const eu = s.match(/\b((?:eu|fr|it)\s*[:.]?\s*\d+(?:\.\d+)?)\b/i);
  if (family === "shoes") {
    if (us) return us[1];
    if (eu) return eu[1];
    if (uk) return uk[1];
  } else {
    if (us) return us[1];
    if (eu) return eu[1];
    if (uk) return uk[1];
  }

  const denim = s.match(/\b(?:w\s*)?(\d{2})\s*[x/]\s*(?:l\s*)?(\d{2})\b/i);
  if (denim && (family === "denim" || family === "clothes")) return `${denim[1]}x${denim[2]}`;
  const wOnly = s.match(/\bw\s*(\d{2})\b/i);
  if (wOnly && family === "denim") return wOnly[1];

  const shoeW = s.match(
    /\b(\d{1,2}(?:\.\d)?)\s*[-]?(n|m|w|xw|aa+|b|d|ee+|2e|3e|4e|narrow|wide|regular)\b/i
  );
  if (shoeW && family === "shoes") return `${shoeW[1]} ${shoeW[2]}`;

  if (/\b(one\s*size|osfa)\b/i.test(s) || (/^os$/i.test(s) && s.length <= 3)) return "one size";

  const alpha = s.match(
    /\b(xxxsmall|xxsmall|xsmall|small|medium|large|xlarge|xxlarge|xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|[0-3]x)\b/i
  );
  if (alpha && family !== "shoes" && !/small batch|large (?:tote|bag|order)|medium wash/i.test(s)) {
    return alpha[1];
  }

  const sized = s.match(/(?:size|sz|taille|talla|pointure)\s*[:.#]?\s*(\d{1,2}(?:\.\d)?)/i);
  if (sized) return sized[1];

  if (/^[\d.]+(?:\s*[nmbwdxe]+)?$/i.test(s) || /^[a-z0-9]+$/i.test(s)) return s;
  const lone = s.match(/^(\d{1,2}(?:\.\d)?)\b/);
  if (lone) return lone[1];
  return "";
}

/** Which Shopify option is size (not color). -1 if none. */
export function shopifySizeIndex(options = []) {
  const names = (options || []).map((o) => String(o?.name || o || "").toLowerCase());
  const score = (n) => {
    if (!n) return -1;
    if (/\b(color|colour|hue|swatch|cup)\b/.test(n) && !/\bsize\b/.test(n)) return -1;
    if (/\bwaist\b/.test(n)) return 6;
    if (/^(size|sizes|taille|talla|groesse|größe|numeraci|pointure)$/.test(n)) return 5;
    if (/\bsize\b/.test(n) && !/guide|chart/.test(n)) return 4;
    if (/\blength\b|\binseam\b/.test(n)) return 1;
    return -1;
  };
  let best = -1;
  let bestScore = 0;
  names.forEach((n, i) => {
    const s = score(n);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/** Pull size rows from a Shopify product object (variants + options). */
export function shopifyVariantOptions(product, family = "clothes") {
  const variants = product?.variants;
  if (!Array.isArray(variants) || !variants.length) return [];
  const options = product?.options || [];
  let sizeIdx = shopifySizeIndex(options);
  if (sizeIdx < 0) {
    const probe = variants
      .slice(0, 16)
      .map((v) => v.option1 || String(v.title || "").split(/\s*\/\s*/)[0])
      .filter(Boolean);
    if (probe.length && probe.some((raw) => normalizeLabel(raw, family))) sizeIdx = 0;
  }
  const rows = [];
  for (const v of variants) {
    let raw =
      sizeIdx >= 0 ? v[`option${sizeIdx + 1}`] || v.options?.[sizeIdx] : v.option1 || "";
    if (!raw && v.title) raw = String(v.title).split(/\s*\/\s*/)[0];
    const parsedOpt = normalizeLabel(raw, family);
    if (!parsedOpt) continue;
    rows.push({
      raw: parsedOpt.raw,
      label: parsedOpt.label,
      available: v.available !== false,
      selected: false,
    });
  }
  return rows;
}

/** Fallback when Shopify product JSON is not a clean parseable blob. */
export function shopifyOption1FromHtml(html, family = "clothes") {
  const rawValues = [];
  const re = /"option1"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const v = m[1].replace(/\\u[\da-f]{4}/gi, (c) => String.fromCharCode(parseInt(c.slice(2), 16)));
    if (!v || rawValues.includes(v)) continue;
    if (!normalizeLabel(v, family)) continue;
    rawValues.push(v);
    if (rawValues.length >= 24) break;
  }
  if (rawValues.length < 2) return [];
  return rawValues
    .map((raw) => {
      const parsed = normalizeLabel(raw, family);
      return parsed ? { raw: parsed.raw, label: parsed.label, available: true, selected: false } : null;
    })
    .filter(Boolean);
}

function alphaKey(s) {
  const compact = String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (ALPHA_ALIAS[compact]) return ALPHA_ALIAS[compact];
  if (/^(xxx?s|xxs|xs|s|m|l|xl|xxl|xxx?l|[0-3]x)$/.test(compact)) return compact;
  return "";
}

function num(s) {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normSizeValue(v) {
  const n = num(v);
  if (n == null) return String(v);
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.0$/, "");
}

/**
 * Turn a raw size string into a structured label.
 * family hints whether a bare "36" is a dress EU or a shoe EU.
 */
export function normalizeLabel(raw, family = "clothes") {
  const original = clip(raw, 80);
  if (!original || JUNK.test(original)) return null;
  const core = extractSizeCore(original, family);
  let s = core || stripSizeWord(original);
  if (!s || JUNK.test(s)) return null;
  if (/\b(stars?|reviews?|colors?|colours?)\b/i.test(s)) return null;
  if (/^\d+(?:\.\d+)?\s*(left|pcs|pieces)$/i.test(s)) return null;

  if (/^(os|osfa|one size|onesize|free size|unique|u)$/i.test(s)) {
    return { raw: original, label: "one size", system: "os", value: "os", family };
  }

  if (family === "shoes") {
    const mm = s.match(/^(\d{3})\s*mm$/i);
    if (mm) {
      return { raw: original, label: `${mm[1]} mm`, system: "shoe_mm", value: mm[1], family };
    }
    const cm = s.match(/^(\d{2}(?:\.\d)?)\s*cm$/i);
    if (cm) {
      return { raw: original, label: `${cm[1]} cm`, system: "shoe_cm", value: cm[1], family };
    }
    const withWidth = s.match(
      /^(\d{1,2}(?:\.\d+)?)[\s-]*(n|m|w|xw|aa+|b|d|e|ee+|2e|3e|4e|narrow|medium|wide|regular)$/i
    );
    if (withWidth) {
      const base = normalizeLabel(withWidth[1], "shoes");
      if (base) {
        const width = SHOE_WIDTH[withWidth[2].toLowerCase()] || "";
        return { ...base, raw: original, width, label: width ? `${base.label} ${width}` : base.label };
      }
    }
  }

  // Letter sizes on shoes are almost always width, not S/M/L clothing.
  if (family !== "shoes") {
    const alpha = alphaKey(s);
    if (alpha) {
      return { raw: original, label: alpha, system: "alpha", value: alpha, family };
    }
  }

  const tagged = s.match(/^(us|uk|eu|fr|it)\s*[:.]?\s*(\d+(?:\.\d+)?)$/i) || s.match(/^(\d+(?:\.\d+)?)\s*(us|uk|eu|fr|it)$/i);
  if (tagged) {
    const sys = (tagged[1].match(/[a-z]+/i) ? tagged[1] : tagged[2]).toLowerCase();
    const system = sys === "fr" || sys === "it" ? "eu" : sys;
    const kind = family === "shoes" ? `shoe_${system}` : system;
    const value = normSizeValue(tagged[1].match(/[a-z]+/i) ? tagged[2] : tagged[1]);
    return {
      raw: original,
      label: `${system} ${value}`,
      system: kind,
      value,
      family,
    };
  }

  // 26/30, 26x32, W26 L30 — denim waist (22+). 00–18 on denim-tagged listings are US numeric.
  const denim = s.match(/^(?:w\s*)?(\d{2})(?:\s*[x/]\s*(?:l\s*)?(\d{2})|\s+l\s*(\d{2}))?$/i);
  if (denim && family === "denim") {
    const waist = denim[1];
    const wn = num(waist);
    const length = denim[2] || denim[3] || "";
    if (wn != null && wn >= 22 && wn <= 40) {
      return {
        raw: original,
        label: length ? `${waist}x${length}` : waist,
        system: "denim",
        value: waist,
        length: length || null,
        family: "denim",
      };
    }
  }

  const bare = s.match(/^(\d{1,3}(?:\.\d+)?)$/);
  if (bare) {
    const value = bare[1];
    const n = num(value);
    if (n == null) return null;
    if (family !== "shoes" && /\.\d/.test(value)) return null;
    if (family === "clothes" && Number.isInteger(n) && n >= 5 && n <= 13 && n % 2 === 1) return null;
    if (family === "shoes") {
      if (n >= 210 && n <= 300 && Number.isInteger(n)) {
        return { raw: original, label: `${n} mm`, system: "shoe_mm", value: String(n), family };
      }
      if (n >= 34 && n <= 46) {
        return { raw: original, label: `eu ${value}`, system: "shoe_eu", value, family };
      }
      if (n >= 2 && n <= 12) {
        return { raw: original, label: `us ${value}`, system: "shoe_us", value, family };
      }
      if (n >= 13 && n <= 15) return null;
    }
    if (family === "denim" && n >= 22 && n <= 40) {
      return { raw: original, label: value, system: "denim", value, family };
    }
    if (family === "clothes" || family === "denim") {
      if (family === "clothes" && n >= 30 && n <= 52 && n % 2 === 0) {
        return { raw: original, label: `eu ${value}`, system: "eu", value, family };
      }
      if ((n >= 0 && n <= 18 && (n % 2 === 0 || n === 0)) || value === "00") {
        const norm = normSizeValue(value);
        return { raw: original, label: `us ${norm}`, system: "us", value: norm, family: "clothes" };
      }
    }
    return { raw: original, label: value, system: "unknown", value, family };
  }

  // 4W, 4P, 4T — width/petite/tall modifiers, keep the number
  const mod = s.match(/^(\d{1,2}(?:\.\d+)?)[wpt]$/i);
  if (mod) return normalizeLabel(mod[1], family);

  return null;
}

export function parseUserSize(raw, family = "clothes") {
  if (!raw) return null;
  return normalizeLabel(String(raw), family);
}

function userSizeFor(family, sizes = {}, brand = "") {
  const brands = sizes.brands && typeof sizes.brands === "object" ? sizes.brands : {};
  const brandHit = Object.entries(brands).find(
    ([k]) => brand && k.toLowerCase() === String(brand).toLowerCase()
  );
  if (brandHit?.[1]) {
    return { source: "brand", brand: brandHit[0], parsed: parseUserSize(brandHit[1], family), raw: String(brandHit[1]) };
  }
  if (family === "shoes" && sizes.shoes) {
    return { source: "shoes", parsed: parseUserSize(sizes.shoes, "shoes"), raw: String(sizes.shoes) };
  }
  if (family === "denim" && sizes.denim) {
    return { source: "denim", parsed: parseUserSize(sizes.denim, "denim"), raw: String(sizes.denim) };
  }
  if (sizes.us) {
    return { source: "us", parsed: parseUserSize(sizes.us, family === "shoes" ? "clothes" : family), raw: String(sizes.us) };
  }
  return null;
}

function sameSize(a, b) {
  if (!a || !b) return false;
  if (a.system === "os" && b.system === "os") return true;
  if (a.system === b.system) {
    const aNum = num(a.value);
    const bNum = num(b.value);
    if (aNum != null && bNum != null && (a.system === "us" || a.system?.startsWith("shoe_"))) {
      return aNum === bNum;
    }
    return String(a.value) === String(b.value);
  }
  if (a.system === "alpha" && b.system === "alpha" && a.value === b.value) return true;
  if (a.system === "denim" && b.system === "denim" && a.value === b.value) return true;
  return false;
}

function equivalents(parsed, family) {
  if (!parsed) return [];
  const out = [parsed];
  const v = String(parsed.value);

  if (parsed.system === "us" || (parsed.system === "unknown" && family === "clothes")) {
    const alpha = US_TO_ALPHA[v] || US_TO_ALPHA[String(Number(v))];
    if (alpha) {
      alpha.forEach((key) => out.push({ system: "alpha", value: key, label: key, family: "clothes" }));
    }
    const eu = US_TO_EU_CLOTHES[v] || US_TO_EU_CLOTHES[String(Number(v))];
    if (eu) out.push({ system: "eu", value: eu, label: `eu ${eu}`, family: "clothes" });
  }

  if (parsed.system === "alpha") {
    Object.entries(US_TO_ALPHA).forEach(([us, keys]) => {
      if (keys[0] === parsed.value) {
        out.push({ system: "us", value: us, label: `us ${us}`, family: "clothes" });
      }
    });
  }

  if (parsed.system === "eu" && family === "clothes") {
    Object.entries(US_TO_EU_CLOTHES).forEach(([us, eu]) => {
      if (eu === v) out.push({ system: "us", value: us, label: `us ${us}`, family: "clothes" });
    });
  }

  if (parsed.system === "shoe_us" || (family === "shoes" && parsed.system === "us")) {
    const key = String(Number(v));
    const eu = US_SHOE_TO_EU[key] || US_SHOE_TO_EU[v];
    (eu || []).forEach((e) => out.push({ system: "shoe_eu", value: e, label: `eu ${e}`, family: "shoes" }));
    const uk = US_SHOE_TO_UK[key] || US_SHOE_TO_UK[v];
    (uk || []).forEach((u) => out.push({ system: "shoe_uk", value: u, label: `uk ${u}`, family: "shoes" }));
    const mm = US_SHOE_TO_MM[key] || US_SHOE_TO_MM[v];
    if (mm) {
      out.push({ system: "shoe_mm", value: String(mm), label: `${mm} mm`, family: "shoes" });
      const cm = mm % 10 === 0 ? String(mm / 10) : (mm / 10).toFixed(1).replace(/\.0$/, "");
      out.push({ system: "shoe_cm", value: cm, label: `${cm} cm`, family: "shoes" });
    }
  }

  if (parsed.system === "shoe_eu" || (family === "shoes" && parsed.system === "eu")) {
    Object.entries(US_SHOE_TO_EU).forEach(([us, list]) => {
      if (list.includes(v) || list.includes(String(Number(v)))) {
        out.push({ system: "shoe_us", value: us, label: `us ${us}`, family: "shoes" });
      }
    });
  }

  if (parsed.system === "shoe_mm" || parsed.system === "shoe_cm") {
    const mm = parsed.system === "shoe_cm" ? Math.round(Number(v) * 10) : Number(v);
    Object.entries(US_SHOE_TO_MM).forEach(([us, length]) => {
      if (Math.abs(length - mm) <= 2) {
        out.push({ system: "shoe_us", value: us, label: `us ${us}`, family: "shoes" });
      }
    });
  }

  return out;
}

function optionSortKey(opt) {
  const p = opt?.parsed;
  if (!p) return 9999;
  if (p.system === "alpha") {
    const i = ALPHA_ORDER.indexOf(p.value);
    return i >= 0 ? i : 9999;
  }
  const n = Number(p.value);
  return Number.isFinite(n) ? n : 9999;
}

function findNeighbor(options, current, direction) {
  if (!current || !direction) return null;
  const sorted = (options || [])
    .filter((o) => o?.parsed && o.available !== false)
    .slice()
    .sort((a, b) => optionSortKey(a) - optionSortKey(b));
  const idx = sorted.findIndex((o) => sameSize(o.parsed, current.parsed));
  if (idx < 0) return null;
  return sorted[idx + direction] || null;
}

function findShifted(options, current, run, family) {
  if (!current || !run) return null;
  const shift = Number(run.shift);
  if (family === "shoes" && Number.isFinite(shift) && shift !== 0) {
    const target = Number(current.parsed.value) + shift;
    const hit = (options || []).find(
      (o) =>
        o?.parsed &&
        o.available !== false &&
        o.parsed.system === current.parsed.system &&
        Number(o.parsed.value) === target
    );
    if (hit) return hit;
  }
  const direction = run.run === "small" ? 1 : run.run === "large" ? -1 : 0;
  return findNeighbor(options, current, direction);
}

function scoreOption(userParsed, option, family) {
  if (!option?.parsed) return -1;
  if (sameSize(userParsed, option.parsed)) return option.available === false ? 80 : 100;
  const alts = equivalents(userParsed, family);
  for (let i = 0; i < alts.length; i++) {
    if (sameSize(alts[i], option.parsed) || (alts[i].system === option.parsed.system && String(alts[i].value) === String(option.parsed.value))) {
      return option.available === false ? 50 : 70 - Math.min(i, 4) * 4;
    }
  }
  return -1;
}

export function parseFitNote(text) {
  const m = String(text || "").match(FIT_NOTE);
  return m ? clip(m[1], 120).toLowerCase() : "";
}

export function parseModelSize(text) {
  const m = String(text || "").match(MODEL_WEARING);
  if (!m) return null;
  return clip(m[1], 24);
}

function optionFromRaw(raw, { available = true, selected = false, family = "clothes" } = {}) {
  const parsed = normalizeLabel(raw, family);
  if (!parsed) return null;
  return {
    raw: parsed.raw,
    label: parsed.label,
    available: available !== false,
    selected: Boolean(selected),
    parsed,
  };
}

export function collectOptions(labels, family = "clothes") {
  const seen = new Set();
  const out = [];
  for (const item of labels || []) {
    const raw = typeof item === "string" ? item : item?.raw || item?.label;
    const opt = optionFromRaw(raw, {
      family,
      available: typeof item === "object" ? item.available !== false : true,
      selected: typeof item === "object" ? Boolean(item.selected) : false,
    });
    if (!opt) continue;
    const key = `${opt.parsed.system}:${opt.parsed.value}`;
    if (seen.has(key)) {
      const prev = out.find((o) => `${o.parsed.system}:${o.parsed.value}` === key);
      if (prev && opt.selected) prev.selected = true;
      if (prev && opt.available === false) prev.available = false;
      continue;
    }
    seen.add(key);
    out.push(opt);
    if (out.length >= 24) break;
  }
  return out;
}

function statusOf(best) {
  if (!best) return "not_offered";
  if (best.option.parsed.system === "os") return "one_size";
  if (best.converted && best.option.available !== false) return "converted";
  if (best.option.available === false) return "sold_out";
  return "in_stock";
}

function lineFor(match) {
  const { known, userLabel, listingLabel, status, fitNote, model } = match;
  if (!known) return "no size on file yet. what usually fits you?";
  if (status === "one_size") return "one size.";
  let core = "";
  if (status === "sold_out") {
    core = `${listingLabel || userLabel} is sold out.`;
  } else if (status === "not_offered") {
    core = `you wear ${userLabel}. this listing doesn't have it.`;
  } else if (status === "converted") {
    core = `you wear ${userLabel} → ${listingLabel} here${match.available === false ? ", sold out" : ", in stock"}.`;
  } else {
    core = `your ${userLabel} is in stock.`;
    if (match.selected) core = `${listingLabel} is selected. that's your size.`;
  }
  const extra = [
    match.fitWhy || fitNote,
    match.recommend && match.recommend !== listingLabel && `${match.recommend} is the safer pick`,
    match.widthNote,
    !match.fitWhy && model && `model wears ${model}`,
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(". ");
  const withExtra = extra ? `${core} ${extra}.`.replace(/\.\s*\./g, ".") : core;
  return clip(withExtra.replace(/\s+/g, " ").replace(/\s+\./g, "."), 180).toLowerCase();
}

/**
 * Match this person's sizes to this listing.
 * ctx.reviewFit is the live review brief (fit / fit_note / size_shift) when the API has it.
 */
export function matchUserSize(extracted = {}, sizes = {}, { brand = "", piece = "", reviewFit = null, name = "" } = {}) {
  const family = extracted.family || "clothes";
  const pieceKey = piece || extracted.piece || detectPiece({ name: name || extracted.name, category: extracted.category, href: extracted.href });
  const productName = name || extracted.name || "";
  const options = Array.isArray(extracted.options) ? extracted.options : collectOptions(extracted.labels, family);
  const user = userSizeFor(family, sizes, brand);
  const fitNote = clip(extracted.fitNote || "", 80);
  const model = extracted.model?.size || extracted.modelSize || "";
  const quote = extracted.quote || null;
  const run = resolveRun({
    fitNote,
    reviewFit,
    brand,
    piece: pieceKey,
    family,
    name: productName,
  });
  const extras = extracted.extras || {};
  const widthNote =
    extras.width ||
    (run.width && run.width !== "standard" ? `${run.width} last` : "");

  if (options.some((o) => o.parsed?.system === "os") && options.length <= 2) {
    return {
      known: true,
      family,
      piece: pieceKey,
      status: "one_size",
      userLabel: user?.parsed?.label || "",
      listingLabel: "one size",
      ask: false,
      chips: [],
      line: lineFor({ known: true, status: "one_size", fitNote, model, quote, fitWhy: run.note }),
      fitNote,
      fitWhy: run.note || "",
      run: run.run,
      runSource: run.source,
      model,
      quote,
      options,
    };
  }

  if (!user?.parsed) {
    return {
      known: false,
      family,
      piece: pieceKey,
      status: "unknown",
      userLabel: "",
      listingLabel: options.find((o) => o.selected)?.label || "",
      ask: true,
      chips: options.map((o) => o.label).filter(Boolean).slice(0, 12),
      line: lineFor({ known: false, fitNote, model, quote, fitWhy: run.note }).toLowerCase(),
      fitNote,
      fitWhy: run.note || "",
      run: run.run,
      runSource: run.source,
      model,
      quote,
      options,
    };
  }

  let best = null;
  for (const option of options) {
    const score = scoreOption(user.parsed, option, family);
    if (score < 0) continue;
    const converted = !sameSize(user.parsed, option.parsed);
    if (!best || score > best.score) best = { option, score, converted };
  }

  const skipShift = user.source === "brand" && run.source === "brand";
  const neighbor = !skipShift && best ? findShifted(options, best.option, run, family) : null;
  const recommend = neighbor && neighbor.label !== best.option.label ? neighbor.label : "";

  const status = statusOf(best);
  const listingLabel = best?.option?.label || "";
  const selected = Boolean(best?.option?.selected);
  const result = {
    known: true,
    family,
    piece: pieceKey,
    status,
    userLabel: user.parsed.label || user.raw,
    listingLabel,
    recommend,
    converted: Boolean(best?.converted),
    available: best ? best.option.available !== false : false,
    selected,
    source: user.source,
    ask: false,
    chips: options.map((o) => o.label).slice(0, 12),
    fitNote,
    fitWhy: run.note || "",
    run: run.run,
    runSource: run.source,
    widthNote,
    model,
    quote,
    options,
  };
  result.line = lineFor({ ...result, fitNote, model, quote });
  return result;
}

export function formatQuote(quote) {
  if (!quote?.text) return "";
  const channel = quote.channel === "reddit" ? "reddit" : quote.channel || "review";
  let text = clip(quote.text, 140).replace(/^["“]+|["”]+$/g, "");
  if (!/[.!?]$/.test(text)) text = `${text}`;
  return `${channel}: "${text.toLowerCase()}"`;
}

export function sizeDisplay(match, quote) {
  const line = match?.line || "";
  const q = formatQuote(quote || match?.quote);
  return { line, quote: q };
}

export function jsonLdSizeOptions(product, family = "clothes") {
  if (!product || typeof product !== "object") return [];
  const rows = [];
  const offers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
  const variants = Array.isArray(product.hasVariant) ? product.hasVariant : [];
  for (const offer of [...offers, ...variants]) {
    const size = offer?.size || offer?.itemCondition || "";
    const extra = Array.isArray(offer?.additionalProperty) ? offer.additionalProperty : [];
    const named = extra.find((p) => /size/i.test(p?.name || p?.propertyID || ""));
    const raw = size || named?.value || offer?.name;
    if (!raw || /http|schema\.org/i.test(String(raw))) continue;
    const avail = String(offer?.availability || "");
    const available = !/OutOfStock|SoldOut|Discontinued/i.test(avail);
    const opt = optionFromRaw(String(raw), { family, available });
    if (opt) rows.push(opt);
  }
  return collectOptions(rows, family);
}
