# How yom reads size

Size is a **match**, not a guess. We read the sizes on this listing, read what this person actually wears, and only convert between systems when the listing uses a different one than we have on file. Empty is better than an invented number.

The size line on the PDP is produced **in the extension** before the model speaks. The advise API rematches the same data so the model cannot override a listing size that is not on the page.

## One-sentence answer

> We scrape this product’s real size picker, look up her usual size for clothes / denim / shoes (or this brand if we have it), map only when the shop uses a different system, and say in-stock / sold-out / not offered. If we don’t know her size, we ask using this page’s chips — we do not invent US 2/4/6.

## Files

| Piece | Where |
|---|---|
| Matcher (source of truth) | [`lib/size-read.js`](../lib/size-read.js) |
| Same matcher, for the extension | [`extension/content/size-read.js`](../extension/content/size-read.js) (generated from the lib file) |
| PDP scraper | [`extension/content/sizes.js`](../extension/content/sizes.js) |
| Overlay (ask, line, regret) | [`extension/content/content.js`](../extension/content/content.js) |
| Advise rematch + size line fallback | [`api/yom-advise.js`](../api/yom-advise.js) |
| Saved sizes | `profiles.sizes` via [`api/memory.js`](../api/memory.js) |
| Tests | `npm run test:size` → [`scripts/test-size-read.mjs`](../scripts/test-size-read.mjs) |

If you change conversion tables, edit `lib/size-read.js` and regenerate the extension copy (the generate step in that conversation, or re-run the same wrap). Do not hand-edit `extension/content/size-read.js`.

## Voice

All tips, size lines, asks, and advise/scan copy are **lowercase**. Same voice as the rest of yom: short, specific, no em-dashes. Size tokens in speech are `us 4`, `s`, `eu 38` — not `US 4` / `S`. Stored profile values may still arrive as `US 4`; we lowercase them when we say them.

## What we store on the person

`profiles.sizes` is a JSON object, not a single number:

```json
{
  "us": "US 4",
  "denim": "26",
  "shoes": "7.5",
  "brands": { "Aritzia": "M", "Reformation": "4" }
}
```

Display form (older / founder profiles) is a list of `{ label, value }` rows. [`lib/profile.js`](../lib/profile.js) `sizeMap()` folds that into `us` / `denim` / `shoes`.

**Priority when matching this listing:**

1. Brand-specific size (`brands[this shop]`) if we have one
2. Else shoes size, if the product is shoes
3. Else denim waist, if the product is jeans
4. Else usual `us` (dresses / tops / RTW)
5. Else we don’t know → ask, don’t guess

The extension also keeps a local `learned` overlay (same fields) and POSTs it to `/api/memory` as `YOM_LEARN` so the next session has it.

## What we scrape on the listing

Only on a PDP. Sources, in order, then merged/deduped:

1. JSON-LD `Product` offers / variants (`size`, availability)
2. Shopify `product.variants` JSON in the page
3. `<select>` named/labelled size
4. Size buttons / radios / pills (Reformation, Aritzia, etc.)

For each option we keep: **label**, **in stock vs sold out**, **selected**.

We also pull, if the copy is on the page:

- fit note (`true to size`, `runs small`, `size up`, …)
- `model is wearing a 4`
- extras (heel height, inseam, rise, shoe width) when they appear as text

We deliberately skip: quantity, color swatches, “size guide” links, star ratings, “4 left”.

## How a raw label becomes a size

`normalizeLabel(raw, family)` needs the **family** so the same number is not ambiguous.

| Family | How we detect it | Bare `38` means | Bare `7.5` means | Bare `4` means | Bare `26` means |
|---|---|---|---|---|---|
| `shoes` | name/url/category has shoe words | EU 38 | US 7.5 | US 4 (women’s) | ignored unless tagged |
| `denim` | jeans/denim, and not a denim jacket | — | — | — | waist 26 (`26x32` still waist 26) |
| `clothes` | everything else | EU 36–50 even | — | US 4 | — |

Tagged labels (`US 4`, `EU 38`, `S`) always win over the bare-number heuristic.

Junk rejected: `size guide`, `4.5 stars`, `select size`, `notify me`.

## Conversion (only when systems differ)

We do **not** convert if the listing already uses her system. US 4 on a `0/2/4/6` grid is just **4**.

