import assert from "node:assert/strict";
import { decodeGmailBody, mergeGmailSizes, parseGmailMessage } from "../lib/gmail-parse.js";

let n = 0;
function test(name, fn) {
  n++;
  fn();
  console.log("ok ", name);
}

test("parses order line with size", () => {
  const parsed = parseGmailMessage({
    subject: "Your Reformation order confirmation",
    snippet: "Agathe Dress Size 4 $148",
    body: "Items in your order:\nAgathe Dress - Size 4 - $148.00\nColor: Black",
    from_addr: "orders@thereformation.com",
    signal_kind: "order",
    gmail_id: "abc123",
  });
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].size, "us 4");
  assert.equal(parsed.brand, "Reformation");
});

test("parses return email", () => {
  const parsed = parseGmailMessage({
    subject: "Your return from Aritzia",
    snippet: "Effortless Pant Size M return received",
    body: "We received your return for Effortless Pant Size M.",
    signal_kind: "return",
    gmail_id: "ret1",
  });
  assert.equal(parsed.items[0].kept, false);
  assert.equal(parsed.items[0].size, "m");
});

test("merge gmail sizes into profile brands", () => {
  const merged = mergeGmailSizes({ us: "US 4" }, [{ brand: "Reformation", size: "us 6", item: "dress", kind: "dress" }]);
  assert.equal(merged.brands.Reformation, "us 6");
});

test("decode gmail body strips html", () => {
  const text = decodeGmailBody({
    mimeType: "text/html",
    body: { data: Buffer.from("<p>Size: <b>M</b></p>").toString("base64url") },
  });
  assert.match(text, /size/i);
});

console.log(`\n${n} gmail parse tests passed`);
