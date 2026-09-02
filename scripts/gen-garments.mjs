/*
 * Turns the authored garment paths into the point arrays the hero uses.
 *
 * Run once, by hand, and paste nothing — it writes src/components/heroGarments.js
 * itself. Same contract as the traced artwork: `outer` normalised so the longer
 * side spans 1 and the centre is the origin, y up.
 *
 *   node scripts/gen-garments.mjs
 */
import { writeFileSync } from "node:fs";

const PATHS = {
  tee: "M38 4 C38 12 46 17 50 17 C54 17 62 12 62 4 L75 8 L96 27 C98 29 98 32 96 34 L86 47 C84 49 81 49 79 47 L74 40 L74 81 C74 85 71 88 67 88 L33 88 C29 88 26 85 26 81 L26 40 L21 47 C19 49 16 49 14 47 L4 34 C2 32 2 29 4 27 L25 8 Z",
  jumper: "M53 6 C53 13 59 18 65 18 C71 18 77 13 77 6 L91 10 L127 52 C129 55 128 59 125 61 L115 67 C112 69 108 68 106 65 L91 40 L91 94 C91 98 88 101 84 101 L46 101 C42 101 39 98 39 94 L39 40 L24 65 C22 68 18 69 15 67 L5 61 C2 59 1 55 3 52 L39 10 Z",
  trousers: "M8 3 L56 3 C58 20 58 31 58 45 L55 96 C55 98 53 99 51 99 L42 99 C40 99 38 98 38 96 L37 53 L27 53 L26 96 C26 98 24 99 22 99 L13 99 C11 99 9 98 9 96 L6 45 C6 31 6 20 8 3 Z",
  skirt: "M24 3 L76 3 C78 18 85 42 97 68 C99 74 97 79 91 80 C69 86 31 86 9 80 C3 79 1 74 3 68 C15 42 22 18 24 3 Z",
  dress: "M26 4 L36 4 C38 11 41 14 43 14 C45 14 48 11 50 4 L60 4 C62 4 63 6 64 9 L66 28 C66 31 64 33 61 34 L58 46 L70 89 C71 94 68 97 63 97 L23 97 C18 97 15 94 16 89 L28 46 L25 34 C22 33 20 31 20 28 L22 9 C23 6 24 4 26 4 Z",
  sneaker: "M12 60 C8 60 5 57 5 52 L6 40 C6 33 8 26 12 21 C15 17 19 16 22 19 C25 22 25 25 28 26 C32 27 36 24 39 19 C42 14 47 12 52 15 L71 23 C84 28 97 33 107 38 C111 40 114 43 113 47 C112 52 108 55 103 56 L92 58 C80 60 68 60 56 59 C50 58 44 59 38 60 Z",
  sunglasses: "M4 14 C4 8 9 4 17 3 L44 3 C48 3 50 5 50 8 C51 11 55 11 56 8 C56 5 58 3 62 3 L89 3 C97 4 102 8 102 14 C102 26 96 36 86 38 C74 40 66 34 63 22 C62 17 60 15 56 15 L50 15 C46 15 44 17 43 22 C40 34 32 40 20 38 C10 36 4 26 4 14 Z",
};

/** Absolute M / L / C / Z only — that is all the paths above use. */
function flatten(d, perCurve = 48) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/gi);
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  let start = [0, 0];
  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      cur = [num(), num()];
      start = cur;
      pts.push(cur);
    } else if (cmd === "L") {
      cur = [num(), num()];
      pts.push(cur);
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
      const [x0, y0] = cur;
      for (let s = 1; s <= perCurve; s++) {
        const t = s / perCurve;
        const u = 1 - t;
        pts.push([
          u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
      cur = [x, y];
    } else if (cmd === "Z") {
      pts.push(start);
      cur = start;
    }
  }
  return pts;
}

/** Even spacing around the outline, so no edge is denser than another. */
function resample(poly, n) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    const d = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    total += d;
    seg.push(total);
  }

  const out = [];
  let at = 1;
  for (let k = 0; k < n; k++) {
    const want = (total * k) / n;
    while (at < seg.length && seg[at - 1] < want) at++;
    const prev = at === 1 ? 0 : seg[at - 2];
    const span = seg[at - 1] - prev || 1;
    const t = (want - prev) / span;
    const a = poly[at - 1];
    const b = poly[at];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Longer side spans 1, centre at the origin, y flipped to point up. */
function normalise(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = 1 / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const r = (v) => Number(v.toFixed(4));
  return pts.map(([x, y]) => [r((x - cx) * s), r((cy - y) * s)]);
}

const POINTS = 88;
const body = Object.entries(PATHS)
  .map(([name, d]) => {
    const outer = normalise(resample(flatten(d), POINTS));
    return `  ${name}: {\n    outer: [${outer.map(([x, y]) => `[${x},${y}]`).join(",")}],\n    hole: [],\n  },`;
  })
  .join("\n");

const file = `/*
 * The garments, drawn rather than photographed.
 *
 * Every shape here was authored as an SVG path and sampled into an outline, so
 * the whole set shares one hand — one line weight, one amount of rounding, one
 * level of detail. That is the difference that matters. Six photographs of real
 * clothes come from six studios with six different lights behind them, and no
 * amount of arranging makes them look like they belong to the same world; the
 * pile reads as a marketplace grid because that is exactly what it is. Drawn,
 * they are objects in this scene, lit by this scene, and the glass has
 * something to hold.
 *
 * They are also all things rather than textiles. A t-shirt is in here, but the
 * set leans on forms with some body to them, because glass needs a thickness to
 * travel through — a shape with no depth to it comes back looking like a sticker
 * however good the outline is.
 *
 * Same contract as heroArtwork.js: \`outer\` is the silhouette normalised so the
 * longer side spans 1 and the centre is the origin, y up, and \`hole\` is the gap
 * inside it. None of these have holes.
 *
 * Regenerate with scripts/gen-garments.mjs — the paths live in there, not
 * here. Editing the numbers below by hand is not the way to change a shape.
 */
export const GARMENTS = {
${body}
};
`;

writeFileSync(new URL("../src/components/heroGarments.js", import.meta.url), file);
console.log("wrote heroGarments.js");
for (const [name, d] of Object.entries(PATHS)) {
  const p = normalise(resample(flatten(d), POINTS));
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  console.log(`  ${name.padEnd(11)} ${p.length} pts  ratio ${(w / h).toFixed(2)}`);
}
