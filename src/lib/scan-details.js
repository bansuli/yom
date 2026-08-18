/** Client-side scan detail enrichment (mirrors lib/scan-details.js). */

function hay(product = {}) {
  return `${product.name || ""} ${product.guess || ""} ${product.category || ""}`.toLowerCase();
}

function inferCategory(product = {}) {
  const h = hay(product);
  const keys = [
    ["dress", "dress"],
    ["slip", "slip dress"],
    ["jean", "jeans"],
    ["denim", "jeans"],
    ["skirt", "skirt"],
    ["blazer", "blazer"],
    ["jacket", "jacket"],
    ["coat", "coat"],
    ["sweater", "sweater"],
    ["cardigan", "cardigan"],
    ["knit", "knit top"],
    ["tank", "tank"],
    ["top", "top"],
    ["shirt", "shirt"],
    ["blouse", "blouse"],
    ["trouser", "trousers"],
    ["pant", "pants"],
    ["short", "shorts"],
    ["set", "matching set"],
    ["sandal", "sandals"],
    ["wedge", "wedge sandals"],
    ["heel", "heels"],
    ["boot", "boots"],
    ["sneaker", "sneakers"],
    ["bag", "bag"],
    ["tote", "tote"],
  ];
  for (const [key, label] of keys) {
    if (h.includes(key)) return label;
  }
  return product.category ? String(product.category).toLowerCase() : "piece";
}

function inferColor(product = {}) {
  if (product.color) return String(product.color).toLowerCase();
  const name = String(product.name || product.guess || "");
  const m = name.match(
    /\b(black|white|cream|ivory|ecru|beige|tan|brown|camel|rust|terracotta|red|burgundy|wine|maroon|pink|blush|rose|orange|coral|peach|yellow|gold|green|olive|sage|mint|blue|navy|indigo|grey|gray|silver|lavender|purple)\b/i
  );
  return m ? m[1].toLowerCase() : "";
}

const WEAR_BY_TYPE = {
  dress: "works with strappy sandals and a small bag for dinner, or flat sandals in the day.",
  "slip dress": "layer a cardigan or denim jacket for day; heels or mules at night.",
  jeans: "white tee and sneakers for errands; heels and a blazer to dress up.",
  skirt: "tucked tank or tee with sandals; add a heel for going out.",
  blazer: "over a tank with jeans, or a slip dress with boots.",
  jacket: "over a tee and jeans — good for layering when it's cool inside.",
  coat: "over everything — check length against your usual trousers and dresses.",
  sweater: "with straight-leg denim or a midi skirt; tuck the front if it's long.",
  cardigan: "over a tank or tee with jeans — button it or wear open.",
  "knit top": "tucked into high-rise denim or a satin skirt.",
  tank: "high-rise jeans or a midi skirt — add a jacket if the straps feel too bare.",
  top: "high-rise bottoms — tuck in if there's volume at the waist.",
  shirt: "half-tucked into jeans, or open over a tank like a light layer.",
  blouse: "tucked into trousers or a midi skirt; sleeves rolled for casual.",
  trousers: "a fitted tank or bodysuit on top — check the rise against your torso.",
  pants: "simple tank or tee — hem should skim your shoe without pooling.",
  shorts: "tank or oversized tee; sandals or sneakers depending on the fabric.",
  "matching set": "wear together for an easy outfit — split the pieces to stretch the buy.",
  sandals: "with a midi dress or cropped denim — check the strap doesn't rub.",
  "wedge sandals": "with a midi dress or wide-leg pants — walk a few steps before you commit.",
  heels: "with straight jeans or a midi skirt — make sure you can stand in them.",
  boots: "with a mini or midi skirt, or cropped denim over the shaft.",
  sneakers: "with jeans or a casual dress — keep socks hidden if the cut is low.",
  bag: "check strap drop against your shoulder and what fits inside day-to-day.",
  tote: "should sit on the shoulder without pulling — fits laptop + essentials?",
  piece: "pair with what you already wear on weekends — one outfit in your head before you buy.",
};