When the listing is a different system, we use typical women’s RTW / shoe charts. Brands vary; the line says so (`you wear US 4 → S here`).

**Clothes US → letter (usual match first, neighbor second):**

| US | Letters we will accept, in order |
|---|---|
| 00 | XXS, XXXS |
| 0 | XS, XXS |
| 2 | XS, S |
| 4 | S |
| 6 | S, M |
| 8 | M |
| 10 | M, L |
| 12 | L |
| 14 | L, XL |
| 16 | XL |
| 18 | XL, XXL |

**Clothes US → EU:** 0→32, 2→34, **4→36**, 6→38, 8→40, 10→42, 12→44, 14→46.

**Shoes US women’s → EU (primary):** 6→36, 6.5→36.5/37, 7→37/37.5, **7.5→38**, 8→38.5/39, 8.5→39, 9→40. UK equivalents exist in the same table.

If two listing options could match, we pick the **higher-scoring in-stock** one (exact system beats converted; in-stock beats sold-out).

## What the size line can say

| Status | Meaning | Example line |
|---|---|---|
| `in_stock` | Her size is on the listing and available | `your us 4 is in stock.` |
| `converted` | Same person, different system on the shop | `you wear us 4 → s here, in stock.` |
| `sold_out` | We found her size; it’s OOS | `us 4 is sold out.` |
| `not_offered` | Her size is not on this grid | `you wear us 14. this listing doesn't have it.` |
| `one_size` | Listing is OS / OSFA | `one size.` |
| `unknown` | No size on file | `no size on file yet. what usually fits you?` |

If she already selected her size on the page: `4 is selected. that's your size.`

Fit note / model wearing may be appended as a second beat, still one line. Review copy is a **separate** reviews line, not stuffed into size.

## Asking her (so the file gets accurate)

On a PDP, if we don’t know a size for this family/brand, the overlay asks **using this listing’s chips**, not hardcoded `US 2/4/6/8`.

After she picks: **does that usually fit you in {brand}?** → yes / i size up / i size down.

If closet/Gmail shows a **kept** piece from this brand and we already know a size, we ask once: **you kept {item}. did that size fit well?**

That writes:

- `sizes.brands[brand]`
- `sizes.us` / `denim` / `shoes` depending on family
- a memory note (`sizes up from 4 in reformation`)

Once per brand per session so we don’t nag.

## What size is not

- The model does **not** invent a size. Advise uses `page_sizes` + `size_read`. If the model skips `size`, we fill it from the matcher.
- Reviews (TikTok hauls, ShopMy, LTK, IG posts/reels, Reddit, Amazon, brand site) can say **how it runs**. They do not replace the number on the picker.
- Instagram **stories** are not read (they expire / aren’t public).
- We used to coin-flip “runs long” from a hash. That no longer drives the size line.

## Regret

Regret starts from the usual product/closet/budget signals, then moves only on **facts**:

- her size sold out or not offered
- page fit note (runs small / size up)
- real review channels (pilling, returns, runs small) via `reviewRegretDelta`

No review sources → delta is 0. We do not swing regret on invented quotes.

## How to test / debug

```bash
npm run test:size
```

Covers: family detection, junk rejection, US↔letter↔EU clothes, US 7.5→EU 38 shoes, denim 26 vs 26x32, sold out, brand-specific beating usual US, ask-when-unknown, one size.

On a live PDP: reload the unpacked extension, open a product, read the **size** fact against the shop’s picker. If chips look like `US 2/4/6/8` instead of this page’s sizes, extraction missed the picker (check `YOM_SIZES.extract` on that shop).

## FAQ

**Why did it say S when she wears a 4?**  
The listing is letter sizes. US 4 maps to S on the usual RTW chart. The line should say `you wear us 4 → s here`.

**Why didn’t it convert?**  
The listing already has `4`. Conversion only runs across systems.

**Why EU 38 for shoes but EU 36 for a dress?**  
Family. Shoes: 38 is a shoe EU. Clothes: even 30–52 is a dress EU (US 4 → 36).

**Can we add a brand that sizes weird?**  
Yes — that’s what `brands[Aritzia]=M` is for. After she tells us once, brand-specific beats the generic US chart.

**Does scan (photo) use this?**  
This path is the **extension on a store page**. Photo scan still has `size_label` from the tag if the model can read it; it does not run the PDP scraper.
