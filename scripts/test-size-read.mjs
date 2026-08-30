import {
  collectOptions,
  detectFamily,
  formatQuote,
  matchUserSize,
  normalizeLabel,
  parseFitNote,
  parseModelSize,
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

console.log(`\n${n} size tests passed`);
