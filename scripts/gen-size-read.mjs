import fs from "fs";

const src = fs.readFileSync(new URL("../lib/size-read.js", import.meta.url), "utf8").replace(/^export /gm, "");
const out = `/* generated from lib/size-read.js — do not edit by hand */
window.YOM_SIZE_READ = (function () {
${src}
return {
  clip,
  detectFamily,
  detectPiece,
  lookupBrandFit,
  resolveRun,
  normalizeLabel,
  parseUserSize,
  parseFitNote,
  parseModelSize,
  collectOptions,
  matchUserSize,
  formatQuote,
  sizeDisplay,
  jsonLdSizeOptions,
  extractSizeCore,
  shopifySizeIndex,
  shopifyVariantOptions,
  shopifyOption1FromHtml,
};
})();
`;
fs.writeFileSync(new URL("../extension/content/size-read.js", import.meta.url), out);
console.log("wrote extension/content/size-read.js");
