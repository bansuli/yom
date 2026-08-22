/** Recruitment scoring guards — running/gym shoes must not read as a rush win. */

const FASHION_SHOE =
  /\b(samba|gazelle|spezial|stan smith|court|ballet|mary jane|loafer|mule|heel|sandal|boot|slingback|kitten|block heel|flat sandal|slide)\b/i;

const RUNNING_TRAINER =
  /\b(running|runner|trail run|trail runner|gym shoe|gym sneaker|training shoe|performance sneaker|athletic sneaker|pegasus|vomero|structure|ultraboost|zoomx|alphafly|vaporfly|metcon|nano x|hoka|cloudrunner|cloudmonster|on cloud|gel-nimbus|gel-kayano|gel nimbus|brooks ghost|saucony|asics gel|new balance 1080|new balance 880|invincible|peg turbo)\b/i;

const TRAINER_WORD = /\b(trainers?|running shoe|running sneaker|athletic shoe|gym trainer)\b/i;

const WEARABLE =
  /\b(dress|gown|top|skirt|pant|jean|shoe|heel|sandal|boot|bag|purse|tote|clutch|jewel|earring|necklace|bracelet|ring|coat|jacket|sweater|cardigan|blouse|shirt|tee|cami|short|romper|jumpsuit|blazer|knit|denim|sneaker|loafer|hat|belt|sunglass|scarf|hosiery|tights|legging|hoodie|sweatshirt|vest|cape|kimono|slip|bra|underwear|swim|bikini)\b/i;

const NOT_CLOTHING_TALK =
  /\b(no clothing|not clothing|not a garment|not fashion|isn't clothing|is not clothing|not wearable|no garment|nothing to wear)\b/i;

const OBJECT_NOT_FASHION =
  /\b(iphone|ipad|macbook|laptop|keyboard|monitor|sandwich|pizza|burger|coffee|latte|puppy|kitten|sofa|couch|armchair|refrigerator|car keys|passport|receipt|screenshot|houseplant|potted plant)\b/i;

function scanHay(product = {}, verdict = {}) {
  return [
    product.category,
    product.name,
    product.guess,
    product.brand,
    verdict.title,
    verdict.body,
    verdict.why_it_works,
  ]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase();
}

export function isRunningTrainer(product = {}, verdict = {}) {
  const hay = scanHay(product, verdict);
  if (!hay.trim()) return false;
  if (FASHION_SHOE.test(hay) && !RUNNING_TRAINER.test(hay)) return false;
  return RUNNING_TRAINER.test(hay) || (TRAINER_WORD.test(hay) && /shoe|sneaker|trainer|run/.test(hay));
}

export function capRunningTrainerVerdict(product = {}, verdict = {}) {
  if (!isRunningTrainer(product, verdict)) return verdict;
  const scoreRaw = Number(verdict.score);
  const score = Number.isFinite(scoreRaw) ? Math.min(scoreRaw, 4.2) : 4.2;
  const title = String(verdict.title || "").toLowerCase();
  return {
    ...verdict,
    score,
    kind: "warn",
    decision_hint: "skip",
    title: /skip|wrong|not|too/.test(title) ? verdict.title : "skip — running trainers aren’t a rush shoe",
    change:
      verdict.change ||
      verdict.resolve ||
      "swap these for a walkable flat, sandal, or fashion sneaker — not a gym shoe.",
  };
}

export function emptyClothingVerdict() {
  return {
    quiet: true,
    stamp: "empty",
    kind: "neutral",
    title: "no clothing detected",
    body: "yom needs a photo, link, or description of something you’d actually wear.",
    resolve: "try a garment, shoes, bag, or jewelry.",
    decision_hint: null,
    score: null,
    round: null,
    why_it_works: "",
    change: "",
    berkeley: "",
    spotting: "",
  };
}

export function isNonClothingScan(product = {}, verdict = {}) {
  if (verdict?.quiet) return true;
  const hay = scanHay(product, verdict);
  if (!hay.trim()) return false;
  if (NOT_CLOTHING_TALK.test(hay)) return true;
  if (WEARABLE.test(hay)) return false;
  return OBJECT_NOT_FASHION.test(hay);
}
