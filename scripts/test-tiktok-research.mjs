import {
  buildTikTokSearchQueries,
  extractTikTokUrls,
  productFingerprint,
  tiktokReviewLine,
  tiktokHighlights,
} from "../lib/tiktok-research.js";

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

test("builds broad tiktok queries beyond exact product name", () => {
  const queries = buildTikTokSearchQueries({
    brand: "Jaded London",
    name: "Leona Bootcut Cooper Jeans Tiger",
    color: "Tiger",
    category: "jeans",
  });
  assert(queries.length >= 5, "expected several queries");
  const blob = queries.join(" ").toLowerCase();
  assert(/jaded london/.test(blob), "brand query");
  assert(/tiger print|animal print/.test(blob), "visual descriptor");
  assert(/try on|haul|grwm|sizing/.test(blob), "haul/sizing terms");
});

test("product fingerprint is stable", () => {
  const a = productFingerprint(
    { brand: "Reformation", name: "Cary Slouchy Jeans", color: "Bone" },
    "https://www.thereformation.com/products/cary-slouchy-jeans/123"
  );
  const b = productFingerprint(
    { brand: "Reformation", name: "Cary Slouchy Jeans", color: "Bone" },
    "https://www.thereformation.com/products/cary-slouchy-jeans/123"
  );
  eq(a, b, "same fingerprint");
  assert(a.includes("reformation"), "brand in key");
});

test("tiktok review line prefers consensus", () => {
  const line = tiktokReviewLine({
    consensus: "two reviewers in size 26 wished they'd sized down.",
    sizing_signals: [{ text: "runs large through the waist" }],
  });
  assert(line.includes("sized down"), "consensus wins");
});

test("extracts tiktok urls from reddit-style text", () => {
  const urls = extractTikTokUrls(
    'this haul is great https://www.tiktok.com/@creator/video/7123456789012345678?is_from_webapp=1 and also vm.tiktok.com/ZZZ123/'
  );
  assert(urls.length >= 1, "found at least one url");
  assert(urls[0].includes("/video/7123456789012345678"), "normalized video url");
});

test("tiktok highlights dedupe", () => {
  const rows = tiktokHighlights({
    sizing_signals: [
      { text: "size down — very stretchy", url: "https://www.tiktok.com/@a/video/1" },
      { text: "size down — very stretchy", url: "https://www.tiktok.com/@b/video/2" },
    ],
    videos: [{ title: "finally got my tiger print jeans", url: "https://www.tiktok.com/@c/video/3" }],
  });
  assert(rows.length === 2, "deduped signals + one video");
  assert(rows.every((r) => r.channel === "tiktok"), "channel tag");
});

console.log(`\n${n} passed`);
