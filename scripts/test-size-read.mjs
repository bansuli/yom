import {
  collectOptions,
  detectFamily,
  detectPiece,
  extractSizeCore,
  shopifySizeIndex,
  formatQuote,
  lookupBrandFit,
  matchUserSize,
  normalizeLabel,
  parseFitNote,
  parseModelSize,
  resolveRun,
} from "../lib/size-read.js";
import { reviewLine, reviewRegretDelta } from "../lib/review-research.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

let n = 0;
function test(name, fn) {
  fn();
  n += 1;
  console.log(`ok  ${name}`);
}

test("detects shoes vs denim vs clothes", () => {
  eq(detectFamily({ name: "leather mule" }), "shoes", "mule");
  eq(detectFamily({ href: "/products/jeans" }), "denim", "jeans url");
  eq(detectFamily({ name: "silk slip dress" }), "clothes", "dress");
  eq(detectFamily({ name: "denim jacket" }), "clothes", "denim jacket is not jeans");
  eq(detectFamily({ name: "stretch denim pant" }), "clothes", "denim fabric is not waist sizing");
});

test("noisy picker copy still yields a size", () => {
  eq(extractSizeCore("Select Size 8 · Sold out", "shoes"), "8", "select size 8");
  eq(normalizeLabel("Select Size 8 · Sold out", "shoes").label, "us 8", "8 is US shoe");
  eq(normalizeLabel("US 4 / EU 36", "clothes").label, "us 4", "prefer us");
  eq(normalizeLabel("Size 4 - Sold Out", "clothes").label, "us 4", "sold out suffix");
  eq(normalizeLabel("W26 L30", "denim").value, "26", "w26");
});

test("shopify size index skips color", () => {
  eq(shopifySizeIndex(["Color", "Size"]), 1, "size second");
  eq(shopifySizeIndex(["Colour", "Waist", "Length"]), 1, "waist over length");
  eq(shopifySizeIndex(["Color"]), -1, "color only is not a size");
});

test("normalizes US numeric, alpha, EU clothes", () => {
  eq(normalizeLabel("4", "clothes").label, "us 4", "bare 4");
  eq(normalizeLabel("US 4", "clothes").system, "us", "tagged us");
  eq(normalizeLabel("S", "clothes").value, "s", "alpha");
  eq(normalizeLabel("36", "clothes").label, "eu 36", "eu dress");
  eq(normalizeLabel("one size", "clothes").system, "os", "os");
  eq(normalizeLabel("Size guide", "clothes"), null, "junk");
  eq(normalizeLabel("4.5 stars", "clothes"), null, "stars");
});

test("normalizes shoes vs clothes for the same number", () => {
  eq(normalizeLabel("38", "shoes").system, "shoe_eu", "38 is EU shoe");
  eq(normalizeLabel("7.5", "shoes").system, "shoe_us", "7.5 is US shoe");
  eq(normalizeLabel("38", "clothes").system, "eu", "38 is EU dress");
  eq(normalizeLabel("EU 38", "shoes").system, "shoe_eu", "tagged eu shoe");
});

test("normalizes denim waist", () => {
  eq(normalizeLabel("26", "denim").system, "denim", "26");
  eq(normalizeLabel("26x32", "denim").value, "26", "26x32 waist");
  eq(normalizeLabel("W26 L30", "denim").value, "26", "W26");
  eq(normalizeLabel("6", "denim").label, "us 6", "us numeric on denim-tagged listing");
  eq(normalizeLabel("10", "denim").label, "us 10", "two-digit us numeric");
});

test("everlane us 6 matches when listing uses numeric sizes", () => {
  const options = collectOptions(["00", "0", "2", "4", "6", "8", "10"], "denim");
  const m = matchUserSize(
    { family: "denim", options, name: "Everywhere Pant" },
    { brands: { everlane: "US 6" } },
    { brand: "Everlane", name: "Everywhere Pant" }
  );
  eq(m.status, "in_stock", "status");
  eq(m.listingLabel, "us 6", "listing");
});

