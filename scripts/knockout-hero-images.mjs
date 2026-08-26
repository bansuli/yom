/**
 * Strip near-white backgrounds from hero collage assets so they sit on the
 * dotted page without white rectangles. Writes *-nobg.webp next to sources.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../src/assets");

const FILES = [
  "product-sneaker.webp",
  "product-shirt.webp",
  "product-cardigan.webp",
  "product-tabi.jpg",
  "product-tank.jpg",
  "PRECIOUS V3 PANTS BLUE & PINK BY COLD CULTURE.webp",
  "Isabel Marant Maia Large Cognac Shoulder Bag & Authentic.jpg",
  "8e33e8051d690d5d76801ad0d826fdc8.jpg",
];

const THRESHOLD = 238;
const SOFT = 18;

function knockOut(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    if (min >= THRESHOLD) {
      data[i + 3] = 0;
      continue;
    }
    if (min >= THRESHOLD - SOFT) {
      const fade = (THRESHOLD - min) / SOFT;
      data[i + 3] = Math.round(data[i + 3] * fade);
    }
  }
}

for (const file of FILES) {
  const input = path.join(ROOT, file);
  const base = file.replace(/\.(webp|jpe?g|png)$/i, "");
  const output = path.join(ROOT, `${base}-nobg.webp`);

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  knockOut(data);
  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100 })
    .toBuffer();

  await writeFile(output, out);
  console.log(`${file} → ${path.basename(output)} (${info.width}×${info.height})`);
}