const STYLE_BY_TYPE = {
  dress: "column or fit-and-flare — reformation tends toward vintage-inspired lengths.",
  "slip dress": "bias-cut slip — skims the body, usually midi length.",
  jeans: "straight or relaxed leg — check the wash against what you already own.",
  skirt: "midi or mini — look at the waist (zip vs elastic) and how it sits.",
  blazer: "structured shoulders, single or double breasted — boxy vs nipped waist changes the vibe.",
  jacket: "lightweight layer — length hits at hip or waist.",
  coat: "longline outerwear — check shoulder fit first.",
  sweater: "fine or chunky knit — weight matters for how often you'll wear it.",
  cardigan: "open or button-front knit — length changes how dressy it reads.",
  "knit top": "ribbed or smooth knit — clings more than woven tops.",
  tank: "fitted bodice — check strap width and armhole depth.",
  top: "everyday top — look at neckline and sleeve length.",
  shirt: "button-front — cotton or linen reads casual; silk reads evening.",
  blouse: "soft drape or structure — sleeves and collar set the tone.",
  trousers: "tailored leg — pleats add volume; check rise and hem.",
  pants: "straight or wide leg — fabric weight tells you the season.",
  shorts: "tailored or relaxed — inseam length sets casual vs going-out.",
  "matching set": "coordinated top + bottom — same fabric and color story.",
  sandals: "open toe, ankle or toe strap — heel height changes the occasion.",
  "wedge sandals": "cork or covered wedge — ankle strap adds stability.",
  heels: "pump or mule — height and toe shape change how long you can wear them.",
  boots: "ankle or knee — shaft height and toe shape matter.",
  sneakers: "low profile court or running silhouette.",
  bag: "structured vs slouchy — hardware and strap length set the look.",
  tote: "open top shopper — usually soft structure.",
  piece: "read the silhouette in the photo — fitted, boxy, or draped.",
};

const COLOR_NOTE = {
  black: "reads sharp and dressy — shows lint and pet hair fast.",
  white: "reads clean — check opacity and stain risk on the fabric.",
  cream: "reads soft and warm — pairs with gold jewelry and tan leather.",
  ivory: "reads bridal-adjacent — pairs with gold and warm neutrals.",
  red: "is a statement — one red piece per outfit is usually enough.",
  navy: "is easier than black for day — works with denim and white.",
  blue: "denim or chambray — watch for clashing with other blues in one look.",
  green: "earth tones — olive and sage pair with cream and brown.",
  pink: "reads feminine — balance with denim or a neutral shoe.",
  brown: "reads warm — good with cream, denim, and gold.",
  beige: "is neutral — needs texture contrast so it doesn't look flat.",
};

export function enrichScanTake(data) {
  if (!data || typeof data !== "object") return data;
  const product = data.product || {};
  const verdict = data.verdict || {};
  const category = inferCategory(product);
  const color = inferColor(product);
  const styleNotes = verdict.style_notes || data.style_notes || {};

  const colorText =
    (styleNotes.color && String(styleNotes.color).trim()) ||
    (color && COLOR_NOTE[color] ? `${color} ${COLOR_NOTE[color]}` : color ? `${color} in the photo` : "");

  const styleText =
    (styleNotes.silhouette && String(styleNotes.silhouette).trim()) ||
    STYLE_BY_TYPE[category] ||
    STYLE_BY_TYPE.piece;

  const wearText =
    (styleNotes.wear_with && String(styleNotes.wear_with).trim()) ||
    WEAR_BY_TYPE[category] ||
    WEAR_BY_TYPE.piece;

  const details = [];
  if (colorText) details.push({ key: "color", label: "color", text: colorText.toLowerCase() });
  if (styleText) details.push({ key: "style", label: "style", text: styleText.toLowerCase() });
  if (wearText) details.push({ key: "wear", label: "how to wear", text: wearText.toLowerCase() });

  return {
    ...data,
    verdict: {
      ...verdict,
      details,
    },
  };
}