test("US 4 matches Reformation 4", () => {
  const extracted = { family: "clothes", options: collectOptions(["0", "2", "4", "6", "8"], "clothes") };
  const m = matchUserSize(extracted, { us: "US 4" });
  eq(m.status, "in_stock", "status");
  eq(m.listingLabel, "us 4", "listing");
  assert(/in stock/i.test(m.line), m.line);
});

test("US 4 maps to S on an alpha listing", () => {
  const extracted = { family: "clothes", options: collectOptions(["XXS", "XS", "S", "M", "L"], "clothes") };
  const m = matchUserSize(extracted, { us: "4" });
  eq(m.status, "converted", "converted");
  eq(m.listingLabel, "s", "s");
  assert(m.line.includes("s"), m.line);
});

test("US 4 maps to EU 36", () => {
  const extracted = { family: "clothes", options: collectOptions(["32", "34", "36", "38", "40"], "clothes") };
  const m = matchUserSize(extracted, { us: "US 4" });
  eq(m.listingLabel, "eu 36", "eu 36");
  eq(m.status, "converted", "converted");
});

test("sold out is called sold out", () => {
  const extracted = {
    family: "clothes",
    options: collectOptions(
      [
        { raw: "2", available: true },
        { raw: "4", available: false },
        { raw: "6", available: true },
      ],
      "clothes"
    ),
  };
  const m = matchUserSize(extracted, { us: "4" });
  eq(m.status, "sold_out", "oos");
  assert(/sold out/i.test(m.line), m.line);
});

test("brand-specific size beats usual US", () => {
  const extracted = { family: "clothes", options: collectOptions(["XS", "S", "M"], "clothes") };
  const m = matchUserSize(extracted, { us: "4", brands: { Aritzia: "M" } }, { brand: "Aritzia" });
  eq(m.listingLabel, "m", "brand m");
  eq(m.source, "brand", "source");
});

test("shoe US 7.5 matches EU 38", () => {
  const extracted = { family: "shoes", options: collectOptions(["36", "37", "38", "39", "40"], "shoes") };
  const m = matchUserSize(extracted, { shoes: "7.5" });
  eq(m.listingLabel, "eu 38", "eu 38");
  eq(m.family, "shoes", "family");
});

test("shoe EU 38 matches listing 38", () => {
  const extracted = { family: "shoes", options: collectOptions(["36", "37", "38", "39"], "shoes") };
  const m = matchUserSize(extracted, { shoes: "EU 38" });
  eq(m.status, "in_stock", "in stock");
  eq(m.listingLabel, "eu 38", "label");
});

test("denim 26 matches 26x32", () => {
  const extracted = { family: "denim", options: collectOptions(["24", "25", "26x32", "27"], "denim") };
  const m = matchUserSize(extracted, { denim: "26" });
  eq(m.listingLabel, "26x32", "26x32");
});

test("unknown size asks instead of guessing", () => {
  const extracted = { family: "clothes", options: collectOptions(["0", "2", "4", "6"], "clothes") };
  const m = matchUserSize(extracted, {});
  eq(m.known, false, "unknown");
  eq(m.ask, true, "ask");
  assert(m.chips.includes("us 4"), `chips ${m.chips}`);
});

test("one size does not ask", () => {
  const extracted = { family: "clothes", options: collectOptions(["One Size"], "clothes") };
  const m = matchUserSize(extracted, {});
  eq(m.status, "one_size", "os");
  eq(m.ask, false, "no ask");
});

test("fit note and model wearing parse from page copy", () => {
  const note = parseFitNote("Fits true to size. Size down for a closer fit if between sizes.");
  assert(/true to size/i.test(note), note);
  eq(parseModelSize("Model is wearing a 4"), "4", "model");
});

test("quote is a short named line, not an essay", () => {
  const q = formatQuote({
    channel: "reddit",
    text: "size up if you're between — the waist is unforgiving on the first wear",
  });
  assert(q.startsWith("reddit:"), q);
  assert(q.length < 180, `too long ${q.length}`);
  assert(!q.includes("\n"), "single line");
});

