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

const JUNK =
  /^(size|select|choose|qty|quantity|guide|chart|find your|size guide|size chart|notify|waitlist|sold out|out of stock|oos|n\/a|–|—|-)$/i;

const SHOE_WORDS =
  /\b(shoe|shoes|heel|heels|sandal|sandals|boot|boots|mule|mules|pump|pumps|loafer|loafers|sneaker|sneakers|slingback|flat|flats|slide|slides|thong|espadrille|ballet|trainer|trainers)\b/i;

const DENIM_WORDS = /\b(jean|jeans|denim)\b/i;

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

function stripSizeWord(raw) {
  return clip(raw, 40)
    .replace(/^(size|sz)\s*[:.]?\s*/i, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * Turn a raw size string into a structured label.
 * family hints whether a bare "36" is a dress EU or a shoe EU.
 */
export function normalizeLabel(raw, family = "clothes") {
  const original = clip(raw, 48);
  if (!original || JUNK.test(original)) return null;
  let s = stripSizeWord(original);
  if (!s || JUNK.test(s)) return null;
  if (/\b(stars?|reviews?|colors?|colours?)\b/i.test(s)) return null;
  if (/^\d+(?:\.\d+)?\s*(left|pcs|pieces)$/i.test(s)) return null;

  if (/^(os|osfa|one size|onesize|free size|unique|u)$/i.test(s)) {
    return { raw: original, label: "one size", system: "os", value: "os", family };
  }

  const alpha = alphaKey(s);
  if (alpha) {
    return { raw: original, label: alpha.toUpperCase(), system: "alpha", value: alpha, family };
  }

  const tagged = s.match(/^(us|uk|eu|fr|it)\s*[:.]?\s*(\d+(?:\.\d+)?)$/i) || s.match(/^(\d+(?:\.\d+)?)\s*(us|uk|eu|fr|it)$/i);
  if (tagged) {
    const sys = (tagged[1].match(/[a-z]+/i) ? tagged[1] : tagged[2]).toLowerCase();
    const value = tagged[1].match(/[a-z]+/i) ? tagged[2] : tagged[1];
    const system = sys === "fr" || sys === "it" ? "eu" : sys;
    const kind = family === "shoes" ? `shoe_${system}` : system;
    return {
      raw: original,
      label: `${system.toUpperCase()} ${value}`,
      system: kind,
      value: String(Number(value) === Number(value) ? value.replace(/\.0$/, "") : value),
      family,
    };
  }

  // 26/30, 26x32, W26 L30 — denim
  const denim = s.match(/^(?:w\s*)?(\d{2})(?:\s*[x/]\s*(?:l\s*)?(\d{2})|\s+l\s*(\d{2}))?$/i);
  if (denim && family === "denim") {
    const waist = denim[1];
    const length = denim[2] || denim[3] || "";
    return {
      raw: original,
      label: length ? `${waist}x${length}` : waist,
      system: "denim",
      value: waist,
      length: length || null,
      family: "denim",
    };
  }

  const bare = s.match(/^(\d{1,2}(?:\.\d+)?)$/);
  if (bare) {
    const value = bare[1];
    const n = num(value);
    if (n == null) return null;
    if (family === "shoes") {
      if (n >= 34 && n <= 46) {
        return { raw: original, label: `EU ${value}`, system: "shoe_eu", value, family };
      }
      if (n >= 2 && n <= 12) {
        return { raw: original, label: `US ${value}`, system: "shoe_us", value, family };
      }
      if (n >= 13 && n <= 15) return null;
    }
    if (family === "denim" && n >= 22 && n <= 38) {
      return { raw: original, label: value, system: "denim", value, family };
    }
    if (family === "clothes") {
      if (n >= 30 && n <= 52 && n % 2 === 0) {
        return { raw: original, label: `EU ${value}`, system: "eu", value, family };
      }
      if ((n >= 0 && n <= 18 && (n % 2 === 0 || n === 0)) || value === "00") {
        return { raw: original, label: `US ${value}`, system: "us", value, family };
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
  if (a.system === b.system && String(a.value) === String(b.value)) return true;
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
      alpha.forEach((key) => out.push({ system: "alpha", value: key, label: key.toUpperCase(), family: "clothes" }));
    }
    const eu = US_TO_EU_CLOTHES[v] || US_TO_EU_CLOTHES[String(Number(v))];
    if (eu) out.push({ system: "eu", value: eu, label: `EU ${eu}`, family: "clothes" });
  }

  if (parsed.system === "alpha") {
    Object.entries(US_TO_ALPHA).forEach(([us, keys]) => {
      if (keys[0] === parsed.value) {
        out.push({ system: "us", value: us, label: `US ${us}`, family: "clothes" });
      }
    });
  }

  if (parsed.system === "eu" && family === "clothes") {
    Object.entries(US_TO_EU_CLOTHES).forEach(([us, eu]) => {
      if (eu === v) out.push({ system: "us", value: us, label: `US ${us}`, family: "clothes" });
    });
  }

  if (parsed.system === "shoe_us" || (family === "shoes" && parsed.system === "us")) {
    const key = String(Number(v));
    const eu = US_SHOE_TO_EU[key] || US_SHOE_TO_EU[v];
    (eu || []).forEach((e) => out.push({ system: "shoe_eu", value: e, label: `EU ${e}`, family: "shoes" }));
    const uk = US_SHOE_TO_UK[key] || US_SHOE_TO_UK[v];
    (uk || []).forEach((u) => out.push({ system: "shoe_uk", value: u, label: `UK ${u}`, family: "shoes" }));
  }

  if (parsed.system === "shoe_eu" || (family === "shoes" && parsed.system === "eu")) {
    Object.entries(US_SHOE_TO_EU).forEach(([us, list]) => {
      if (list.includes(v) || list.includes(String(Number(v)))) {
        out.push({ system: "shoe_us", value: us, label: `US ${us}`, family: "shoes" });
      }
    });
  }

  return out;
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
    core = `you wear ${userLabel}; this listing doesn't have it.`;
  } else if (status === "converted") {
    core = `you wear ${userLabel} → ${listingLabel} here${match.available === false ? ", sold out" : ", in stock"}.`;
  } else {
    core = `your ${userLabel} is in stock.`;
    if (match.selected) core = `${listingLabel} is selected. that's your size.`;
  }
  const extra = [fitNote, model && `model wears ${model}`].filter(Boolean)[0];
  const withExtra = extra ? `${core} ${extra}.`.replace(/\.\s*\./g, ".") : core;
  return clip(withExtra.replace(/\s+/g, " ").replace(/\s+\./g, "."), 160);
}

/**
 * Match this person's sizes to this listing.
 */
export function matchUserSize(extracted = {}, sizes = {}, { brand = "" } = {}) {
  const family = extracted.family || "clothes";
  const options = Array.isArray(extracted.options) ? extracted.options : collectOptions(extracted.labels, family);
  const user = userSizeFor(family, sizes, brand);
  const fitNote = clip(extracted.fitNote || "", 80);
  const model = extracted.model?.size || extracted.modelSize || "";
  const quote = extracted.quote || null;

  if (options.some((o) => o.parsed?.system === "os") && options.length <= 2) {
    return {
      known: true,
      family,
      status: "one_size",
      userLabel: user?.parsed?.label || "",
      listingLabel: "one size",
      ask: false,
      chips: [],
      line: lineFor({ known: true, status: "one_size", fitNote, model, quote }),
      fitNote,
      model,
      quote,
      options,
    };
  }

  if (!user?.parsed) {
    return {
      known: false,
      family,
      status: "unknown",
      userLabel: "",
      listingLabel: options.find((o) => o.selected)?.label || "",
      ask: true,
      chips: options.map((o) => o.label).filter(Boolean).slice(0, 12),
      line: lineFor({ known: false, fitNote, model, quote }),
      fitNote,
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

  const status = statusOf(best);
  const listingLabel = best?.option?.label || "";
  const selected = Boolean(best?.option?.selected);
  const result = {
    known: true,
    family,
    status,
    userLabel: user.parsed.label || user.raw,
    listingLabel,
    converted: Boolean(best?.converted),
    available: best ? best.option.available !== false : false,
    selected,
    source: user.source,
    ask: false,
    chips: options.map((o) => o.label).slice(0, 12),
    fitNote,
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
  return `${channel}: “${text}”`;
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
