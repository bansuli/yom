/* Generic shop reading — JSON-LD, Open Graph, common product cards */
window.YOM_EXTRACT = (() => {
  const SKIP_HOST =
    /(^|\.)(google\.com|gmail\.com|github\.com|stackoverflow\.com|notion\.so|slack\.com|facebook\.com|instagram\.com|youtube\.com|twitter\.com|x\.com|linkedin\.com|chatgpt\.com|openai\.com|cursor\.com|youryom\.com|vercel\.app|reddit\.com|tiktok\.com|amazon\.com|ebay\.com|walmart\.com|target\.com|etsy\.com)$/i;

  const REC_COPY =
    /complete the look|looks good with|things you looked at|you may also|recently viewed|recommended|customers also|we’re cute too|we're cute too|similar items|you might also/i;

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function asArray(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  function jsonLdNodes() {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      const parsed = parseJson(el.textContent);
      if (!parsed) return;
      const top = asArray(parsed);
      top.forEach((item) => {
        if (item?.["@graph"]) nodes.push(...asArray(item["@graph"]));
        else nodes.push(item);
      });
    });
    return nodes;
  }

  function isType(node, type) {
    const t = node?.["@type"];
    return t === type || (Array.isArray(t) && t.includes(type));
  }

  function offerPrice(product) {
    const offer = asArray(product?.offers)[0] || product?.offers;
    const raw = offer?.price ?? offer?.lowPrice ?? product?.price;
    return parsePrice(raw);
  }

  function meta(prop) {
    return (
      document.querySelector(`meta[property="${prop}"]`)?.content ||
      document.querySelector(`meta[name="${prop}"]`)?.content ||
      ""
    ).trim();
  }

  function parsePrice(text) {
    const m =
      String(text || "").match(/\$\s*([\d,]+(?:\.\d{1,2})?)/) ||
      String(text || "").match(/\b([\d,]+(?:\.\d{2}))\b/) ||
      String(text || "").match(/^([\d,]+(?:\.\d{1,2})?)$/);
    if (!m) return 0;
    const n = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function isRecNode(node) {
    if (!node || node === document.body || node === document.documentElement) return false;
    const labeled = `${node.getAttribute?.("aria-label") || ""} ${node.className || ""} ${node.id || ""}`;
    if (REC_COPY.test(labeled)) return true;
    const heading = node.querySelector?.("h2, h3");
    if (heading && REC_COPY.test(heading.textContent || "")) return true;
    return Boolean(
      node.closest?.(
        "[class*='recommendation'], [class*='complete-the-look'], [class*='recently-viewed'], [data-recommendation]"
      )
    );
  }

  function recHeading() {
    return [...document.querySelectorAll("h2, h3, h4, [class*='title']")].find((n) =>
      REC_COPY.test(n.textContent || "")
    );
  }

  function isMainColumn(node) {
    if (!node || isRecNode(node)) return false;
    const rec = recHeading();
    if (!rec) return true;
    return Boolean(rec.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING);
  }

  function pdpRoot() {
    const h1 = document.querySelector("main h1, h1");
    if (!h1) return document.querySelector("main") || document.body;
    const col =
      h1.closest(
        ".product-detail, .pdp, [class*='product-detail'], [class*='ProductDetail'], [class*='pdp-'], [data-product-detail], article, main"
      ) || h1.parentElement;
    return col && !isRecNode(col) ? col : h1.parentElement || document.body;
  }

  function clip(text, n) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n);
  }

  function pageFacts() {
    const root = pdpRoot();
    const clone = root.cloneNode(true);
    clone.querySelectorAll("#yom-root, .yom-pdp-note, .yom-cart-panel, .yom-ui, .yom-ask, .yom-panel").forEach((n) => n.remove());
    const reviews = [];
    clone
      .querySelectorAll(
        "[itemprop='reviewBody'], [class*='review-text'], [class*='review__body'], [class*='ReviewContent'], [data-review], [class*='yotpo'] p"
      )
      .forEach((n) => {
        if (isRecNode(n)) return;
        const t = clip(n.textContent, 180);
        if (t.length > 36 && !/write a review|star rating|be the first|regret|look into/i.test(t)) reviews.push(t);
      });
    const blob = clip(clone.innerText, 5000);
    const ship =
      (blob.match(/\b((?:free (?:standard |express )?shipping|ships? (?:in|within) [^.]{0,50}|arrives? (?:in|within) [^.]{0,50}|deliver(?:y|s) in [^.]{0,50}|\d\s*[-–]\s*\d\s*(?:business\s*)?days)[^.!?]{0,40})/i) ||
        [])[1] || "";
    const sizeNote =
      (blob.match(/((?:true to size|runs? (?:small|large|big|long|short)|size up|size down|fits (?:true|small|large))[^.!?]{0,90})/i) ||
        [])[1] || "";
    return {
      reviews: reviews.slice(0, 4).join(" · "),
      shipping: /regret|look into|checking this|whether you/i.test(ship) ? "" : clip(ship, 180),
      sizeNote: clip(sizeNote, 180),
    };
  }

  function jsonLdProduct() {
    const products = jsonLdNodes().filter((n) => isType(n, "Product"));
    if (!products.length) return null;
    const h1 = (document.querySelector("h1")?.textContent || "").trim().toLowerCase();
    const path = location.pathname.toLowerCase();
    let best = products[0];
    let bestScore = -1;
    products.forEach((p) => {
      const name = String(p.name || "").toLowerCase();
      const sku = String(p.sku || p.mpn || "");
      const url = String(p.url || "");
      let score = 0;
      if (h1 && (name === h1 || name.includes(h1) || h1.includes(name))) score += 6;
      if (sku && path.includes(sku.toLowerCase())) score += 8;
      try {
        if (url && path.includes(new URL(url, location.origin).pathname.toLowerCase())) score += 4;
      } catch {
        /* ignore bad url */
      }
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    });
    return best;
  }

  function priceIn(root, product) {
    const fromLd = offerPrice(product);
    if (fromLd > 0) return fromLd;
    const og = parsePrice(meta("product:price:amount"));
    if (og > 0) return og;
    const scoped = [
      ...(root?.querySelectorAll?.(
        "[itemprop='price'], .price--formated, .price__sales .value, .sales .value, [data-product-component='price']"
      ) || []),
    ].filter((n) => isMainColumn(n));
    for (const el of scoped) {
      if (/payments of|klarna|afterpay|affirm/i.test(el.textContent || "")) continue;
      const n = parsePrice(el.getAttribute("content") || el.textContent);
      if (n >= 5 && n < 20000) return n;
    }
    const h1 = root?.querySelector?.("h1") || document.querySelector("h1");
    if (h1) {
      let el = h1.nextElementSibling;
      for (let i = 0; i < 12 && el; i++) {
        if (REC_COPY.test(el.textContent || "") || isRecNode(el)) break;
        if (/payments of|klarna|afterpay/i.test(el.textContent || "")) {
          el = el.nextElementSibling;
          continue;
        }
        const n = parsePrice(el.textContent);
        if (n >= 5 && n < 20000) return n;
        el = el.nextElementSibling;
      }
    }
    return 0;
  }

  function looksLikeShop() {
    if (jsonLdProduct()) return true;
    if (/product/i.test(meta("og:type"))) return true;
    if (/\/(product|products|p|dp|item|shop|clothing|collections|c)\b/i.test(location.pathname)) {
      return true;
    }
    const add = [...document.querySelectorAll("button, a, input")].some((n) =>
      /add to (bag|cart)/i.test(`${n.textContent || ""} ${n.value || ""}`)
    );
    if (add) return true;
    return findTiles().length >= 4;
  }

  function skipHost(hostname) {
    return SKIP_HOST.test(hostname);
  }

  function isPdp() {
    if (/\/products?\//i.test(location.pathname)) return true;
    if (/\/(p|dp|item)\//i.test(location.pathname) && jsonLdProduct()) return true;
    if (jsonLdProduct() && document.querySelector("h1")) return true;
    if (/product/i.test(meta("og:type")) && document.querySelector("h1")) return true;
    return false;
  }

  function isCart() {
    return /\/(cart|bag|basket|checkout)(\/|$)/i.test(location.pathname);
  }

  function pdpInfo() {
    const root = pdpRoot();
    const product = jsonLdProduct();
    const name = (
      product?.name ||
      root.querySelector("h1")?.textContent ||
      document.querySelector("h1")?.textContent ||
      meta("og:title") ||
      document.title.split("|")[0]
    )
      .replace(/\s+/g, " ")
      .trim();
    const colorEl = [...root.querySelectorAll(".selected, [aria-checked='true'], [aria-pressed='true'], [data-attr-value].selected")].find(
      (n) =>
        isMainColumn(n) &&
        /color|swatch|stripe/i.test(
          `${n.className} ${n.getAttribute("aria-label") || ""} ${n.getAttribute("data-attr") || ""}`
        )
    );
    const color = (
      product?.color ||
      colorEl?.getAttribute("aria-label") ||
      colorEl?.getAttribute("data-attr-value") ||
      colorEl?.textContent ||
      root.querySelector(".product-attribute--color .selected, [data-attr='color'] .selected")?.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .replace(/^color:\s*/i, "")
      .trim();
    const desc = (
      product?.description ||
      [...root.querySelectorAll("p")].map((p) => p.textContent.trim()).find((t) => t.length > 40 && t.length < 400) ||
      meta("og:description") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    const img =
      root.querySelector(".product-detail img, [class*='pdp'] img, picture img") ||
      document.querySelector("meta[property='og:image']");
    const image = img?.currentSrc || img?.src || img?.content || "";
    return {
      name,
      price: priceIn(root, product),
      color,
      description: desc,
      href: location.href,
      image,
      alt: name,
      id: product?.sku || product?.mpn || "",
      category: (product?.category || location.pathname).toString().toLowerCase(),
      text: `${name} ${color} ${desc} ${location.pathname}`,
    };
  }

  function findTiles() {
    const specific = [
      ...document.querySelectorAll(
        [
          "[data-product-tile-wrapper]",
          "[data-product-tile]",
          ".product-tile-wrapper",
          ".product-tile",
          ".product-grid__item",
          ".product-card",
          ".product-item",
          ".product-grid-item",
          ".ProductItem",
          ".grid-product",
          "[data-product-id]",
        ].join(",")
      ),
    ].filter((n) => !n.closest("#yom-root, .yom-pdp-note") && n.querySelector("img"));
    if (specific.length >= 2) return specific.slice(0, 80);

    const links = [
      ...document.querySelectorAll(
        "a[href*='/products/'], a[href*='/product/'], a[href*='/p/'], a[href*='/dp/'], a[href*='/item/']"
      ),
    ];
    const seen = new Set();
    const cards = [];
    links.forEach((a) => {
      const card = a.closest("li, article, [class*='product'], [class*='card'], [class*='tile']") || a.parentElement;
      if (!card || seen.has(card) || card.closest("#yom-root")) return;
      if (!card.querySelector("img")) return;
      seen.add(card);
      cards.push(card);
    });
    return cards.slice(0, 80);
  }

  function tileInfo(tile) {
    const root = tile;
    const priceEl =
      root.querySelector("[itemprop='price']") ||
      root.querySelector(".price--formated, .price__sales .value, [data-product-component='price']");
    const href =
      root.querySelector("a[href*='/products/']")?.href ||
      root.querySelector("a[href*='/product/']")?.href ||
      root.querySelector("a[href*='/p/']")?.href ||
      root.querySelector("a")?.href ||
      "";
    const name = (
      root.querySelector('[data-product-component="name"]')?.textContent ||
      root.querySelector("h2, h3, [class*='title'], [class*='name'], [class*='Title']")?.textContent ||
      root.querySelector("img")?.alt ||
      root.querySelector("a")?.getAttribute("aria-label") ||
      root.querySelector("a")?.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .replace(/quick\s*view/gi, "")
      .replace(/add to (bag|cart)/gi, "")
      .replace(/\$[\d.,]+/g, "")
      .trim()
      .slice(0, 120);
    const price = parsePrice(priceEl?.getAttribute("content") || priceEl?.textContent || root.textContent);
    return {
      root,
      name,
      color: "",
      price,
      id: root.getAttribute("data-pid") || root.getAttribute("data-product-id") || href || name,
      href,
      category: href.toLowerCase(),
      text: `${name} ${href}`,
    };
  }

  return {
    looksLikeShop,
    skipHost,
    isPdp,
    isCart,
    pdpInfo,
    pdpRoot,
    pageFacts,
    findTiles,
    tileInfo,
    jsonLdProduct,
    parsePrice,
    isRecNode,
  };
})();