test("selected size is noted when it is theirs", () => {
  const extracted = {
    family: "clothes",
    options: collectOptions(
      [
        { raw: "2" },
        { raw: "4", selected: true },
        { raw: "6" },
      ],
      "clothes"
    ),
  };
  const m = matchUserSize(extracted, { us: "4" });
  assert(/selected/i.test(m.line), m.line);
});

test("size not on the listing is said plainly", () => {
  const extracted = { family: "clothes", options: collectOptions(["0", "2", "4"], "clothes") };
  const m = matchUserSize(extracted, { us: "14" });
  eq(m.status, "not_offered", "not offered");
  assert(/doesn'?t have/i.test(m.line), m.line);
});

test("review line prefers a short fit note over an essay", () => {
  const line = reviewLine({
    summary: "lots of people like this dress and wear it to dinner and also mention the lining.",
    fit_note: "ltk haul: size up, waist is unforgiving",
    highlights: [{ channel: "reddit", text: "a very long unrelated comment about the brand in general" }],
    channels: ["ltk"],
  });
  assert(line.includes("size up"), line);
  assert(line.length < 180, `too long ${line.length}`);
});

test("regret only moves when real review channels exist", () => {
  eq(reviewRegretDelta({}), 0, "empty");
  const up = reviewRegretDelta({
    fit: "runs small",
    sentiment: "negative",
    quality: "pilling after two washes",
    channels: ["tiktok", "shopmy"],
    highlights: [{ channel: "tiktok", text: "sized up and it still felt tight" }],
  });
  assert(up > 0, `expected higher regret, got ${up}`);
  const keep = reviewRegretDelta({
    fit: "true to size",
    sentiment: "positive",
    channels: ["ltk"],
    highlights: [{ channel: "ltk", text: "true to size, kept it" }],
  });
  assert(keep < 0, `expected lower regret, got ${keep}`);
});

test("detects piece: dress vs pants vs denim vs shoes", () => {
  eq(detectPiece({ name: "silk slip dress" }), "dress", "dress");
  eq(detectPiece({ name: "effortless pant" }), "pants", "pants");
  eq(detectPiece({ name: "90s jeans" }), "denim", "denim");
  eq(detectPiece({ name: "leather mule" }), "shoes", "shoes");
  eq(detectPiece({ name: "denim jacket" }), "jacket", "jacket not denim");
});

test("reformation dresses run small so 6 is the safer pick", () => {
  const extracted = {
    family: "clothes",
    piece: "dress",
    name: "crinkle silk slip",
    options: collectOptions(["0", "2", "4", "6", "8"], "clothes"),
  };
  const m = matchUserSize(extracted, { us: "4" }, { brand: "Reformation", piece: "dress" });
  eq(m.listingLabel, "us 4", "mapped size stays 4");
  eq(m.recommend, "us 6", "size up");
  eq(m.runSource, "brand", "brand table");
  assert(/safer pick/.test(m.line), m.line);
});

test("a size she already told us for the brand is not shifted again", () => {
  const extracted = { family: "clothes", options: collectOptions(["XS", "S", "M", "L"], "clothes") };
  const m = matchUserSize(extracted, { us: "4", brands: { Aritzia: "M" } }, { brand: "Aritzia" });
  eq(m.listingLabel, "m", "brand m");
  eq(m.recommend, "", "no second shift");
  eq(m.source, "brand", "source");
});

test("listing fit note beats the brand table", () => {
  const extracted = {
    family: "clothes",
    fitNote: "true to size",
    options: collectOptions(["0", "2", "4", "6"], "clothes"),
  };
  const m = matchUserSize(extracted, { us: "4" }, { brand: "Reformation", piece: "dress" });
  eq(m.run, "tts", "page tts");
  eq(m.runSource, "page", "page wins");
  eq(m.recommend, "", "no shift");
});

test("this product's reviews beat the brand table", () => {
  const extracted = {
    family: "clothes",
    options: collectOptions(["xs", "s", "m", "l"], "clothes"),
  };
  const m = matchUserSize(
    extracted,
    { us: "4" },
    { brand: "COS", piece: "dress", reviewFit: { fit: "runs small", fit_note: "reddit: size up in this one" } }
  );
  eq(m.listingLabel, "s", "us 4 → s");
  eq(m.recommend, "m", "reviews size up");
  eq(m.runSource, "reviews", "reviews");
});

test("nike 7.5 maps to eu 38 and recommends the next half if they have it", () => {
  const extracted = {
    family: "shoes",
    options: collectOptions(["37", "38", "38.5", "39", "40"], "shoes"),
  };
  const m = matchUserSize(extracted, { shoes: "7.5" }, { brand: "Nike", piece: "shoes" });
  eq(m.listingLabel, "eu 38", "eu 38");
  eq(m.recommend, "eu 38.5", "half up");
  assert(/narrow/.test(m.line), m.line);
});

test("nike without half sizes recommends the next listing size, never invents 38.5", () => {
  const extracted = { family: "shoes", options: collectOptions(["36", "37", "38", "39", "40"], "shoes") };
  const m = matchUserSize(extracted, { shoes: "7.5" }, { brand: "Nike" });
  eq(m.listingLabel, "eu 38", "mapped");
  eq(m.recommend, "eu 39", "next on picker");
});

test("hoka is often roomy so the safer pick is down", () => {
  const extracted = { family: "shoes", options: collectOptions(["37", "38", "38.5", "39"], "shoes") };
  const m = matchUserSize(extracted, { shoes: "7.5" }, { brand: "Hoka" });
  eq(m.listingLabel, "eu 38", "mapped");
  eq(m.recommend, "eu 37", "size down");
});

test("adidas sambas are tighter than adidas in general", () => {
  const row = lookupBrandFit("Adidas", "shoes", "shoes", "samba og");
  eq(row.run, "small", "samba small");
  const generic = lookupBrandFit("Adidas", "shoes", "shoes", "ultraboost");
  eq(generic.run, "tts", "other adidas tts");
});

test("shoe 240 mm matches us 7.5", () => {
  const extracted = { family: "shoes", options: collectOptions(["230 mm", "240 mm", "250 mm"], "shoes") };
  const m = matchUserSize(extracted, { shoes: "7.5" });
  eq(m.listingLabel, "240 mm", "mondo");
});

test("shoe width stays on the label", () => {
  const p = normalizeLabel("7.5 W", "shoes");
  eq(p.system, "shoe_us", "us shoe");
  eq(p.width, "w", "wide");
  eq(p.label, "us 7.5 w", "label");
});

test("resolveRun priority is page, then reviews, then brand+piece", () => {
  eq(resolveRun({ brand: "Nike", family: "shoes", piece: "shoes" }).run, "small", "brand");
  eq(resolveRun({ fitNote: "true to size", brand: "Nike", family: "shoes" }).source, "page", "page");
  eq(resolveRun({ brand: "COS", piece: "dress", reviewFit: { fit: "runs large" } }).source, "reviews", "reviews");
});

test("clothes reject shoe half sizes and odd us shoe numbers", () => {
  eq(normalizeLabel("7.5", "clothes"), null, "half size");
  eq(normalizeLabel("5", "clothes"), null, "odd shoe");
  eq(normalizeLabel("6", "clothes")?.label, "us 6", "even clothes");
  eq(normalizeLabel("7.5", "shoes")?.label, "us 7.5", "shoes keep half");
});

test("collectOptions drops shoe bleed on dress pickers", () => {
  const opts = collectOptions(["us 4", "us 6", "7.5", "5", "8.5", "us 8"], "clothes");
  const labels = opts.map((o) => o.label);
  assert(!labels.includes("7.5"), labels.join());
  assert(!labels.includes("5"), labels.join());
  assert(labels.includes("us 4"), labels.join());
});

test("zero-padded us sizes normalize and match", () => {
  const opts = collectOptions(["us 000", "us 002", "us 004", "us 006"], "clothes");
  eq(opts.find((o) => o.label === "us 4")?.parsed?.value, "4", "label");
  const m = matchUserSize({ family: "clothes", options: opts, labels: opts.map((o) => o.label) }, { us: "4" });
  eq(m.status, "in_stock", m.status);
  eq(m.listingLabel, "us 4", m.listingLabel);
});

console.log(`\n${n} size tests passed`);
