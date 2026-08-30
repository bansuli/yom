/* PDP size extraction — real options on THIS listing, not guessed chips. */
window.YOM_SIZES = (() => {
  const READ = () => window.YOM_SIZE_READ || {};

  const SIZE_GROUP =
    /(?:^|[\s_-])(size|sizes|waist|length|width|fit)(?:$|[\s_-])/i;
  const COLOR_GROUP = /color|colour|swatch|hue|shade/i;
  const QTY_GROUP = /qty|quantity|count/i;
  const OOS =
    /sold[- ]?out|unavailable|out[- ]of[- ]stock|\boos\b|not[- ]available|disabled|unavail/i;
  const SELECTED = /(?:^|[\s_-])(selected|active|current|checked|pressed)(?:$|[\s_-])/i;

  function clip(text, n) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n);
  }

  function familyOf(info) {
    return READ().detectFamily?.(info) || "clothes";
  }

  function blobOf(node) {
    if (!node || node.nodeType !== 1) return "";
    return clip(
      [
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("data-attr"),
        node.getAttribute?.("data-attribute"),
        node.getAttribute?.("data-option-name"),
        node.getAttribute?.("data-option"),
        node.getAttribute?.("name"),
        node.id,
        typeof node.className === "string" ? node.className : "",
        node.getAttribute?.("for"),
      ]
        .filter(Boolean)
        .join(" "),
      240
    );
  }

  function isSizeGroup(node) {
    const blob = blobOf(node);
    if (COLOR_GROUP.test(blob) && !SIZE_GROUP.test(blob)) return false;
    if (QTY_GROUP.test(blob) && !SIZE_GROUP.test(blob)) return false;
    return SIZE_GROUP.test(blob) || /size/i.test(node.querySelector?.("legend, .form-label, label, span")?.textContent || "");
  }

  function looksOos(node) {
    if (!node) return false;
    if (node.disabled || node.getAttribute?.("disabled") != null) return true;
    if (node.getAttribute?.("aria-disabled") === "true") return true;
    if (node.getAttribute?.("data-available") === "false") return true;
    const blob = `${blobOf(node)} ${node.getAttribute?.("title") || ""} ${node.textContent || ""}`;
    if (OOS.test(blob)) return true;
    const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node);
    if (style && /line-through/i.test(style.textDecorationLine || style.textDecoration || "")) return true;
    return false;
  }

  function looksSelected(node) {
    if (!node) return false;
    if (node.checked) return true;
    if (node.getAttribute?.("aria-checked") === "true") return true;
    if (node.getAttribute?.("aria-pressed") === "true") return true;
    if (node.getAttribute?.("aria-selected") === "true") return true;
    if (node.selected) return true;
    return SELECTED.test(blobOf(node));
  }

  function labelFrom(node) {
    if (!node) return "";
    const bits = [
      node.getAttribute?.("data-value"),
      node.getAttribute?.("data-attr-value"),
      node.getAttribute?.("value"),
      node.getAttribute?.("aria-label"),
      node.getAttribute?.("title"),
      node.value,
    ];
    for (const bit of bits) {
      const t = clip(bit, 32);
      if (t && !/select size|choose size|size guide/i.test(t)) return t.replace(/^size:?\s*/i, "");
    }
    const text = clip(node.textContent, 32);
    if (/select size|choose size|size guide|notify/i.test(text)) return "";
    return text.replace(/^size:?\s*/i, "");
  }

  function pushLabel(rows, node, family) {
    const raw = labelFrom(node);
    if (!raw) return;
    const parsed = READ().normalizeLabel?.(raw, family);
    if (!parsed) return;
    rows.push({
      raw: parsed.raw,
      label: parsed.label,
      available: !looksOos(node),
      selected: looksSelected(node),
    });
  }

  function fromSelects(root, family) {
    const rows = [];
    const selects = [
      ...root.querySelectorAll(
        "select[name*='size' i], select[id*='size' i], select[aria-label*='size' i], select[data-attribute='size'], select[data-attr='size']"
      ),
    ].filter((n) => !n.closest("#yom-root"));
    for (const sel of selects) {
      [...sel.options].forEach((opt) => {
        if (!opt.value || /select|choose|guide/i.test(opt.textContent || "")) return;
        const parsed = READ().normalizeLabel?.(opt.textContent || opt.value, family);
        if (!parsed) return;
        rows.push({
          raw: parsed.raw,
          label: parsed.label,
          available: !opt.disabled && !looksOos(opt),
          selected: opt.selected,
        });
      });
    }
    return rows;
  }

  function fromButtons(root, family) {
    const rows = [];
    const groups = [
      ...root.querySelectorAll(
        [
          "[data-attr='size']",
          "[data-attribute='size']",
          "[data-option-name='Size']",
          "[data-option-name='size']",
          "[data-option='size']",
          ".swatch--size",
          ".size-selector",
          ".SizeSelector",
          "[class*='size-selector']",
          "[class*='SizePicker']",
          "[class*='sizePicker']",
          "[class*='product-form__input--size']",
          "fieldset",
          "[role='radiogroup']",
          "[role='listbox']",
        ].join(",")
      ),
    ].filter((n) => !n.closest("#yom-root") && isSizeGroup(n));

    const nodes = groups.length
      ? groups.flatMap((g) => [
          ...g.querySelectorAll("button, [role='radio'], [role='option'], label, input[type='radio'], input[type='button'], a, li, span[data-value]"),
        ])
      : [
          ...root.querySelectorAll(
            "button[aria-label*='size' i], [data-attr-value], input[name*='size' i][type='radio']"
          ),
        ];

    for (const node of nodes) {
      if (node.closest("#yom-root")) continue;
      if (COLOR_GROUP.test(blobOf(node)) && !SIZE_GROUP.test(blobOf(node))) continue;
      pushLabel(rows, node, family);
    }
    return rows;
  }

  function fromJsonLd(family) {
    const extract = window.YOM_EXTRACT;
    const product = extract?.jsonLdProduct?.();
    return READ().jsonLdSizeOptions?.(product, family) || [];
  }

  function fromShopify(family) {
    const rows = [];
    const scripts = document.querySelectorAll("script[type='application/json'], script:not([src])");
    for (const el of scripts) {
      const text = el.textContent || "";
      if (!/"variants"\s*:/.test(text) || text.length > 400000) continue;
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
          try {
            parsed = JSON.parse(text.slice(start, end + 1));
          } catch {
            parsed = null;
          }
        }
      }
      const product = parsed?.product || parsed;
      const variants = product?.variants;
      if (!Array.isArray(variants) || !variants.length) continue;
      const options = product?.options || [];
      const sizeIdx = options.findIndex((o) => /size|waist/i.test(String(o?.name || o || "")));
      for (const v of variants) {
        const raw =
          (sizeIdx >= 0 ? v[`option${sizeIdx + 1}`] : null) ||
          v.option1 ||
          v.title ||
          v.public_title;
        const parsedOpt = READ().normalizeLabel?.(raw, family);
        if (!parsedOpt) continue;
        rows.push({
          raw: parsedOpt.raw,
          label: parsedOpt.label,
          available: v.available !== false,
          selected: false,
        });
      }
      if (rows.length) break;
    }
    return rows;
  }

  function pageText(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("#yom-root, .yom-pdp-note, .yom-cart-panel, .yom-ui, script, style, noscript").forEach((n) => n.remove());
    return clip(clone.innerText, 6000);
  }

  function extrasFrom(text) {
    const heel = (text.match(/(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|")\s*heel/i) || [])[1] || "";
    const inseam = (text.match(/inseam[:\s]+(\d+(?:\.\d+)?)\s*(?:in|")?/i) || [])[1] || "";
    const rise = (text.match(/\b(low|mid|high)[- ]?rise\b/i) || [])[1] || "";
    const width = (text.match(/\b(narrow|regular|wide)\s+width\b/i) || [])[0] || "";
    return {
      heel: heel ? `${heel} in heel` : "",
      inseam: inseam ? `${inseam} in inseam` : "",
      rise: rise ? `${rise.toLowerCase()}-rise` : "",
      width: clip(width, 40).toLowerCase(),
    };
  }

  function extract(root, info = {}) {
    const host = root || document.querySelector("main") || document.body;
    const family = familyOf(info);
    const text = pageText(host);
    const labels = [
      ...fromJsonLd(family),
      ...fromShopify(family),
      ...fromSelects(host, family),
      ...fromButtons(host, family),
    ];
    const options = READ().collectOptions?.(labels, family) || labels;
    const fitNote = READ().parseFitNote?.(text) || "";
    const modelSize = READ().parseModelSize?.(text) || "";
    const extras = extrasFrom(text);
    return {
      family,
      options,
      labels: options.map((o) => o.label),
      selected: options.find((o) => o.selected)?.label || "",
      fitNote,
      modelSize,
      model: modelSize ? { size: modelSize } : null,
      extras,
    };
  }

  function match(extracted, sizes, brand) {
    return (
      READ().matchUserSize?.(extracted, sizes, { brand }) || {
        known: false,
        ask: true,
        line: "no size on file yet — what usually fits you?",
        chips: extracted?.labels || [],
        options: extracted?.options || [],
      }
    );
  }

  function read(root, info, sizes, brand) {
    const extracted = extract(root, info);
    return { extracted, match: match(extracted, sizes, brand) };
  }

  function chips(extracted, info) {
    const labels = (extracted?.options || []).map((o) => o.label).filter(Boolean);
    if (labels.length) return labels.slice(0, 12);
    const fam = extracted?.family || familyOf(info || {});
    if (fam === "shoes") return ["6", "6.5", "7", "7.5", "8", "8.5", "9"];
    if (fam === "denim") return ["24", "25", "26", "27", "28", "29"];
    return ["XXS", "XS", "S", "M", "L"];
  }

  return { extract, match, read, chips, familyOf };
})();
