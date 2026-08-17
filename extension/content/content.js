(() => {
  if (window.__YOM_BUILD__ === "1.1.32") return;
  window.__YOM_BUILD__ = "1.1.32";
  window.__YOM_LOADED__ = true;
  document.getElementById("yom-root")?.remove();

  const DATA = window.YOM_DEMO;
  const EXTRACT = window.YOM_EXTRACT;
  const Sites = window.YOM_SITES;
  const pageHost = location.hostname;
  if (
    Sites?.isSkippedHost?.(pageHost) ||
    EXTRACT?.skipHost?.(pageHost) ||
    !Sites?.isAllowedHost?.(pageHost)
  ) {
    return;
  }
  const USER_KEY = "yom-user";
  const STORAGE_KEY = "yom-companion-v4";
  const PROFILE_KEY = "yom-profile";
  const LIVE_KEY = "yom-session";
  const PAUSE_MS = 400;
  const GREEN_WORDS =
    /\b(green|emerald|forest|jade|moss|olive|sage|evergreen|tarragon|fern|kelly|pistachio)\b/i;
  const SHOE_WORDS = /\b(shoe|heel|sandal|boot|mule|pump|loafer|sneaker|slingback|flat|flats|slide|slides|thong|espadrille|ballet)\b/i;

  const defaultState = () => ({
    mode: null, // browse | purpose | sos | gift
    purpose: null,
    budget: null,
    spent: 0,
    cartNames: [],
    saved: [],
    insightN: 0,
    checked: {},
    checking: false,
    panelOpen: false,
    budgetAsked: false,
    stamps: {},
    checkedOut: false,
    userId: null,
    trait: null,
    preBuy: null,
    keepLean: null,
    read: null,
    learned: { notes: [], brands: {}, likes: [] },
  });

  const PROFILE_FIELDS = [
    "mode",
    "purpose",
    "budget",
    "spent",
    "cartNames",
    "saved",
    "insightN",
    "checked",
    "budgetAsked",
    "checkedOut",
    "learned",
  ];
  const USER_FIELDS = ["userId", "trait", "preBuy", "keepLean", "read"];

  let state = defaultState();
  let liveAccount = null;
  let hoverTimer = null;
  let hoverTile = null;
  let whisperEl = null;
  let whisperTimer = null;
  let askEl = null;
  let clickCount = 0;
  let clickTimer = null;
  let spokenKey = null;
  let lastAddAt = 0;
  let noteTimers = new Map();
  let sosKey = null;
  let sosMin = false;

  function profileSlice(s) {
    const out = {};
    PROFILE_FIELDS.forEach((k) => {
      out[k] = s[k];
    });
    return out;
  }

  function userSlice(s) {
    const out = {};
    USER_FIELDS.forEach((k) => {
      out[k] = s[k];
    });
    return out;
  }

  function newUserId() {
    return crypto.randomUUID?.() || `yom-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function composeRead(trait, preBuy, keepLean) {
    const persona = DATA.persona || {};
    const reads = persona.reads || {};
    const combo = persona.combos?.[`${trait}:${preBuy}`];
    const core = combo || [reads[trait], reads[preBuy]].filter(Boolean).join(" ");
    return [core, reads[keepLean]].filter(Boolean).join(" ");
  }

  function hashedPersona() {
    const n = hashStr(state.userId || "yom");
    const traits = DATA.persona.traits;
    const pre = DATA.persona.preBuy;
    const keep = DATA.persona.keep;
    return {
      trait: traits[n % traits.length].id,
      preBuy: pre[Math.floor(n / 4) % pre.length].id,
      keepLean: keep[Math.floor(n / 16) % keep.length].id,
    };
  }

  function applyPersona(trait, preBuy, keepLean) {
    state.trait = trait;
    state.preBuy = preBuy;
    state.keepLean = keepLean;
    state.read = composeRead(trait, preBuy, keepLean);
    saveState();
    closeAsk();
    dockBuddy(true);
    render();
    whisper({ title: (state.read || "this is you").split(/[.!?]/)[0] }, 4200);
  }

  function hasPersona() {
    return Boolean(state.trait && state.read);
  }

  function demoPersona() {
    return DATA.persona?.demo || null;
  }

  function sizeMap(sizes) {
    if (!sizes) return {};
    if (!Array.isArray(sizes) && sizes.us) return sizes;
    const map = { ...(sizes.us || sizes.denim || sizes.shoes ? sizes : {}) };
    const list = Array.isArray(sizes) ? sizes : sizes.display || [];
    for (const row of list) {
      const label = String(row.label || "");
      if (/dress|top|usual/i.test(label)) map.us = row.value;
      else if (/denim/i.test(label)) map.denim = row.value;
      else if (/shoe/i.test(label)) map.shoes = row.value;
    }
    return map;
  }

  function livePersona() {
    const profile = liveAccount?.profile;
    if (!profile?.id && !profile?.userId) return null;
    return {
      userId: profile.userId || profile.id,
      trait: profile.trait,
      preBuy: profile.preBuy,
      keepLean: profile.keepLean,
      read: profile.read || composeRead(profile.trait, profile.preBuy, profile.keepLean),
      memory: profile.memory || "",
      sizes: sizeMap(profile.sizeMap || profile.sizes),
    };
  }

  function applyLivePersona() {
    const live = livePersona();
    if (!live) return false;
    state.userId = live.userId;
    if (live.trait) state.trait = live.trait;
    if (live.preBuy) state.preBuy = live.preBuy;
    if (live.keepLean) state.keepLean = live.keepLean;
    if (live.read) state.read = live.read;
    if (live.userId && live.userId !== "yom-ban") {
      try {
        chrome.runtime.sendMessage({
          type: "YOM_IDENTIFY",
          userId: live.userId,
          traits: {
            email: liveAccount?.user?.email || liveAccount?.profile?.email,
            name: live.name || liveAccount?.profile?.name,
          },
        });
      } catch {
        /* ignore */
      }
    }
    const remote = liveAccount?.profile?.saved;
    if (Array.isArray(remote)) {
      state.saved = state.saved || [];
      const have = new Set(state.saved.map((item) => item.href || item.name));
      for (const item of remote) {
        const name = item.name || item.item;
        const key = item.href || name;
        if (!key || have.has(key)) continue;
        state.saved.push({
          name,
          href: item.href || "",
          price: item.price || 0,
          at: Date.parse(item.at) || Date.now(),
        });
        have.add(key);
      }
    }
    return true;
  }

  async function loadLiveAccount() {
    try {
      const stored = await chrome.storage.local.get(LIVE_KEY);
      liveAccount = stored[LIVE_KEY] || null;
    } catch {
      liveAccount = null;
    }
  }

  function activePersona() {
    const live = livePersona();
    if (live) return live;
    const demo = demoPersona();
    if (demo) {
      return {
        userId: demo.userId || "yom-ban",
        trait: demo.trait,
        preBuy: demo.preBuy,
        keepLean: demo.keepLean,
        read: demo.read || composeRead(demo.trait, demo.preBuy, demo.keepLean),
        memory: demo.memory || "",
        sizes: demo.sizes || {},
      };
    }
    return {
      userId: state.userId,
      trait: state.trait,
      preBuy: state.preBuy,
      keepLean: state.keepLean,
      read: state.read,
      memory: "",
      sizes: {},
    };
  }

  async function loadState() {
    let migrated = {};
    let stamps = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) migrated = JSON.parse(raw);
      const stampRaw = localStorage.getItem(`${STORAGE_KEY}-stamps`);
      if (stampRaw) stamps = JSON.parse(stampRaw);
      else if (migrated.stamps) stamps = migrated.stamps;
    } catch {
      migrated = {};
    }
    const stored = await chrome.storage.local.get([PROFILE_KEY, USER_KEY]);
    const user = stored[USER_KEY] || {};
    const next = {
      ...defaultState(),
      ...migrated,
      ...(stored[PROFILE_KEY] || {}),
      ...user,
      stamps,
      panelOpen: false,
    };
    if (!next.userId) {
      next.userId = newUserId();
      chrome.storage.local.set({ [USER_KEY]: userSlice(next) });
    }
    return next;
  }

  function saveState() {
    try {
      localStorage.setItem(`${STORAGE_KEY}-stamps`, JSON.stringify(state.stamps || {}));
    } catch {
      /* ignore quota */
    }
    chrome.storage.local.set({
      [PROFILE_KEY]: profileSlice(state),
      [USER_KEY]: userSlice(state),
    });
  }

  function resetState() {
    const user = userSlice(state);
    state = { ...defaultState(), ...user, userId: user.userId || newUserId() };
    chrome.storage.local.remove(PROFILE_KEY);
    saveState();
    spokenKey = null;
    closeAsk();
    clearWhisper();
    clearAllMarks();
    clearPdp();
    document.querySelector("#yom-cart-panel")?.remove();
    dockBuddy(true);
    render();
  }

  function isDemoSite() {
    return /(^|\.)thereformation\.com$/i.test(location.hostname);
  }

  async function shouldRun() {
    const host = location.hostname;
    if (Sites?.isSkippedHost?.(host) || EXTRACT.skipHost(host)) return false;
    if (Sites?.isAllowedHost?.(host)) return true;
    return false;
  }

  function asset(file) {
    return chrome.runtime.getURL(`assets/${file}`);
  }

  function isPdp() {
    if (isDemoSite()) return /\/products\//.test(location.pathname);
    return EXTRACT?.isPdp?.() || /\/products?\//i.test(location.pathname);
  }

  function isCart() {
    if (isDemoSite()) return /^\/cart\/?$/.test(location.pathname);
    return EXTRACT?.isCart?.() || /\/(cart|bag)(\/|$)/i.test(location.pathname);
  }

  function findTiles() {
    const seen = new Set();
    const picked = [];
    const add = (node) => {
      if (!node || seen.has(node) || node.closest?.("#yom-root")) return;
      const host = tileHost(node);
      if (!host || seen.has(host) || host.closest("#yom-root")) return;
      seen.add(host);
      picked.push(host);
    };
    document
      .querySelectorAll(
        "[data-product-tile-wrapper], [data-product-tile], .product-tile, .product-grid__item"
      )
      .forEach(add);
    if (picked.length) return picked.slice(0, 80);
    document.querySelectorAll("a[href*='/products/'], a[href*='/product/']").forEach((a) => {
      add(a.closest(".product-grid__item, li, article") || a.parentElement || a);
    });
    return picked.slice(0, 80);
  }

  function tileHost(node) {
    if (!node?.closest) return node;
    return (
      node.closest("[data-product-tile-wrapper]") ||
      node.closest(".product-tile-wrapper") ||
      node.closest("[data-product-tile]") ||
      node.closest(".product-tile") ||
      node.closest(".product-grid__item") ||
      node.closest(".yom-tile-host") ||
      node
    );
  }

  function cardFromNode(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    if (!el?.closest) return null;
    if (
      el.closest(
        "#yom-root, #yom-notes-layer, .yom-tile-note, .yom-pdp-note, .yom-cart-panel, .yom-ask, .yom-panel"
      )
    ) {
      return null;
    }
    return (
      el.closest("[data-product-tile-wrapper]") ||
      el.closest(".product-tile-wrapper") ||
      el.closest("[data-product-tile]") ||
      el.closest(".product-tile") ||
      el.closest(".product-grid__item") ||
      el.closest(".product-card") ||
      el.closest(".product-item") ||
      el.closest("[data-product-id]") ||
      el.closest("a[href*='/products/']") ||
      el.closest("a[href*='/product/']") ||
      null
    );
  }

  function cardAtEvent(e) {
    const direct = cardFromNode(e.target);
    if (direct) return direct;
    const x = e.clientX;
    const y = e.clientY;
    if (typeof x !== "number" || typeof document.elementsFromPoint !== "function") return null;
    const stack = document.elementsFromPoint(x, y) || [];
    for (let i = 0; i < stack.length; i += 1) {
      const card = cardFromNode(stack[i]);
      if (card) return card;
    }
    return null;
  }

  function el(tag, attrs = {}, html = "") {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    });
    if (html) node.innerHTML = html;
    return node;
  }

  const YOM_UI =
    "#yom-root, .yom-pdp-note, .yom-cart-panel, .yom-ask, .yom-panel, .yom-fb, .yom-tile-note, .yom-chip, .yom-fb-chip, .yom-fb-btn, .yom-sos-toggle, .yom-buddy, .yom-mode-pill";

  function onTap(node, fn) {
    if (!node || typeof fn !== "function") return node;
    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    };
    node.addEventListener("click", go, true);
    node.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
    node.addEventListener("mousedown", (e) => e.stopPropagation(), true);
    return node;
  }

  function formatRegretLabel(n) {
    const tone = regretTone(n);
    if (tone === "keep") return "keep";
    if (tone === "ok") return "ok";
    return "return";
  }

  function parseTracking(node) {
    const anchor =
      (node.hasAttribute?.("data-aggregate") || node.hasAttribute?.("data-tracking")
        ? node
        : null) ||
      node.querySelector?.("[data-aggregate], [data-tracking], [data-product-tile]") ||
      node.closest?.("[data-aggregate], [data-tracking], [data-product-tile]");
    const raw =
      anchor?.getAttribute("data-aggregate") ||
      anchor?.getAttribute("data-tracking") ||
      "";
    if (!raw) return null;
    try {
      return JSON.parse(raw.replace(/&quot;/g, '"'));
    } catch {
      return null;
    }
  }

  function cleanProductName(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/quick\s*view/gi, "")
      .replace(/add to (bag|cart)/gi, "")
      .replace(/\|\s*reformation/gi, "")
      .replace(/\$[\d.,]+/g, "")
      .trim();
  }

  function firstText(node, selectors) {
    for (const sel of selectors) {
      const hit = node.querySelector(sel);
      const text = cleanProductName(hit?.textContent || hit?.getAttribute?.("content") || "");
      if (text && text.length > 2) return text;
    }
    return "";
  }

  function tileHref(node) {
    const a =
      node.querySelector("a[href*='/products/']") ||
      node.querySelector("a[href*='/product/']") ||
      node.querySelector("a[href*='/p/']") ||
      node.querySelector("a[href]");
    return a?.href || "";
  }

  function tileImage(node) {
    const img =
      node.querySelector("img[src], img[data-src], img[srcset]") ||
      node.querySelector("img");
    const src =
      img?.currentSrc ||
      img?.src ||
      img?.getAttribute("data-src") ||
      (img?.getAttribute("srcset") || "").split(" ")[0] ||
      "";
    const alt = cleanProductName(img?.alt || img?.getAttribute("aria-label") || "");
    return { src, alt };
  }

  function tileInfo(tile) {
    const host = tileHost(tile);
    const tracking = parseTracking(host);
    const product =
      tracking?.trackObject?.ecommerce?.click?.products?.[0] ||
      tracking?.ecommerce?.click?.products?.[0] ||
      tracking?.ecommerce?.items?.[0] ||
      null;
    const img = tileImage(host);
    const generic = EXTRACT?.tileInfo?.(host) || {};
    const name = cleanProductName(
      firstText(host, [
        '[data-product-component="name"]',
        ".product-tile__name",
        ".product-name",
        "[itemprop='name']",
        "h2",
        "h3",
      ]) ||
        product?.name ||
        img.alt ||
        generic.name ||
        host.getAttribute("aria-label") ||
        ""
    );
    const color = cleanProductName(
      product?.dimension1 ||
        product?.variant ||
        product?.item_variant ||
        firstText(host, [
          ".product-attribute--color .selected",
          "[data-attr='color']",
          ".swatch.selected",
          "[class*='color'] .selected",
        ]) ||
        generic.color ||
        ""
    );
    const priceRaw =
      product?.price ||
      product?.item_price ||
      host.querySelector("[itemprop='price']")?.getAttribute("content") ||
      host.querySelector(
        ".price--formated, .price__sales .value, [data-product-component='price'], .price .value, .price"
      )?.textContent ||
      "";
    const price =
      (EXTRACT?.parsePrice ? EXTRACT.parsePrice(priceRaw) : 0) ||
      Number(product?.price) ||
      (EXTRACT?.parsePrice ? EXTRACT.parsePrice(host.innerText?.slice(0, 180) || "") : 0) ||
      generic.price ||
      0;
    const href = tileHref(host) || generic.href || "";
    const id = String(
      product?.id ||
        product?.item_id ||
        host.getAttribute("data-pid") ||
        host.querySelector("[data-pid]")?.getAttribute("data-pid") ||
        host.getAttribute("data-product-id") ||
        generic.id ||
        href ||
        name
    );
    const category = (
      product?.category ||
      product?.item_category ||
      generic.category ||
      href ||
      ""
    ).toLowerCase();
    return {
      root: host,
      name,
      color,
      price: Number.isFinite(price) ? price : 0,
      id,
      href,
      image: img.src,
      alt: img.alt,
      category,
      text: `${name} ${color} ${category} ${img.alt}`,
    };
  }

  function pdpInfo() {
    const info = EXTRACT.pdpInfo();
    const root = EXTRACT.pdpRoot?.() || document.querySelector("main") || document.body;
    const color =
      info.color ||
      cleanProductName(
        root.querySelector(
          ".product-attribute--color .selected, .color-value.selected, [data-attr='color'] .selected, [aria-checked='true']"
        )?.getAttribute("aria-label") ||
          root.querySelector(
            ".product-attribute--color .selected, .color-value.selected, [data-attr='color'] .selected"
          )?.textContent ||
          ""
      );
    return {
      ...info,
      color,
      href: info.href || location.href,
      alt: info.alt || info.name,
      text: `${info.name} ${color} ${info.description || ""} ${location.pathname}`,
    };
  }

  function isGreenProduct(info) {
    return GREEN_WORDS.test(info.text || "") || GREEN_WORDS.test(info.color || "");
  }

  function isDress(info) {
    return /dress/i.test(info.name || "") || /dress/i.test(info.category || "") || /dress/i.test(info.href || "");
  }

  function isShoeProduct(info) {
    return (
      SHOE_WORDS.test(info.name || "") ||
      /shoe/i.test(info.category || "") ||
      /\/shoes\//i.test(info.href || location.pathname)
    );
  }

  function remainingBudget() {
    if (state.budget == null) return Infinity;
    return Math.max(0, state.budget - state.spent);
  }

  function hashStr(s) {
    let h = 0;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function isGift() {
    return state.mode === "gift";
  }

  function purposeMeta() {
    if (state.mode !== "purpose" || !state.purpose) return null;
    const ev = DATA.events.find((e) => e.label === state.purpose);
    if (ev) return ev;
    if (/work/i.test(state.purpose)) return { label: state.purpose, ...DATA.purposeFallback.work };
    if (/date/i.test(state.purpose)) return { label: state.purpose, ...DATA.purposeFallback.date };
    return { label: state.purpose, ...DATA.purposeFallback.generic };
  }

  function occasionMatch(info) {
    const ev = purposeMeta();
    if (!ev) return false;
    if (ev.kind === "wedding") return isDress(info) || isGreenProduct(info);
    if (ev.kind === "trip") return !isShoeProduct(info);
    if (ev.kind === "work") return /blazer|trouser|pant|dress|shirt|knit|jacket|skirt/i.test(info.text || info.name || "");
    if (ev.kind === "date") return isDress(info) || /top|skirt|heel|dress/i.test(info.text || info.name || "");
    return isDress(info);
  }

  function pairingMatch(info) {
    if (isGift() || isDress(info) || isShoeProduct(info) || isGreenProduct(info)) return false;
    return /top|knit|sweater|shirt|blouse|tee|cardigan|jacket/i.test(`${info.name} ${info.category}`);
  }

  function welcomeTip() {
    const ev = purposeMeta();
    if (ev) {
      return {
        title: `for ${ev.label}`,
        body:
          state.budget == null
            ? "no budget for now — I’ll mark what matters for this."
            : `keeping an eye on $${state.budget}.`,
      };
    }
    if (state.mode === "sos") {
      return DATA.tips.sos;
    }
    if (isGift()) {
      return {
        title: "shopping for someone else",
        body: state.budget == null ? "i’ll stick to reviews and timing." : `watching $${state.budget}.`,
      };
    }
    if (state.budget != null) {
      return {
        title: "i’ll stay out of the way",
        body: `watching $${state.budget} — I’ll only mark what would go over.`,
      };
    }
    return DATA.tips.welcome;
  }

  function mediaHost(tile) {
    const candidates = [
      tile.querySelector(".product-tile__media-container"),
      tile.querySelector(".product-tile__media"),
      tile.querySelector("[class*='media-container']"),
    ].filter(Boolean);
    for (let i = 0; i < candidates.length; i += 1) {
      const node = candidates[i];
      if (node && !/^(IMG|PICTURE|SOURCE|VIDEO)$/.test(node.tagName)) return node;
    }
    const img = tile.querySelector("img, picture");
    const parent = img?.parentElement;
    if (parent && parent !== tile && !/^(IMG|PICTURE)$/.test(parent.tagName)) return parent;
    return tile;
  }

  // ── shell ────────────────────────────────────────────────────
  let armed = false;
  const host = document.createElement("div");
  host.id = "yom-root";
  host.setAttribute("data-yom-host", "1");
  host.style.cssText =
    "position:fixed;inset:0;width:auto;height:auto;z-index:2147483647;pointer-events:none;overflow:visible;background:transparent;";

  const shadow = host.attachShadow({ mode: "open" });
  const shadowCss = document.createElement("style");
  shadowCss.textContent = `
    :host { display: block; position: fixed; inset: 0; width: auto; height: auto; overflow: visible; z-index: 2147483647; pointer-events: none; }
    .yom-buddy {
      position: fixed !important;
      right: 20px !important;
      bottom: 20px !important;
      left: auto !important;
      top: auto !important;
      width: 64px !important;
      height: 64px !important;
      border: 2px solid #111 !important;
      border-radius: 50% !important;
      background: #c8f060 !important;
      padding: 8px !important;
      pointer-events: auto !important;
      cursor: pointer !important;
      z-index: 2147483647 !important;
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
      box-shadow: 2px 3px 0 #111 !important;
    }
    .yom-buddy img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
    .yom-ask, .yom-panel, .yom-whisper, .yom-mode-pill { pointer-events: auto; }
    .yom-mode-pill { cursor: pointer !important; }
    .yom-marks { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
    .yom-stamp {
      position: fixed !important;
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      width: max-content;
      background: #c8f060;
      border: 1px solid #111;
      border-radius: 999px;
      padding: 3px 8px;
      font: 700 11px/1.2 Schibsted Grotesk, Helvetica Neue, sans-serif;
      color: #111;
      pointer-events: none;
      box-shadow: 1px 2px 0 #111;
      white-space: nowrap;
    }
    .yom-stamp.warn { background: #f3d27a; }
    .yom-stamp.neutral { background: #fff; }
    .yom-tile-note {
      position: fixed;
      z-index: 2147483646;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      max-width: 300px;
      background: #fff;
      border: 1.5px solid #111;
      border-radius: 12px;
      padding: 8px 10px;
      color: #111;
      font: 500 13px/1.3 Schibsted Grotesk, Helvetica Neue, sans-serif;
      pointer-events: auto !important;
      box-shadow: 2px 3px 0 #111;
    }
    .yom-tile-note strong { display: block; font-size: 13px; }
    .yom-tile-note span { display: block; font-size: 12px; color: #5a5a5a; }
    .yom-tile-note img { width: 40px; height: 50px; object-fit: cover; border-radius: 6px; }
    .yom-fb {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      pointer-events: auto !important;
    }
    .yom-tile-note .yom-fb { flex: 1 0 100%; margin-top: 2px; }
    .yom-fb-btn {
      appearance: none;
      border: 0;
      background: none;
      padding: 4px 2px;
      margin: 0;
      font: 600 11px/1.2 Schibsted Grotesk, Helvetica Neue, sans-serif;
      color: #5a5a5a;
      cursor: pointer;
      pointer-events: auto !important;
    }
    .yom-fb-btn:hover { color: #111; }
    .yom-fb-ok { color: #3d5a00; }
    .yom-fb-no { color: #7a3a3a; }
    .yom-fb-dot { color: #bbb; font-size: 11px; }
    .yom-fb-ask {
      flex: 1 0 100%;
      margin: 0;
      font: 600 12px/1.3 Schibsted Grotesk, Helvetica Neue, sans-serif;
      color: #111;
    }
    .yom-fb-input {
      width: 72px;
      border: 1px solid #111;
      border-radius: 8px;
      padding: 4px 6px;
      font: 600 12px Schibsted Grotesk, Helvetica Neue, sans-serif;
      pointer-events: auto !important;
    }
    .yom-fb-done { font: 600 11px/1.2 Schibsted Grotesk, Helvetica Neue, sans-serif; color: #5a5a5a; }
    .yom-fb-chip {
      appearance: none;
      border: 1px solid #111;
      background: #fff;
      border-radius: 999px;
      padding: 3px 8px;
      font: 600 11px/1.2 Schibsted Grotesk, Helvetica Neue, sans-serif;
      cursor: pointer;
      color: #111;
      pointer-events: auto !important;
    }
    .yom-fb-chip:hover { background: #c8f060; }
    .yom-chip, .yom-sos-toggle, .yom-panel button, .yom-ask button {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    .yom-dim {
      position: fixed;
      z-index: 2147483645;
      background: rgba(255,255,255,0.55);
      pointer-events: none;
    }
    .yom-sos-sheet {
      width: min(320px, calc(100vw - 1.5rem)) !important;
      max-height: min(72vh, 560px);
      overflow: auto;
    }
    .yom-sos-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .yom-sos-toggle {
      appearance: none !important;
      border: 1px solid #111 !important;
      background: #fff !important;
      border-radius: 999px !important;
      font: 600 11px/1 Schibsted Grotesk, sans-serif !important;
      padding: 3px 8px !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      color: #111 !important;
    }
    .yom-sos-sheet.min {
      width: min(220px, calc(100vw - 1.5rem)) !important;
      max-height: none !important;
      overflow: hidden !important;
      padding: 10px 12px !important;
    }
    .yom-sos-sheet.min .yom-sos-body,
    .yom-sos-sheet.min .yom-chips,
    .yom-sos-sheet.min .yom-fb { display: none !important; }
    .yom-sos-sheet.min h3 { font-size: 12px !important; margin: 0 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .yom-facts { display: grid; gap: 6px; margin: 8px 0; }
    .yom-fact em {
      display: block;
      font-style: normal;
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5a5a5a;
    }
    .yom-fact span { display: block; font-size: 12px; line-height: 1.35; }
    .yom-regret {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      padding: 8px;
      border: 1px solid #111;
      border-radius: 12px;
      background: #fff;
    }
    .yom-regret.keep { background: #e8f7b0; }
    .yom-regret.ok { background: #f7ebc0; }
    .yom-regret.return { background: #f3d0d0; }
    .yom-keep-bar {
      width: 120px;
      height: 6px;
      margin-top: 4px;
      background: #eee;
      border-radius: 99px;
      overflow: hidden;
    }
    .yom-keep-bar > span { display: block; height: 100%; background: #f3d27a; }
    .yom-regret.keep .yom-keep-bar > span { background: #3d5a00; }
    .yom-keep-score { font-size: 22px; font-weight: 700; }
    .yom-sos-resolve { font-size: 12px !important; color: #111 !important; }
  `;
  shadow.appendChild(shadowCss);

  fetch(chrome.runtime.getURL("content/overlay.css"))
    .then((r) => r.text())
    .then((css) => {
      const extra = document.createElement("style");
      extra.textContent = css;
      shadow.appendChild(extra);
    })
    .catch(() => {});

  const root = document.createElement("div");
  root.className = "yom-shell";
  shadow.appendChild(root);
  const marks = document.createElement("div");
  marks.className = "yom-marks";
  shadow.appendChild(marks);
  const stampEls = new Map();
  const dimEls = new Map();
  let liveNote = null;

  function mountHost() {
    if (!armed) return;
    const parent = document.body || document.documentElement;
    if (parent && host.parentElement !== parent) parent.appendChild(host);
  }

  if (!document.getElementById("yom-fonts")) {
    const link = document.createElement("link");
    link.id = "yom-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@500;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap";
    (document.head || document.documentElement).appendChild(link);
  }

  const buddy = el("button", {
    class: "yom-buddy docked",
    type: "button",
    "aria-label": "yom",
  });
  buddy.style.cssText =
    "position:fixed;right:20px;bottom:20px;width:64px;height:64px;border:2px solid #111;border-radius:50%;background:#c8f060;padding:8px;z-index:2147483647;pointer-events:auto;cursor:pointer;display:block;opacity:1;visibility:visible;box-shadow:2px 3px 0 #111";
  const buddyImg = document.createElement("img");
  buddyImg.alt = "";
  buddy.appendChild(buddyImg);
  root.appendChild(buddy);

  fetch(chrome.runtime.getURL("assets/yom-mark.png"))
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        })
    )
    .then((dataUrl) => {
      buddyImg.src = dataUrl;
    })
    .catch(() => {
      buddyImg.remove();
      buddy.textContent = "yom";
      buddy.style.font = "700 14px/64px Schibsted Grotesk, sans-serif";
      buddy.style.color = "#111";
    });

  const modePill = el("button", { class: "yom-mode-pill hidden", type: "button" });
  root.appendChild(modePill);

  const panel = el("div", { class: "yom-panel hidden" });
  root.appendChild(panel);

  function ensureMounted() {
    if (!armed) return;
    mountHost();
    host.style.display = "block";
    host.style.visibility = "visible";
    host.style.opacity = "1";
    buddy.style.display = "block";
    buddy.style.visibility = "visible";
    buddy.style.opacity = "1";
  }

  function dockBuddy(animatePop = false) {
    if (!armed) return;
    ensureMounted();
    buddy.style.left = "auto";
    buddy.style.top = "auto";
    buddy.style.right = "16px";
    buddy.style.bottom = "16px";
    buddy.classList.add("docked");
    if (animatePop) {
      buddy.classList.remove("pop");
      void buddy.offsetWidth;
      buddy.classList.add("pop");
    }
    positionCluster();
  }

  function pulseBuddy() {
    buddy.classList.remove("notice");
    void buddy.offsetWidth;
    buddy.classList.add("notice");
  }

  function positionCluster() {
    const gutter = 20;
    const buddySize = 64;

    if (!state.mode) {
      modePill.classList.add("hidden");
    } else {
      modePill.classList.remove("hidden");
      modePill.classList.toggle("purpose", state.mode === "purpose");
      const label =
        state.mode === "sos"
          ? "sos"
          : state.mode === "gift"
            ? "a gift"
            : state.mode === "browse"
              ? "browsing"
              : state.purpose || "an event";
      modePill.innerHTML = `<span class="dot"></span><span>${label}</span>`;
      modePill.style.left = "auto";
      modePill.style.top = "auto";
      modePill.style.right = `${gutter + buddySize + 8}px`;
      modePill.style.bottom = `${gutter + 10}px`;
    }

    if (whisperEl) {
      const askH = askEl ? Math.round(askEl.getBoundingClientRect().height) : 0;
      whisperEl.style.left = "auto";
      whisperEl.style.top = "auto";
      whisperEl.style.right = `${gutter}px`;
      whisperEl.style.bottom = `${gutter + buddySize + 12 + (askH ? askH + 8 : 0)}px`;
    }

    if (askEl) {
      askEl.style.left = "auto";
      askEl.style.top = "auto";
      askEl.style.right = `${gutter}px`;
      askEl.style.bottom = `${gutter + buddySize + 12}px`;
    }
  }

  function clearWhisper() {
    clearTimeout(whisperTimer);
    whisperEl?.remove();
    whisperEl = null;
  }

  function whisper(tip, ms = 2600) {
    clearWhisper();
    const node = el("div", { class: "yom-whisper" }, tip.title);
    root.appendChild(node);
    whisperEl = node;
    positionCluster();
    if (ms) {
      whisperTimer = setTimeout(() => {
        node.classList.add("out");
        setTimeout(() => {
          if (whisperEl === node) clearWhisper();
        }, 360);
      }, ms);
    }
  }

  function closeAsk() {
    askEl?.remove();
    askEl = null;
    sosKey = null;
  }

  function setSosMin(on) {
    sosMin = Boolean(on);
    if (!askEl?.classList.contains("yom-sos-sheet")) return;
    askEl.classList.toggle("min", sosMin);
    const btn = askEl.querySelector("[data-sos-toggle]");
    if (btn) {
      btn.textContent = sosMin ? "open" : "hide";
      btn.setAttribute("aria-label", sosMin ? "maximise sos" : "minimise sos");
    }
    positionCluster();
  }

  function attachChips(host, chips, otherChoices) {
    if (!host || !chips?.length) return;
    const paint = (list, extras) => {
      host.innerHTML = "";
      (list || []).forEach((c) => {
        if (!c?.label || typeof c.onPick !== "function") return;
        const btn = el(
          "button",
          {
            class: `yom-chip${c.block ? " block" : ""}${c.ghost ? " yom-chip-other" : ""}${c.on ? " on" : ""}`,
            type: "button",
          },
          c.label
        );
        if (c.sub) btn.appendChild(el("small", {}, c.sub));
        onTap(btn, () => c.onPick());
        host.appendChild(btn);
      });
      if (extras && extras.length) {
        const other = el("button", { class: "yom-chip yom-chip-other", type: "button" }, "other");
        onTap(other, () => paint(extras, null));
        host.appendChild(other);
      }
    };
    paint(chips, otherChoices && otherChoices.length ? otherChoices : null);
  }

  function ask({ title, body = "", options, otherChoices, kicker = "yom" }) {
    closeAsk();
    clearWhisper();
    const card = el("div", { class: "yom-ask" });
    card.innerHTML = `
      <div class="yom-ask-kicker">${kicker}</div>
      <h3>${title}</h3>
      ${body ? `<p>${body}</p>` : ""}
      <div class="yom-chips" data-chips></div>
    `;
    root.appendChild(card);
    askEl = card;
    attachChips(card.querySelector("[data-chips]"), options, otherChoices);
    positionCluster();
    pulseBuddy();
  }

  function learnedState() {
    if (!state.learned || typeof state.learned !== "object") {
      state.learned = { notes: [], brands: {}, likes: [] };
    }
    if (!Array.isArray(state.learned.notes)) state.learned.notes = [];
    if (!state.learned.brands || typeof state.learned.brands !== "object") state.learned.brands = {};
    if (!Array.isArray(state.learned.likes)) state.learned.likes = [];
    return state.learned;
  }

  function shopBrand(info) {
    try {
      const href = String(info?.href || location.href);
      const host = new URL(href, location.origin).hostname.replace(/^www\./, "");
      if (/thereformation/.test(host)) return "Reformation";
      if (/repetto/.test(host)) return "Repetto";
      if (/aritzia/.test(host)) return "Aritzia";
      if (/ssense/.test(host)) return "SSENSE";
      const og = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content");
      if (og) return og.trim();
      const label = host.split(".")[0].replace(/[-_]/g, " ");
      return label ? label.charAt(0).toUpperCase() + label.slice(1) : "this brand";
    } catch {
      return "this brand";
    }
  }

  function productRecord(info = {}, extra = {}) {
    const href = info.href || (isPdp() ? location.href : "");
    const name = info.name || info.alt || extra.name || "this piece";
    return {
      product_key: href || String(info.id || name),
      name,
      href,
      site: location.hostname,
      brand: shopBrand(info),
      kind: kindOf(info),
      color: info.color || "",
      price: info.price || extra.price || 0,
      ...extra,
    };
  }

  function rememberTake(info, mark = {}, surface = "tile") {
    try {
      chrome.runtime.sendMessage({
        type: "YOM_TAKE",
        take: {
          product_key: productRecord(info).product_key,
          site: location.hostname,
          surface,
          stamp: mark.stamp || "",
          kind: mark.love ? "love" : mark.warn ? "warn" : mark.kind || "neutral",
          title: mark.title || "",
          regret: mark.regret,
          mode: state.mode || "",
          purpose: state.purpose || "",
        },
      });
    } catch {
      /* ignore */
    }
  }

  function trackEvent(event, properties = {}) {
    try {
      chrome.runtime.sendMessage({ type: "YOM_TRACK", event, properties });
    } catch {
      /* ignore */
    }
  }

  function productAnalyticsProps(info = {}, extra = {}) {
    const rec = productRecord(info);
    return {
      product_id: rec.product_key || info.href || info.name || "",
      brand: rec.brand || shopBrand(info) || "",
      sku: info.sku || info.id || "",
      price: Number(info.price) || Number(rec.price) || 0,
      category: kindOf(info) || rec.kind || "",
      retailer: location.hostname,
      input_method: extra.input_method || "link",
      ...extra,
    };
  }

  function rememberOutcome(action, info, extra = {}) {
    try {
      chrome.runtime.sendMessage({
        type: "YOM_OUTCOME",
        outcome: productRecord(info, { action, ...extra }),
      });
    } catch {
      /* ignore */
    }
    if (action === "buy" || action === "skip" || action === "save") {
      trackEvent("user_decision_recorded", productAnalyticsProps(info, { decision: action, ...extra }));
    }
    if (action === "buy") {
      trackEvent("purchase_recorded", productAnalyticsProps(info, { decision: action }));
    }
    if (action === "returned") {
      trackEvent("return_recorded", productAnalyticsProps(info, { decision: action }));
    }
    if (action === "kept") {
      trackEvent("kept_recorded", productAnalyticsProps(info, { decision: action }));
    }
  }

  function sizeOptions(info) {
    if (kindOf(info || {}) === "shoes" || isShoeProduct(info)) return ["36", "37", "38", "39", "40"];
    if (kindOf(info || {}) === "jeans") return ["24", "25", "26", "27", "28", "29"];
    return ["US 2", "US 4", "US 6", "US 8"];
  }

  function interventionKind(ctx = {}) {
    if (ctx.kind) return ctx.kind;
    const tip = ctx.tip || {};
    const extras = ctx.extras || {};
    const blob = `${tip.title || ""} ${tip.body || ""} ${tip.stamp || ""} ${extras.size || ""}`.toLowerCase();
    if (Number(extras.regret) >= 70) return "skip";
    if (
      /over budget|maybe skip|not a gap|you have this|you own this|you just bought|skip this|don't buy/.test(blob)
    ) {
      return "skip";
    }
    if (extras.size || /size|runs long|runs small|runs large|too long|hem|eu \d|us \d|toe|fit/.test(blob)) {
      return "sizing";
    }
    if (isShoeProduct(ctx.info) && /pointed|rounder|narrow/.test(blob)) return "sizing";
    return "style";
  }

  function feedbackReasons(kind) {
    if (kind === "sizing") {
      return [
        { id: "other-size", label: "i wear another size", follow: "brand-size" },
        { id: "brand-run", label: "this brand runs differently", follow: "brand-run" },
        { id: "fit-pref", label: "fit preference", follow: "fit-pref" },
      ];
    }
    if (kind === "skip") {
      return [
        { id: "still-want", label: "i still want it" },
        { id: "doesnt-matter", label: "that doesn't matter to me" },
        { id: "got-wrong", label: "yom got something wrong" },
      ];
    }
    return [
      { id: "like-this", label: "i actually like this" },
      { id: "not-for-me", label: "not for me" },
      { id: "wrong-reason", label: "that's not why" },
    ];
  }

  function learnedMemory() {
    const L = learnedState();
    const brandLine = Object.entries(L.brands)
      .map(([brand, size]) => `${brand} ${size}`)
      .join("; ");
    return [L.notes.slice(-10).join(" "), brandLine && `brand sizes: ${brandLine}.`].filter(Boolean).join(" ");
  }

  function learnedSizes() {
    const L = learnedState();
    return {
      ...(activePersona().sizes || {}),
      ...(L.us ? { us: L.us } : {}),
      ...(L.denim ? { denim: L.denim } : {}),
      ...(L.shoes ? { shoes: L.shoes } : {}),
      brands: L.brands,
    };
  }

  function pieceName(info) {
    return cleanProductName(info?.name || info?.alt || "this piece") || "this piece";
  }

  function applyLearn(ctx, patch) {
    const L = learnedState();
    const info = ctx.info || {};
    const name = pieceName(info);
    const brand = patch.brand || shopBrand(info);
    const kind = kindOf(info);
    if (patch.note) {
      L.notes.push(patch.note);
      if (L.notes.length > 24) L.notes = L.notes.slice(-24);
    }
    if (patch.like) {
      const id = String(info.id || name);
      if (id && !L.likes.includes(id)) L.likes.push(id);
      if (info.id && state.stamps[info.id]) {
        state.stamps[info.id].love = true;
        state.stamps[info.id].warn = false;
      }
    }
    if (patch.size) {
      L.brands[brand] = patch.size;
      if (kind === "shoes" || isShoeProduct(info)) L.shoes = /eu/i.test(patch.size) ? patch.size : `EU ${patch.size}`;
      else if (kind === "jeans") L.denim = String(patch.size).replace(/^us\s*/i, "");
      else L.us = /us/i.test(patch.size) ? patch.size : `US ${patch.size}`;
    }
    if (patch.run) L.notes.push(`${brand} runs ${patch.run} for them.`);
    if (patch.fit) L.notes.push(`fit preference: ${patch.fit}.`);
    saveState();
    chrome.runtime.sendMessage({
      type: "YOM_LEARN",
      learn: {
        note: patch.note || "",
        brand: patch.size ? brand : "",
        size: patch.size || "",
        sizes: { us: L.us || "", denim: L.denim || "", shoes: L.shoes || "", brands: L.brands },
      },
    });
  }

  function fbButton(label, className, onPick) {
    const btn = el("button", { class: className, type: "button" }, label);
    onTap(btn, onPick);
    return btn;
  }

  function setFbHold(host, on) {
    const note = host.closest?.(".yom-tile-note");
    if (note) note.dataset.yomHold = on ? "1" : "";
    host.classList.toggle("yom-fb-open", on);
  }

  function ackCopy() {
    const lines = ["got it.", "right, noted.", "ok, noted."];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function markNoted(host) {
    setFbHold(host, false);
    host.innerHTML = "";
    host.appendChild(el("span", { class: "yom-fb-done" }, ackCopy()));
  }

  function paintSizeAsk(host, ctx) {
    const brand = shopBrand(ctx.info);
    host.innerHTML = "";
    host.appendChild(el("p", { class: "yom-fb-ask" }, `what size do you wear in ${brand}?`));
    sizeOptions(ctx.info).forEach((size) => {
      host.appendChild(
        fbButton(size, "yom-fb-chip", () => {
          applyLearn(ctx, {
            size,
            note: `wears ${size} in ${brand}, not the size yom assumed for ${pieceName(ctx.info)}.`,
          });
          markNoted(host);
        })
      );
    });
    const input = el("input", {
      class: "yom-fb-input",
      type: "text",
      maxlength: "12",
      placeholder: "or type",
    });
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("pointerdown", (e) => e.stopPropagation());
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key !== "Enter") return;
      const size = input.value.trim();
      if (!size) return;
      applyLearn(ctx, {
        size,
        note: `wears ${size} in ${brand}, not the size yom assumed for ${pieceName(ctx.info)}.`,
      });
      markNoted(host);
    });
    host.appendChild(input);
    setTimeout(() => input.focus(), 30);
  }

  function paintFollow(host, ctx, follow) {
    const brand = shopBrand(ctx.info);
    const options =
      follow === "brand-run"
        ? [
            { label: "runs small", run: "small" },
            { label: "true to size", run: "true to size" },
            { label: "runs large", run: "large" },
          ]
        : [
            { label: "rounder toe", fit: "rounder toe only" },
            { label: "more room", fit: "prefers more room" },
            { label: "closer fit", fit: "prefers a closer fit" },
          ];
    host.innerHTML = "";
    host.appendChild(
      el("p", { class: "yom-fb-ask" }, follow === "brand-run" ? `how does ${brand} run for you?` : "what do you prefer?")
    );
    options.forEach((opt) => {
      host.appendChild(
        fbButton(opt.label, "yom-fb-chip", () => {
          applyLearn(ctx, opt);
          markNoted(host);
        })
      );
    });
  }

  function paintReasons(host, ctx) {
    const kind = interventionKind(ctx);
    host.innerHTML = "";
    feedbackReasons(kind).forEach((reason) => {
      host.appendChild(
        fbButton(reason.label, "yom-fb-chip", () => {
          if (reason.follow === "brand-size") {
            paintSizeAsk(host, ctx);
            return;
          }
          if (reason.follow === "brand-run" || reason.follow === "fit-pref") {
            paintFollow(host, ctx, reason.follow);
            return;
          }
          const name = pieceName(ctx.info);
          const notes = {
            "like-this": `they actually like ${name}. do not treat it as a miss.`,
            "not-for-me": `they don't want ${name}. do not push it.`,
            "wrong-reason": `the reason yom gave on ${name} isn't the issue. don't repeat that framing.`,
            "still-want": `they still want ${name} even after the skip. do not block it.`,
            "doesnt-matter": `the reason yom gave on ${name} doesn't matter to them.`,
            "got-wrong": `yom got ${name} wrong. wait for a correction and do not repeat that take.`,
          };
          applyLearn(ctx, {
            note: notes[reason.id] || `corrected take on ${name}: ${reason.label}.`,
            like: reason.id === "like-this" || reason.id === "still-want",
          });
          markNoted(host);
        })
      );
    });
    setFbHold(host, true);
  }

  function mountFeedback(host, ctx) {
    if (!host || ctx.checking) return;
    host.innerHTML = "";
    host.appendChild(
      fbButton("makes sense", "yom-fb-btn yom-fb-ok", () => {
        applyLearn(ctx, {
          note: `confirmed take on ${pieceName(ctx.info)}: ${ctx.tip?.title || "this read"}.`,
        });
        host.innerHTML = "";
        host.appendChild(el("span", { class: "yom-fb-done" }, "got it."));
        setFbHold(host, false);
      })
    );
    host.appendChild(el("span", { class: "yom-fb-dot" }, "·"));
    host.appendChild(
      fbButton("disagree", "yom-fb-btn yom-fb-no", () => paintReasons(host, ctx))
    );
  }

  // ── in-page tile marks (drawn on yom's overlay, not the shop DOM) ──
  function tileBox(tile) {
    const img = tile.querySelector?.("img");
    const node = img && img.getBoundingClientRect().height > 20 ? img : tile;
    return node.getBoundingClientRect();
  }

  function clearExpandedNotes() {
    if (liveNote) {
      liveNote.remove();
      liveNote = null;
    }
    noteTimers.forEach((t) => clearTimeout(t));
    noteTimers.clear();
  }

  function clearAllMarks() {
    clearExpandedNotes();
    stampEls.forEach((n) => n.remove());
    stampEls.clear();
    dimEls.forEach((n) => n.remove());
    dimEls.clear();
    document.querySelectorAll(".yom-stamp, .yom-budget-flag, .yom-tile-note").forEach((n) => n.remove());
    document.querySelectorAll(".yom-tile-love, .yom-tile-dim").forEach((n) => {
      n.classList.remove("yom-tile-love", "yom-tile-dim");
    });
  }

  function pinMark(node, left, top, extra = {}) {
    node.style.setProperty("position", "fixed", "important");
    node.style.setProperty("left", `${Math.round(left)}px`, "important");
    node.style.setProperty("top", `${Math.round(top)}px`, "important");
    node.style.setProperty("right", "auto", "important");
    node.style.setProperty("bottom", "auto", "important");
    Object.entries(extra).forEach(([key, value]) => {
      node.style.setProperty(key, value, "important");
    });
  }

  function hideStamps() {
    stampEls.forEach((n) => n.remove());
    stampEls.clear();
    document.querySelectorAll(".yom-stamp, .yom-budget-flag").forEach((n) => n.remove());
  }

  function noteOnTile(box, width) {
    if (!box || box.bottom < 24 || box.top > window.innerHeight - 24) return null;
    const w = width || Math.max(168, Math.min(280, box.width > 40 ? box.width - 16 : 220));
    return {
      left: Math.max(8, Math.min(box.left + 8, window.innerWidth - w - 8)),
      top: box.top + 12,
      width: w,
    };
  }

  function syncMarkPositions() {
    applyBudgetFlags();
    if (!liveNote) return;
    if (!hoverTile) {
      clearExpandedNotes();
      return;
    }
    const pos = noteOnTile(tileBox(hoverTile));
    if (!pos) {
      clearExpandedNotes();
      return;
    }
    pinMark(liveNote, pos.left, pos.top, { width: `${pos.width}px` });
  }

  function noteTile(tile, tip, { love = false, warn = false } = {}) {
    try {
      const info = tileInfo(tile);
      const name = info.name || info.alt || "this piece";
      info.name = name;
      clearExpandedNotes();

      const mark = {
        stamp: tip.stamp || "yom",
        title: tip.title,
        body: tip.body || "",
        love,
        warn,
        closetKey: tip.closetKey || null,
      };
      state.stamps[info.id] = mark;
      rememberTake(info, mark, "tile");

      const closet = tip.closetKey && DATA?.closet ? DATA.closet[tip.closetKey] : null;
      const note = document.createElement("div");
      note.className = "yom-tile-note";
      if (closet?.file) {
        const img = document.createElement("img");
        img.alt = "";
        img.src = asset(closet.file);
        note.appendChild(img);
      }
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = tip.title || "";
      const line = document.createElement("span");
      line.textContent = closet?.note || tip.body || "";
      copy.appendChild(title);
      copy.appendChild(line);
      note.appendChild(copy);
      const fb = el("div", { class: "yom-fb" });
      note.appendChild(fb);
      mountFeedback(fb, { tip, info });
      const pos = noteOnTile(tileBox(info.root));
      if (!pos) return;
      pinMark(note, pos.left, pos.top, { width: `${pos.width}px` });
      marks.appendChild(note);
      liveNote = note;
      pulseBuddy();
    } catch (err) {
      console.warn("yom note", err);
    }
  }

  // ── PDP injection ────────────────────────────────────────────
  function clearPdp() {
    document.getElementById("yom-pdp-note")?.remove();
  }

  function sizable(node) {
    let elNode = node;
    let last = node;
    while (elNode && elNode.parentElement && elNode.offsetWidth < 220) {
      last = elNode;
      elNode = elNode.parentElement;
      if (elNode.offsetWidth > 640) return last;
    }
    return elNode;
  }

  function isAddToBagTarget(node) {
    if (!node || node.closest?.(YOM_UI)) {
      return false;
    }
    const t = `${node.textContent || ""} ${node.value || ""} ${node.getAttribute?.("aria-label") || ""}`
      .replace(/\s+/g, " ")
      .trim();
    if (/add to (bag|cart)/i.test(t) && t.length < 80) return true;
    const cls = `${node.className || ""} ${node.id || ""}`;
    return /add-to-cart|addToCart|add-to-bag|addtocart|addToBag/i.test(cls);
  }

  function findAddButton() {
    return [...document.querySelectorAll("button, input[type=submit], a")].find(isAddToBagTarget);
  }

  function isSticky(node) {
    if (!node) return false;
    const pos = getComputedStyle(node).position;
    return pos === "fixed" || pos === "sticky";
  }

  function pdpInsertPoint() {
    const root = EXTRACT.pdpRoot?.() || document.querySelector("main");
    const h1 = root?.querySelector("h1") || document.querySelector("h1");
    if (h1 && !isSticky(h1)) return { el: sizable(h1), where: "after" };

    const price = [...(root?.querySelectorAll("[itemprop='price'], .price--formated") || [])].find(
      (n) => !EXTRACT.isRecNode?.(n) && !isSticky(n)
    );
    if (price) return { el: sizable(price), where: "after" };

    const addBtn = findAddButton();
    if (addBtn && !isSticky(addBtn) && !isSticky(addBtn.parentElement)) {
      const block =
        addBtn.closest("form, [class*='add-to'], [class*='addtocart'], [class*='AddTo']") ||
        addBtn.parentElement;
      return { el: sizable(block), where: "before" };
    }
    return { el: root || document.body, where: "prepend" };
  }

  function mountPdp(node) {
    clearPdp();
    node.id = "yom-pdp-note";
    const { el: target, where } = pdpInsertPoint();
    if (!target) {
      document.body.prepend(node);
      return;
    }
    if (where === "before" && target.parentElement) target.parentElement.insertBefore(node, target);
    else if (where === "after") target.insertAdjacentElement("afterend", node);
    else target.prepend(node);
  }

  function pdpNote(tip, extras = {}) {
    const {
      closetKey,
      resolve,
      alts,
      chips,
      otherChoices,
      checking = false,
      kicker = "yom",
      size,
      reviews,
      shipping,
      regret,
      sources = null,
      findings = null,
      researchLog = null,
    } = extras;
    const closet = closetKey ? DATA.closet[closetKey] : tip.closetKey ? DATA.closet[tip.closetKey] : null;
    const regretN = Number(regret);
    const hasRegret = Number.isFinite(regretN);
    const tone = hasRegret ? regretTone(regretN) : "";
    const label = hasRegret ? extras.regretLabel || formatRegretLabel(regretN) : "";
    const facts = [
      size ? `<div class="yom-fact"><em>size</em><span>${size}</span></div>` : "",
      reviews ? `<div class="yom-fact"><em>reviews</em><span>${reviews}</span></div>` : "",
      shipping ? `<div class="yom-fact"><em>shipping</em><span>${shipping}</span></div>` : "",
    ]
      .filter(Boolean)
      .join("");
    const sourceRow =
      sources?.length
        ? `<div class="yom-sources">${sources
            .map(
              (s) =>
                `<span class="yom-source${s.active ? " active" : ""}${s.done ? " done" : ""}">${s.label}</span>`
            )
            .join("")}</div>`
        : "";
    const logRow =
      researchLog?.length
        ? `<ul class="yom-research-log">${researchLog
            .map((line) => `<li><em>${line.source}</em><span>${line.text}</span></li>`)
            .join("")}</ul>`
        : "";
    const findingsRow = "";
    const node = el("div", { class: `yom-ui yom-pdp-note${checking ? " checking" : ""}` });
    node.innerHTML = `
      <div class="yom-pdp-kicker">${kicker}</div>
      <h3>${tip.title}</h3>
      ${tip.body ? `<p>${tip.body}</p>` : ""}
      ${sourceRow}
      ${logRow}
      ${facts ? `<div class="yom-facts">${facts}</div>` : ""}
      ${findingsRow}
      ${
        hasRegret
          ? `<div class="yom-regret ${tone}">
              <div>
                <strong>regret score</strong>
                <div class="yom-keep-bar"><span style="width:${regretN}%"></span></div>
                <span class="yom-regret-label">${label}</span>
              </div>
              <div class="yom-keep-score">${regretN}</div>
            </div>`
          : ""
      }
      ${resolve ? `<div class="yom-pdp-resolve">${resolve}</div>` : ""}
      ${
        closet
          ? `<div class="yom-pdp-closet">
              <img src="${asset(closet.file)}" alt="" />
              <div><strong>${closet.title}</strong><span>${closet.note}</span></div>
            </div>`
          : ""
      }
      ${
        alts
          ? `<div class="yom-pdp-alts">${alts
              .map(
                (a) =>
                  `<div class="yom-pdp-alt"><div><strong>${a.brand} ${a.name}</strong><span>${a.why}</span></div><em>${a.price}</em></div>`
              )
              .join("")}</div>`
          : ""
      }
      ${chips?.length ? `<div class="yom-chips" data-chips></div>` : ""}
      ${checking ? "" : `<div class="yom-fb" data-fb></div>`}
    `;
    mountPdp(node);
    if (chips?.length) attachChips(node.querySelector("[data-chips]"), chips, otherChoices);
    if (!checking) {
      const info = (() => {
        try {
          return pdpInfo();
        } catch {
          return { name: tip.title };
        }
      })();
      mountFeedback(node.querySelector("[data-fb]"), { tip, extras, info });
    }
    pulseBuddy();
    return node;
  }

  // ── budget dimming on the grid ───────────────────────────────
  function clearBudgetFlags() {
    dimEls.forEach((n) => n.remove());
    dimEls.clear();
    document.querySelectorAll(".yom-budget-flag").forEach((n) => n.remove());
    document.querySelectorAll(".yom-tile-dim").forEach((n) => n.classList.remove("yom-tile-dim"));
  }

  function applyBudgetFlags() {
    dimEls.forEach((n) => n.remove());
    dimEls.clear();
    document.querySelectorAll(".yom-budget-flag").forEach((n) => n.remove());
    if (state.budget == null) {
      document.querySelectorAll(".yom-tile-dim").forEach((n) => n.classList.remove("yom-tile-dim"));
      return;
    }
    const rem = remainingBudget();
    const keep = new Set();
    findTiles().forEach((tile) => {
      try {
        const host = tileHost(tile);
        const info = tileInfo(tile);
        const over = Number(info.price) > rem;
        host.classList.add("yom-tile-host");
        host.classList.toggle("yom-tile-dim", over);
        if (over) keep.add(host);
      } catch {
        /* skip */
      }
    });
    document.querySelectorAll(".yom-tile-dim").forEach((n) => {
      if (!keep.has(n)) n.classList.remove("yom-tile-dim");
    });
  }

  function setBudget(value) {
    state.budget = value;
    saveState();
    closeAsk();
    render();
    if (value != null) whisper(DATA.tips.budgetOn);
  }

  function addToBag(name, price, fallbackName, info) {
    const label = name || fallbackName;
    if (!state.cartNames.includes(label)) {
      state.spent += price;
      state.cartNames.push(label);
    }
    saveState();
    rememberOutcome("buy", info || { name: label, price });
  }

  // ── activation / questions ───────────────────────────────────
  onTap(buddy, () => {
    clickCount += 1;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 450);
    if (clickCount >= 3) {
      clickCount = 0;
      resetState();
      return;
    }

    if (!state.mode) {
      openModePicker();
      return;
    }
    state.panelOpen = !state.panelOpen;
    renderPanel();
  });

  onTap(modePill, () => {
    state.panelOpen = !state.panelOpen;
    renderPanel();
  });

  function openModePicker() {
    saveState();
    ask({
      title: "what’s the vibe?",
      body: "i’ll hang on the page. no chat unless i need a tap.",
      options: [
        { label: "casually browsing", onPick: () => startBrowseMode() },
        { label: "buying for an event", onPick: () => openPurposePicker() },
        { label: "sos", onPick: () => startSosMode() },
      ],
      otherChoices: [{ label: "not sure yet", onPick: () => startBrowseMode() }],
    });
  }

  function startBrowseMode() {
    ask({
      title: "budget?",
      body: "skip it — add one later if shopping turns real.",
      options: [
        { label: "no budget", onPick: () => finishBrowseMode(null) },
        { label: "$200", onPick: () => finishBrowseMode(200) },
        { label: "$400", onPick: () => finishBrowseMode(400) },
      ],
      otherChoices: [
        { label: "$150", onPick: () => finishBrowseMode(150) },
        { label: "$300", onPick: () => finishBrowseMode(300) },
        { label: "I’ll set it later", onPick: () => finishBrowseMode(null) },
      ],
    });
  }

  function startGiftMode() {
    ask({
      title: "budget?",
      body: "for the gift — skip if you don’t have one.",
      options: [
        { label: "no budget", onPick: () => finishSession("gift", null, null) },
        { label: "$200", onPick: () => finishSession("gift", null, 200) },
        { label: "$400", onPick: () => finishSession("gift", null, 400) },
      ],
      otherChoices: [
        { label: "$150", onPick: () => finishSession("gift", null, 150) },
        { label: "$300", onPick: () => finishSession("gift", null, 300) },
        { label: "I’ll set it later", onPick: () => finishSession("gift", null, null) },
      ],
    });
  }

  function finishBrowseMode(budget) {
    finishSession("browse", null, budget);
  }

  function finishPurposeMode(purpose, budget) {
    finishSession("purpose", purpose, budget);
  }

  function startSosMode() {
    finishSession("sos", null, null);
  }

  function finishSession(mode, purpose, budget) {
    state.mode = mode;
    state.purpose = purpose;
    state.budget = budget;
    state.panelOpen = false;
    saveState();
    closeAsk();
    dockBuddy(true);
    render();
    chrome.runtime.sendMessage({
      type: "YOM_SESSION",
      session: { mode, purpose, budget, spent: state.spent || 0 },
    });
    trackEvent("shopping_session_started", {
      mode: mode || "",
      purpose: purpose || "",
      budget: budget == null ? null : Number(budget),
    });
    if (mode !== "sos") sosMin = false;
    if (mode === "sos") runSos();
    else whisper(welcomeTip());
  }

  function askPersona() {
    ask({
      title: "which is most you?",
      body: "this is how yom reads you — it stays with this browser.",
      options: DATA.persona.traits.map((t) => ({
        label: t.label,
        block: true,
        onPick: () => askKeepLean(t.id),
      })),
      otherChoices: [
        { label: "skip for now", onPick: () => applyHashedPersona() },
      ],
    });
  }

  function askKeepLean(trait) {
    ask({
      title: "you tend to keep…",
      body: "the pieces that actually get worn.",
      options: DATA.persona.keep.map((k) => ({
        label: k.label,
        onPick: () => {
          const h = hashedPersona();
          applyPersona(trait, h.preBuy, k.id);
        },
      })),
      otherChoices: [
        { label: "skip for now", onPick: () => applyHashedPersona(trait) },
      ],
    });
  }

  function applyHashedPersona(trait) {
    const h = hashedPersona();
    applyPersona(trait || h.trait, h.preBuy, h.keepLean);
  }

  function openPurposePicker() {
    ask({
      title: "what’s coming up?",
      body: "pulled from your calendar.",
      options: DATA.events.map((e) => ({
        label: e.label,
        sub: `${e.when} · ${e.source}`,
        block: true,
        onPick: () => askPurposeBudget(e.label),
      })),
      otherChoices: [
        { label: "a work thing", onPick: () => askPurposeBudget("a work thing") },
        { label: "a date", onPick: () => askPurposeBudget("a date") },
        { label: "nothing specific", onPick: () => startBrowseMode() },
      ],
    });
  }

  function askPurposeBudget(purpose) {
    ask({
      title: "budget?",
      body: "optional.",
      options: [
        { label: "no budget", onPick: () => finishPurposeMode(purpose, null) },
        { label: "$200", onPick: () => finishPurposeMode(purpose, 200) },
        { label: "$400", onPick: () => finishPurposeMode(purpose, 400) },
      ],
      otherChoices: [
        { label: "$150", onPick: () => finishPurposeMode(purpose, 150) },
        { label: "$300", onPick: () => finishPurposeMode(purpose, 300) },
        { label: "I’ll set it later", onPick: () => finishPurposeMode(purpose, null) },
      ],
    });
  }

  function askBudgetChips() {
    state.budgetAsked = true;
    saveState();
    ask({
      title: DATA.tips.budgetAsk.title,
      body: DATA.tips.budgetAsk.body,
      options: [
        { label: "$200", onPick: () => setBudget(200) },
        { label: "$400", onPick: () => setBudget(400) },
        { label: "no budget", onPick: () => { closeAsk(); whisper(DATA.tips.afterAdd); } },
      ],
      otherChoices: [
        { label: "$150", onPick: () => setBudget(150) },
        { label: "$300", onPick: () => setBudget(300) },
        { label: "later", onPick: () => { closeAsk(); whisper(DATA.tips.afterAdd); } },
      ],
    });
  }

  // ── context panel (chips, not dropdowns) ─────────────────────
  function renderPanel() {
    if (!state.panelOpen || !state.mode) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    const contextChips = [
      { label: "casually browsing", value: "browse", on: state.mode === "browse" },
      { label: "buying for an event", value: "event", on: state.mode === "purpose" },
      { label: "sos", value: "sos", on: state.mode === "sos" },
      ...DATA.events.map((e) => ({
        label: e.label,
        value: e.label,
        on: state.mode === "purpose" && state.purpose === e.label,
      })),
    ];
    const budgetChips = [
      { label: "none", value: "none", on: state.budget == null },
      { label: "$150", value: "150", on: state.budget === 150 },
      { label: "$200", value: "200", on: state.budget === 200 },
      { label: "$300", value: "300", on: state.budget === 300 },
      { label: "$400", value: "400", on: state.budget === 400 },
    ];

    const spentHtml = state.spent
      ? `bag so far · $${state.spent}${state.budget != null ? ` · $${remainingBudget()} left` : ""}`
      : "";
    const newYomHtml = isDemoSite()
      ? ""
      : `<button type="button" class="yom-new-yom" data-new-yom>new yom</button>`;

    const savedHtml = (state.saved || []).length
      ? `saved · ${state.saved
          .slice(-3)
          .map((s) => s.name)
          .join(" · ")}`
      : "";

    panel.innerHTML = `
      <div class="yom-panel-head">
        <strong>context</strong>
        <button type="button" data-close>close</button>
      </div>
      <div class="yom-field">
        <label>shopping for</label>
        <div class="yom-chips" data-context></div>
      </div>
      <div class="yom-field">
        <label>budget</label>
        <div class="yom-chips" data-budget></div>
      </div>
      ${spentHtml ? `<div class="yom-meta">${spentHtml}</div>` : ""}
      ${savedHtml ? `<div class="yom-meta">${savedHtml}</div>` : ""}
      ${newYomHtml}
    `;

    panel.querySelector("[data-close]") &&
      onTap(panel.querySelector("[data-close]"), () => {
        state.panelOpen = false;
        saveState();
        renderPanel();
      });

    panel.querySelector("[data-new-yom]") &&
      onTap(panel.querySelector("[data-new-yom]"), () => {
        state.userId = newUserId();
        state.trait = null;
        state.preBuy = null;
        state.keepLean = null;
        state.read = null;
        saveState();
        state.panelOpen = false;
        renderPanel();
        askPersona();
      });

    attachChips(
      panel.querySelector("[data-context]"),
      contextChips.map((c) => ({
        label: c.label,
        on: c.on,
        onPick: () => pickContext(c.value),
      })),
      [
        { label: "a work thing", onPick: () => pickContext("a work thing") },
        { label: "a date", onPick: () => pickContext("a date") },
        { label: "nothing specific", onPick: () => pickContext("browse") },
      ]
    );

    attachChips(
      panel.querySelector("[data-budget]"),
      budgetChips.map((c) => ({
        label: c.label,
        on: c.on,
        onPick: () => {
          state.panelOpen = false;
          setBudget(c.value === "none" ? null : Number(c.value));
        },
      })),
      [
        {
          label: "$250",
          onPick: () => {
            state.panelOpen = false;
            setBudget(250);
          },
        },
        {
          label: "I’ll set it later",
          onPick: () => {
            state.panelOpen = false;
            setBudget(null);
          },
        },
      ]
    );
  }

  function pickContext(next) {
    if (next === "browse") {
      state.mode = "browse";
      state.purpose = null;
      saveState();
      state.panelOpen = false;
      render();
      return;
    }
    if (next === "sos") {
      state.panelOpen = false;
      startSosMode();
      return;
    }
    if (next === "event") {
      state.panelOpen = false;
      openPurposePicker();
      return;
    }
    if (next === "gift") {
      state.mode = "gift";
      state.purpose = null;
      saveState();
      state.panelOpen = false;
      render();
      return;
    }
    state.mode = "purpose";
    state.purpose = next;
    saveState();
    if (isPdp()) {
      enterPurposeOnPdp();
      return;
    }
    state.panelOpen = false;
    render();
  }

  function deliveryTip() {
    const ev = purposeMeta();
    if (ev?.delivery) return ev.delivery;
    return DATA.purposeFallback.generic.delivery;
  }

  function runsLong(info) {
    return hashStr(String(info?.id || info?.name || location.pathname)) % 2 === 0;
  }

  function checkResult(info) {
    const ev = purposeMeta();
    if (runsLong(info)) {
      if (ev?.kind === "wedding") {
        return ev.check || DATA.reviews.long;
      }
      if (ev?.kind === "trip") {
        return {
          title: "reviews say it runs long",
          body: "a lot of people say it’s really long.",
          resolve: "Reformation offers alterations. you’ll still have it before the weekend.",
        };
      }
      return DATA.reviews.long;
    }
    if (ev?.check && ev.story !== "wedding") return ev.check;
    return DATA.reviews.strong;
  }

  function shippingRead() {
    const ev = purposeMeta();
    if (ev?.delivery?.title && ev?.delivery?.body) {
      return `${ev.delivery.title} — ${ev.delivery.body}`;
    }
    if (ev?.delivery?.body) return ev.delivery.body;
    if (isDemoSite()) return "arrives in 3–5 days — Reformation’s usual timing.";
    return "this shop is usually 3–5 days. fine unless you need it tomorrow.";
  }

  function pageFacts() {
    if (pageFacts.path === location.pathname && pageFacts.cache) return pageFacts.cache;
    let facts = { reviews: "", shipping: "", sizeNote: "" };
    try {
      facts = EXTRACT.pageFacts?.() || facts;
    } catch {
      /* ignore */
    }
    pageFacts.path = location.pathname;
    pageFacts.cache = facts;
    return facts;
  }

  function findPrior(info) {
    if (info?.id && state.stamps[info.id]) return state.stamps[info.id];
    const name = (info?.name || "").toLowerCase();
    if (name.length > 4) {
      const hit = Object.values(state.stamps || {}).find((m) => {
        const title = String(m?.title || "").toLowerCase();
        return title && (title.includes(name.slice(0, 12)) || name.includes(title.slice(0, 12)));
      });
      if (hit) return hit;
    }
    const take = opinionFor(info);
    if (!take?.tip) return null;
    return { ...take.tip, love: !!take.love, warn: !!take.warn };
  }

  function sizeRead(info) {
    const sizes = activePersona().sizes || DATA.persona?.demo?.sizes || {};
    const kind = kindOf(info);
    let base = "";
    if (kind === "shoes" || isShoeProduct(info)) {
      base = `you wear ${sizes.shoes || "EU 37"}, and only rounder toes stick.`;
    } else if (kind === "jeans") base = `you wear a ${sizes.denim || "26"} in denim.`;
    else if (sizes.us) base = `you usually take a ${sizes.us}.`;
    if (runsLong(info) && !isShoeProduct(info)) {
      return [base, "reviews say it runs long."].filter(Boolean).join(" ");
    }
    return base;
  }

  function reviewsRead(info) {
    return checkResult(info).body;
  }

  function regretScore(info, prior) {
    let n = 46;
    if (prior?.love) n -= 18;
    if (prior?.warn) n += 16;
    if (prior?.closetKey === "green") n -= 16;
    if (prior?.closetKey === "similar") n += 18;
    if (isShoeProduct(info) && !isGift()) n += 22;
    if (state.budget != null && Number(info.price) > remainingBudget()) n += 20;
    const reviews = checkResult(info);
    if (reviews === DATA.reviews.mixed || /thinner|pilling|mixed/i.test(reviews.body || "")) n += 10;
    if (reviews === DATA.reviews.long || /long|hem/i.test(reviews.body || "")) n += 6;
    if (reviews === DATA.reviews.strong) n -= 8;
    if (purposeMeta()?.kind === "wedding" && isDress(info)) n -= 10;
    return Math.max(8, Math.min(92, n));
  }

  function regretTone(n) {
    const score = Number(n);
    if (score <= 40) return "keep";
    if (score <= 69) return "ok";
    return "return";
  }

  function localBrief(info) {
    const prior = findPrior(info) || {
      title: "worth a closer look",
      body: "let me look at it against what you actually wear.",
    };
    const reviews = reviewsRead(info);
    const size = sizeRead(info) || "no size on file yet — check the chart against how this brand runs.";
    const shipping = shippingRead();
    const regret = regretScore(info, prior);
    const extra = checkResult(info).resolve;
    return {
      title: prior.title,
      body: prior.body,
      stamp: prior.stamp,
      closetKey: prior.closetKey,
      size,
      reviews,
      shipping,
      regret,
      regretLabel: formatRegretLabel(regret),
      resolve: extra || null,
    };
  }

  function mergeBrief(info, advice) {
    const local = localBrief(info);
    if (!advice || advice.quiet || isDemoSite()) {
      return local;
    }
    const regret = Number.isFinite(Number(advice.regret)) ? Number(advice.regret) : local.regret;
    return {
      title: advice.title || local.title,
      body: advice.body || local.body,
      stamp: advice.stamp || local.stamp,
      closetKey: local.closetKey,
      size: advice.size || local.size,
      reviews: local.reviews,
      shipping: local.shipping,
      regret,
      regretLabel: advice.regretLabel || formatRegretLabel(regret),
      resolve: local.resolve || advice.resolve,
    };
  }

  function briefExtras(brief, extras = {}) {
    const withRegret = extras.withRegret === true;
    const rest = { ...extras };
    delete rest.withRegret;
    return {
      ...rest,
      closetKey: rest.closetKey || brief.closetKey,
      resolve: rest.resolve || brief.resolve,
      size: brief.size,
      reviews: brief.reviews,
      shipping: brief.shipping,
      ...(withRegret
        ? { regret: brief.regret, regretLabel: brief.regretLabel }
        : { regret: undefined, regretLabel: undefined }),
    };
  }

  function saveItem(info) {
    const name = info?.name || pdpInfo().name || "this piece";
    const href = info?.href || location.href;
    const price = info?.price || 0;
    state.saved = state.saved || [];
    if (!state.saved.some((s) => s.href === href || s.name === name)) {
      state.saved.push({ name, href, price, at: Date.now() });
    }
    saveState();
    chrome.runtime.sendMessage({
      type: "YOM_SAVE",
      item: {
        name,
        href,
        price,
        site: location.hostname,
        kind: kindOf(info || {}),
        color: info?.color || "",
        brand: shopBrand(info || {}),
      },
    });
    whisper({ title: DATA.tips.saved.title, body: `${name} is on your list.` });
  }

  function decideChips(info, extras = {}) {
    return {
      ...extras,
      chips: [
        {
          label: "buy it",
          onPick: () => {
            rememberOutcome("buy", info);
            whisper({ title: "add it", body: "i’ll keep it against what you told me." });
          },
        },
        { label: "save for later", onPick: () => saveItem(info) },
        {
          label: "skip",
          onPick: () => {
            rememberOutcome("skip", info);
            whisper(DATA.tips.skipped);
          },
        },
      ],
      otherChoices: [{ label: "not sure yet", onPick: () => saveItem(info) }],
    };
  }

  function paintChecked(info, brief, kicker) {
    const pageKey = location.pathname;
    state.checking = false;
    state.checked[pageKey] = brief;
    saveState();
    if (location.pathname !== pageKey) return;
    pdpNote(
      brief,
      decideChips(
        info,
        briefExtras(brief, {
          kicker,
        })
      )
    );
    rememberTake(info, brief, /check/i.test(kicker || "") ? "check" : "pdp");
    trackEvent(
      "yom_verdict_viewed",
      productAnalyticsProps(info, {
        verdict: brief?.resolve || brief?.title || "",
        regret: brief?.regret,
        input_method: /check/i.test(kicker || "") ? "check" : "pdp",
      })
    );
  }

  function firstVisibleProduct() {
    const tiles = findTiles();
    for (let i = 0; i < tiles.length; i += 1) {
      try {
        const box = tileBox(tiles[i]);
        if (box.bottom < 80 || box.top > window.innerHeight - 40) continue;
        const info = tileInfo(tiles[i]);
        if (info?.name || info?.alt) return info;
      } catch {
        /* skip */
      }
    }
    return tiles[0] ? tileInfo(tiles[0]) : null;
  }

  function sosProduct() {
    if (isPdp()) return pdpInfo();
    if (hoverTile) {
      try {
        return tileInfo(hoverTile);
      } catch {
        /* fall through */
      }
    }
    return firstVisibleProduct();
  }

  function sosSheet(brief, info) {
    clearWhisper();
    const regretN = Number(brief.regret);
    const hasRegret = Number.isFinite(regretN);
    const tone = hasRegret ? regretTone(regretN) : "";
    const label = hasRegret ? brief.regretLabel || formatRegretLabel(regretN) : "";
    const facts = [
      brief.size ? `<div class="yom-fact"><em>size</em><span>${brief.size}</span></div>` : "",
      brief.reviews ? `<div class="yom-fact"><em>reviews</em><span>${brief.reviews}</span></div>` : "",
      brief.shipping ? `<div class="yom-fact"><em>shipping</em><span>${brief.shipping}</span></div>` : "",
    ]
      .filter(Boolean)
      .join("");
    const html = `
      <div class="yom-sos-head">
        <div class="yom-ask-kicker">yom · sos</div>
        <button type="button" class="yom-sos-toggle" data-sos-toggle>${sosMin ? "open" : "hide"}</button>
      </div>
      <h3>${brief.title || "this piece"}</h3>
      <div class="yom-sos-body">
      ${brief.body ? `<p>${brief.body}</p>` : ""}
      ${facts ? `<div class="yom-facts">${facts}</div>` : ""}
      ${
        hasRegret
          ? `<div class="yom-regret ${tone}">
              <div>
                <strong>regret score</strong>
                <div class="yom-keep-bar"><span style="width:${regretN}%"></span></div>
                <span class="yom-regret-label">${label}</span>
              </div>
              <div class="yom-keep-score">${regretN}</div>
            </div>`
          : ""
      }
      ${brief.resolve ? `<p class="yom-sos-resolve">${brief.resolve}</p>` : ""}
      <div class="yom-chips" data-chips></div>
      <div class="yom-fb" data-fb></div>
      </div>
    `;
    let card = askEl?.classList.contains("yom-sos-sheet") ? askEl : null;
    if (!card) {
      closeAsk();
      card = el("div", { class: "yom-ask yom-sos-sheet" });
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-sos-toggle]")) {
          e.preventDefault();
          e.stopPropagation();
          setSosMin(!sosMin);
          return;
        }
        if (e.target.closest("button, input, textarea, a, .yom-chip, .yom-fb, .yom-fb-btn, .yom-fb-chip")) {
          return;
        }
        if (sosMin) {
          e.preventDefault();
          setSosMin(false);
        }
      });
      root.appendChild(card);
      askEl = card;
    }
    card.innerHTML = html;
    card.classList.toggle("min", sosMin);
    const toggle = card.querySelector("[data-sos-toggle]");
    if (toggle) onTap(toggle, () => setSosMin(!sosMin));
    const extras = decideChips(info, briefExtras(brief, { withRegret: true }));
    attachChips(card.querySelector("[data-chips]"), extras.chips, extras.otherChoices);
    const fb = card.querySelector("[data-fb]");
    if (fb) mountFeedback(fb, { tip: brief, extras, info });
    positionCluster();
    if (!sosMin) pulseBuddy();
    rememberTake(info, brief, "sos");
  }

  function paintSos(info) {
    if (isPdp()) {
      closeAsk();
      return false;
    }
    if (!info) return false;
    const name = info.name || info.alt || "";
    const key = String(info.id || info.href || name || (isPdp() ? location.pathname : ""));
    if (!key || key === "undefined") return false;
    if (askEl?.querySelector?.(".yom-fb-open")) return true;
    if (sosKey === key && askEl?.classList.contains("yom-sos-sheet")) return true;
    const pageKey = location.pathname;
    const brief =
      isPdp() && state.checked[pageKey]?.title ? state.checked[pageKey] : localBrief(info);
    sosSheet(brief, info);
    sosKey = key;
    if (isPdp()) {
      state.checked[pageKey] = brief;
      saveState();
    }
    return true;
  }

  function runSos() {
    try {
      if (isPdp()) {
        closeAsk();
        return;
      }
      const info = sosProduct();
      if (!info?.name && !info?.alt && !info?.root) {
        if (!askEl) whisper(DATA.tips.sos);
        return;
      }
      paintSos(info);
      if (isDemoSite()) return;
      const pageKey = location.pathname;
      const shot = info;
      advise("check", shot).then((advice) => {
        if (!advice || advice.quiet || state.mode !== "sos") return;
        if (isPdp()) return;
        if (location.pathname !== pageKey) return;
        if (askEl?.querySelector?.(".yom-fb-open")) return;
        sosKey = null;
        sosSheet(mergeBrief(shot, advice), shot);
        sosKey = String(shot.id || shot.href || shot.name || pageKey);
      });
    } catch (err) {
      console.warn("yom sos", err);
      if (!askEl) whisper(DATA.tips.sos);
    }
  }

  function lookIntoChips(tip, extras = {}) {
    return {
      ...extras,
      chips: [
        { label: "look into this", onPick: () => runCheck() },
        { label: "save for later", onPick: () => saveItem(pdpInfo()) },
        { label: "not now", onPick: () => pdpNote(tip, extras) },
      ],
      otherChoices: [
        { label: "remind me later", onPick: () => saveItem(pdpInfo()) },
        { label: "I’ll handle it", onPick: () => pdpNote(tip, extras) },
      ],
    };
  }

  function enterPurposeOnPdp() {
    state.mode = "purpose";
    if (!state.purpose) state.purpose = "Sofia's wedding";
    state.panelOpen = false;
    spokenKey = `purpose:${location.pathname}`;
    saveState();
    renderPanel();
    positionCluster();
    const info = pdpInfo();
    const prior = findPrior(info);
    const tip = prior?.title ? { title: prior.title, body: prior.body } : deliveryTip();
    pdpNote(tip, lookIntoChips(tip, { shipping: shippingRead(), closetKey: prior?.closetKey }));
  }

  function checkStages(info) {
    const name = pieceName(info);
    const facts = isDemoSite() ? { reviews: "", shipping: "", sizeNote: "" } : pageFacts();
    const price = info.price ? `$${Number(info.price)}` : "";
    const listing = [info.color, price, String(info.description || "").slice(0, 120)].filter(Boolean).join(" · ");
    const size = sizeRead(info);
    const reviews = facts.reviews || reviewsRead(info);
    const ship = facts.shipping || shippingRead();
    const check = checkResult(info);
    const stages = [
      {
        source: "this piece",
        title: name,
        body: listing || "the listing in front of you.",
      },
    ];
    if (size || facts.sizeNote) {
      stages.push({
        source: "fit",
        title: "your size on this",
        body: [size, facts.sizeNote].filter(Boolean).join(" "),
      });
    }
    stages.push({
      source: "reviews",
      title: check.title,
      body: reviews || check.body,
    });
    if (ship) {
      stages.push({
        source: "shipping",
        title: "timing",
        body: ship,
      });
    }
    return stages.slice(0, 3);
  }

  function runCheck() {
    const info = pdpInfo();
    const pageKey = location.pathname;
    state.checking = true;
    saveState();
    trackEvent(
      "product_check_started",
      productAnalyticsProps(info, { input_method: "check" })
    );

    const stages = checkStages(info);
    const sourceStrip = stages.map((s, idx) => ({
      label: s.source,
      active: idx === 0,
      done: false,
    }));

    let i = 0;
    const showStage = () => {
      if (location.pathname !== pageKey) return;
      if (i < stages.length) {
        const stage = stages[i];
        sourceStrip.forEach((s, idx) => {
          s.active = idx === i;
          s.done = idx < i;
        });
        pdpNote(
          { title: stage.title, body: stage.body },
          {
            checking: true,
            kicker: "yom",
            sources: sourceStrip.map((s) => ({ ...s })),
          }
        );
        i += 1;
        setTimeout(showStage, 520);
        return;
      }
      finishCheck(info, pageKey);
    };
    showStage();
  }

  function researchBrief(info) {
    const check = checkResult(info);
    const prior = findPrior(info);
    const regret = regretScore(info, prior);
    const name = pieceName(info);
    return {
      title: check.title,
      body: `${name}. ${check.body}`,
      stamp: prior?.stamp || "checked",
      closetKey: prior?.closetKey,
      size: sizeRead(info) || "no size on file yet — check the chart against how this brand runs.",
      reviews: reviewsRead(info),
      shipping: shippingRead(),
      regret,
      regretLabel: formatRegretLabel(regret),
      resolve: check.resolve || null,
    };
  }

  function finishCheck(info, pageKey) {
    if (location.pathname !== pageKey) return;
    const brief = researchBrief(info);
    paintChecked(info, brief, "yom · checked");
    trackEvent(
      "product_check_completed",
      productAnalyticsProps(info, {
        input_method: "check",
        verdict: brief?.resolve || brief?.title || "",
        regret: brief?.regret,
      })
    );
    if (isDemoSite()) return;
    advise("check", info).then((advice) => {
      if (!advice || advice.quiet || location.pathname !== pageKey) return;
      paintChecked(
        info,
        mergeBrief(info, {
          ...advice,
          title: advice.title || brief.title,
          body: advice.body || brief.body,
          resolve: brief.resolve || advice.resolve,
        }),
        "yom · checked"
      );
    });
  }

  function afterAdded(info) {
    spokenKey = null;
    saveState();
    clearPdp();
    render();
    if (state.budget == null && !state.budgetAsked) {
      askBudgetChips();
      return;
    }
    const ev = purposeMeta();
    if (ev) whisper({ title: `in for ${ev.label}` });
    else whisper(DATA.tips.afterAdd);
  }

  // ── native add-to-bag ────────────────────────────────────────
  function onNativeAdd() {
    if (!state.mode || !isPdp()) return;
    if (Date.now() - lastAddAt < 900) return;
    lastAddAt = Date.now();
    const info = pdpInfo();
    if (isShoeProduct(info)) return;
    addToBag(info.name, info.price || 0, info.name || "piece", info);
    afterAdded(info);
  }

  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest(YOM_UI)) return;
      const btn = e.target.closest("button, a, input");
      if (isAddToBagTarget(btn)) onNativeAdd();
    },
    true
  );

  function advise(surface, product) {
    return new Promise((resolve) => {
      let done = false;
      const productUrl = product.href || (isPdp() ? location.href : "");
      const prior = findPrior(product);
      const payload = {
        surface,
        product: {
          id: product.id || "",
          name: product.name,
          price: product.price,
          color: product.color || "",
          category: product.category || "",
          alt: product.alt || "",
          description: product.description || "",
          image: product.image || "",
          href: productUrl,
          url: productUrl,
          site: location.hostname,
        },
        profile: {
          userId: activePersona().userId,
          read: activePersona().read,
          trait: activePersona().trait,
          preBuy: activePersona().preBuy,
          keepLean: activePersona().keepLean,
          mode: state.mode,
          purpose: state.purpose,
          budget: state.budget,
          spent: state.spent,
          gift: isGift(),
          memory: [activePersona().memory || "", learnedMemory()].filter(Boolean).join(" "),
          sizes: learnedSizes(),
          prior: prior
            ? {
                title: prior.title,
                body: prior.body,
                stamp: prior.stamp || null,
                kind: prior.love ? "love" : prior.warn ? "warn" : "neutral",
              }
            : null,
          facts: isDemoSite() ? {} : isPdp() ? pageFacts() : {},
        },
      };
      chrome.runtime.sendMessage({ type: "YOM_ADVISE", payload }, (res) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError || !res?.ok) resolve(null);
        else resolve(res.advice || null);
      });
      const wait = surface === "tile" ? 1200 : 2500;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(null);
      }, wait);
    });
  }

  function applyAdviceToTile(tile, advice) {
    if (!advice || advice.quiet || !advice.title) return false;
    noteTile(
      tile,
      { title: advice.title, body: advice.body, stamp: advice.stamp || "yom" },
      { love: advice.kind === "love", warn: advice.kind === "warn" }
    );
    return true;
  }

  async function liveOnPause(tile) {
    const info = tileInfo(tile);
    info.name = info.name || info.alt || "this piece";

    const prior = state.stamps[info.id];
    if (prior?.title) {
      noteTile(info.root, prior, { love: prior.love, warn: prior.warn });
      return true;
    }

    if (state.budget != null && info.price > remainingBudget()) {
      noteTile(info.root, DATA.tips.overBudget, { warn: true });
      return true;
    }

    const advice = await advise("tile", info);
    if (applyAdviceToTile(info.root, advice)) return true;

    const ev = purposeMeta();
    if (ev?.plp && occasionMatch(info)) {
      noteTile(info.root, ev.plp, { love: true });
      return true;
    }
    return false;
  }

  async function livePdp() {
    if (!isPdp() || !state.mode || isDemoSite()) return false;
    const info = pdpInfo();
    const pageKey = location.pathname;

    if (state.checked[pageKey]) {
      speakOnce(`checked:${pageKey}`, () => {
        paintChecked(info, state.checked[pageKey], "yom · checked");
      });
      return true;
    }
    if (spokenKey === `live:${pageKey}` && document.getElementById("yom-pdp-note")) return true;

    spokenKey = `live:${pageKey}`;
    paintChecked(info, localBrief(info), "yom");
    advise("pdp", info).then((advice) => {
      if (!advice || advice.quiet || location.pathname !== pageKey) return;
      paintChecked(info, mergeBrief(info, advice), "yom");
    });
    return true;
  }

  function pieceLabel(info) {
    const name = cleanProductName(info.name || info.alt || "")
      .replace(/\s+/g, " ")
      .trim();
    if (name.length > 2) return name;
    const color = cleanProductName(info.color || "").trim();
    const kind = kindOf(info);
    if (color) return `${color} ${kind}`;
    if (info.price) return `$${info.price} ${kind}`;
    return kind;
  }

  function kindOf(info) {
    const t = `${info.name || ""} ${info.category || ""} ${info.href || ""} ${info.alt || ""}`.toLowerCase();
    if (/shoe|heel|sandal|boot|mule|loafer|sneaker|flat|slide/.test(t) || /\/shoes\//.test(t)) return "shoes";
    if (/two[- ]?piece|\bset\b/.test(t)) return "set";
    if (/jean|denim/.test(t)) return "jeans";
    if (/dress/.test(t)) return "dress";
    if (/skirt/.test(t)) return "skirt";
    if (/short/.test(t)) return "shorts";
    if (/pant|trouser/.test(t)) return "pants";
    if (/jacket|coat|blazer|outer/.test(t)) return "jacket";
    if (/sweater|cardigan|cashmere/.test(t)) return "knit";
    if (/\btee\b|t-shirt/.test(t)) return "tee";
    if (/shirt|blouse|top/.test(t)) return "top";
    return "piece";
  }

  function fitBits(info) {
    const t = `${info.name || ""} ${info.alt || ""} ${info.color || ""}`.toLowerCase();
    const bits = [];
    if (/oversize/.test(t)) bits.push("oversized");
    if (/crop/.test(t)) bits.push("cropped");
    if (/low[- ]?(rise|waist)/.test(t)) bits.push("low-rise");
    if (/\bmidi\b/.test(t)) bits.push("midi");
    if (/\bmini\b/.test(t)) bits.push("mini");
    if (/\bmaxi\b/.test(t)) bits.push("maxi");
    if (/straight/.test(t)) bits.push("straight");
    if (/wide/.test(t)) bits.push("wide-leg");
    if (/\bknit\b/.test(t)) bits.push("knit");
    if (/\bsilk\b/.test(t)) bits.push("silk");
    if (/cashmere/.test(t)) bits.push("cashmere");
    if (/poplin/.test(t)) bits.push("poplin");
    if (/linen/.test(t)) bits.push("linen");
    if (/satin/.test(t)) bits.push("satin");
    if (/leather/.test(t)) bits.push("leather");
    return bits;
  }

  function takeOf(title, body, stamp, extra = {}) {
    return {
      tip: { title, body, stamp, closetKey: extra.closetKey || null },
      love: !!extra.love,
      warn: !!extra.warn,
    };
  }

  function specificTake(info) {
    const color = cleanProductName(info.color || "").trim().toLowerCase();
    const price = Number(info.price) || 0;
    const kind = kindOf(info);
    const label = pieceLabel(info);
    const bits = fitBits(info);
    const fabric = bits.find((b) =>
      /silk|cashmere|poplin|linen|satin|leather|knit|denim/.test(b)
    );
    const cut = bits.find((b) =>
      /oversized|cropped|low-rise|midi|mini|maxi|straight|wide-leg/.test(b)
    );
    const rem = remainingBudget();
    const ev = purposeMeta();

    if (state.budget != null && price > rem) {
      return takeOf(
        "this would put you over",
        rem > 0 ? `$${price} against $${rem} left.` : "you're already at the cap.",
        "over budget",
        { warn: true }
      );
    }

    if (kind === "shoes") {
      return takeOf(
        "this shape isn’t really you",
        "the shoes you keep are rounder. this shape never makes it out.",
        "skip the toe",
        { warn: true }
      );
    }

    if (isGreenProduct(info)) {
      return takeOf(
        "green is your color",
        "you've kept every green piece. this one would too.",
        "your color",
        { love: true, closetKey: "green" }
      );
    }

    if (ev?.kind === "wedding" && kind === "dress") {
      return takeOf(
        "right for the wedding",
        color ? `${color} reads right for sofia’s day.` : "silhouette and formality both fit.",
        "for the wedding",
        { love: true }
      );
    }

    if (kind === "set" || /maya/i.test(label)) {
      return takeOf(
        "you have something really similar",
        "same silhouette you already own. you don't need a second.",
        "in your closet",
        { closetKey: "similar" }
      );
    }

    if (!isGift() && state.spent > 0 && /top|tee|knit/.test(kind)) {
      return takeOf(
        "perfect with your jaded london shorts",
        color ? `${color} against those — already an outfit.` : "already an outfit with what's in the bag.",
        "with your shorts",
        { love: true, closetKey: "shorts" }
      );
    }

    if (fabric === "cashmere") {
      return takeOf(
        "you'd keep this",
        price ? `cashmere at $${price} — a fabric you actually keep.` : "this is the fabric you don't return.",
        "you'd keep it",
        { love: true }
      );
    }
    if (fabric === "silk" || fabric === "satin") {
      return takeOf(
        "people aren’t loving the material",
        `${fabric} looks beautiful, and high-maintenance. you research this and then don't wear it.`,
        "think twice",
        { warn: true }
      );
    }
    if (fabric === "poplin") {
      return takeOf(
        "you already own this job",
        "crisp poplin — you'll think you need it and it'll hang next to the ones you already have.",
        "you own this"
      );
    }

    if (kind === "jeans") {
      return takeOf(
        "your closet already does this",
        cut ? `another ${cut} jean. you're filling a hole that isn't there.` : "you're filling a hole that isn't there.",
        "you have this"
      );
    }

    if (kind === "skirt") {
      if (cut === "midi") {
        return takeOf(
          "you'd actually wear this",
          color ? `midi in ${color} — unlike the minis you skip.` : "midi length — you'd actually wear this.",
          "you'd wear it",
          { love: true }
        );
      }
      return takeOf(
        "needs a reason",
        "a skirt you'll need a reason for. do you have one?",
        "needs a reason"
      );
    }

    if (kind === "tee") {
      return takeOf(
        "maybe skip",
        cut === "oversized"
          ? "oversized tee — you'll live in it or never pick it up."
          : "a tee. you already think you have nothing to wear with a drawer of these.",
        "maybe skip"
      );
    }

    if (kind === "dress") {
      if (fabric === "knit") {
        return takeOf(
          "easy yes",
          "knit dress — easy, and you'd actually put it on a Tuesday.",
          "easy yes",
          { love: true }
        );
      }
      return takeOf(
        ev ? `only if it’s for ${ev.label}` : "needs a date",
        ev
          ? `this only earns a yes if it's for ${ev.label}.`
          : "a dress without a date on it tends to sit.",
        ev ? `for ${ev.label}` : "needs a date"
      );
    }

    if (kind === "pants") {
      return takeOf(
        "compare first",
        cut === "cropped"
          ? "cropped — check it against the trousers you already rotate."
          : "another pant. map it against what you already wear.",
        "compare first"
      );
    }

    if (kind === "knit" || kind === "top") {
      return takeOf(
        "closet check",
        kind === "top" && fabric === "knit"
          ? "a knit top. check it against the ones you already rotate."
          : "you'll reach for this or ignore it. you already own the one you reach for.",
        "closet check"
      );
    }

    if (kind === "jacket") {
      return takeOf(
        "needs a job",
        "outerwear only pays off if it does a job the closet doesn't. does it?",
        "needs a job"
      );
    }

    if (kind === "shorts" && !isGift()) {
      return takeOf(
        "you just bought this",
        "you just bought the jaded london pair. this is how duplicates happen.",
        "you just bought this",
        { warn: true, closetKey: "shorts" }
      );
    }

    const named = [
      takeOf(
        "not a gap",
        color ? `${color} doesn't make it a gap in the closet.` : "same job as something you already own.",
        "not a gap"
      ),
      takeOf(
        "slow down",
        price ? `$${price}. would you still want it in three weeks?` : "would you still want it in three weeks?",
        "slow down",
        { warn: true }
      ),
      takeOf(
        "maybe yes",
        "this actually looks like you'd wear it, not just buy it.",
        "maybe yes",
        { love: true }
      ),
    ];
    return named[hashStr(String(info.id || label)) % named.length];
  }

  function opinionFor(info) {
    return specificTake(info);
  }

  function seedOpinions() {
    findTiles().forEach((tile) => {
      try {
        const info = tileInfo(tile);
        info.name = info.name || info.alt || "this piece";
        const take = opinionFor(info);
        if (!take?.tip?.title) return;
        const mark = {
          stamp: take.tip.stamp || "yom",
          title: take.tip.title,
          body: take.tip.body || "",
          love: !!take.love,
          warn: !!take.warn,
          closetKey: take.tip.closetKey || null,
        };
        if (!state.stamps[info.id] || state.stamps[info.id].title !== mark.title) {
          state.stamps[info.id] = mark;
        }
      } catch (err) {
        console.warn("yom seed", err);
      }
    });
    applyBudgetFlags();
  }

  function demoOnPause(tile) {
    const info = tileInfo(tile);
    info.name = info.name || info.alt || "this piece";
    const take = opinionFor(info);
    if (!take?.tip) return;
    noteTile(info.root, take.tip, { love: !!take.love, warn: !!take.warn });
  }

  function onPause(tile) {
    try {
      if (state.mode === "sos") {
        if (isPdp()) return;
        if (askEl?.querySelector?.(".yom-fb-open")) return;
        paintSos(tileInfo(tile));
      } else demoOnPause(tile);
    } catch (err) {
      console.warn("yom pause", err);
    }
    try {
      applyBudgetFlags();
    } catch {
      /* ignore */
    }
  }

  function enterCard(card) {
    if (!card) return;
    if (liveNote?.dataset?.yomHold === "1") return;
    if (hoverTile === card) return;
    hoverTile = card;
    onPause(card);
  }

  function leaveCard() {
    if (liveNote?.dataset?.yomHold === "1") return;
    if (liveNote?.matches?.(":hover")) return;
    if (!hoverTile && !liveNote) return;
    hoverTile = null;
    clearExpandedNotes();
  }

  function startHoverWatch() {
    if (document.documentElement.dataset.yomHover === "120") return;
    document.documentElement.dataset.yomHover = "120";
    const onMove = (e) => {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (
        path.some(
          (n) =>
            n?.classList?.contains?.("yom-tile-note") ||
            n?.classList?.contains?.("yom-fb") ||
            n?.classList?.contains?.("yom-ask") ||
            n?.classList?.contains?.("yom-panel") ||
            n?.classList?.contains?.("yom-pdp-note") ||
            n?.classList?.contains?.("yom-cart-panel") ||
            n?.classList?.contains?.("yom-chip") ||
            n?.classList?.contains?.("yom-fb-chip") ||
            n?.classList?.contains?.("yom-fb-btn") ||
            n?.classList?.contains?.("yom-sos-toggle")
        )
      ) {
        return;
      }
      const card = cardAtEvent(e);
      if (card) enterCard(card);
      else leaveCard();
    };
    document.addEventListener("pointerover", onMove, true);
    document.addEventListener("mouseover", onMove, true);
  }

  function bindTiles() {
    findTiles().forEach((tile) => {
      tileHost(tile).classList.add("yom-tile-host");
    });
    hideStamps();
    seedOpinions();
    applyBudgetFlags();
    if (state.mode === "sos" && !askEl && !state.panelOpen && !isPdp()) runSos();
  }

  startHoverWatch();
  window.addEventListener("scroll", syncMarkPositions, true);
  window.addEventListener("resize", syncMarkPositions);
  try {
    bindTiles();
  } catch (err) {
    console.warn("yom bind", err);
  }

  function yomNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return !!(
      node.id === "yom-root" ||
      node.id === "yom-pdp-note" ||
      node.id === "yom-cart-panel" ||
      node.id === "yom-notes-layer" ||
      node.closest?.("#yom-root, #yom-notes-layer, .yom-pdp-note, .yom-cart-panel") ||
      node.classList?.contains("yom-stamp") ||
      node.classList?.contains("yom-tile-note") ||
      node.classList?.contains("yom-budget-flag")
    );
  }

  function speakOnce(key, fn) {
    const existing = document.getElementById("yom-pdp-note");
    if (spokenKey === key && existing) return;
    spokenKey = key;
    fn();
  }

  // ── PDP presence — follows session + memory ──────────────────
  function purposeAskChips(keepNote) {
    return {
      chips: [
        ...DATA.events.map((e) => ({
          label: e.label,
          onPick: () => {
            state.mode = "purpose";
            state.purpose = e.label;
            saveState();
            enterPurposeOnPdp();
          },
        })),
        { label: "just browsing", onPick: () => pdpNote(keepNote, { closetKey: keepNote.closetKey }) },
      ],
      otherChoices: [
        {
          label: "a work thing",
          onPick: () => {
            state.mode = "purpose";
            state.purpose = "a work thing";
            saveState();
            enterPurposeOnPdp();
          },
        },
        {
          label: "a date",
          onPick: () => {
            state.mode = "purpose";
            state.purpose = "a date";
            saveState();
            enterPurposeOnPdp();
          },
        },
        { label: "nothing specific", onPick: () => pdpNote(keepNote, { closetKey: keepNote.closetKey }) },
      ],
    };
  }

  async function renderPdpPresence() {
    if (!isPdp() || !state.mode) return;
    if (state.mode === "sos") closeAsk();
    if (isDemoSite()) {
      demoPdp();
      return;
    }
    livePdp().catch(() => {});
  }

  function demoPdp() {
    const info = pdpInfo();
    const pageKey = location.pathname;
    const ev = purposeMeta();

    if (state.checked[pageKey] || state.checking) return;

    if (isShoeProduct(info) && !isGift()) {
      speakOnce(`shoes:${pageKey}`, () => {
        pdpNote(DATA.tips.shoes, {
          alts: DATA.shoeAlts,
          chips: [
            { label: "i don’t need shoes", onPick: () => skipShoes() },
            { label: "i’ll look", onPick: () => pdpNote(DATA.tips.shoes, { alts: DATA.shoeAlts }) },
          ],
          otherChoices: [
            { label: "maybe later", onPick: () => skipShoes() },
            { label: "not this trip", onPick: () => skipShoes() },
          ],
        });
      });
      return;
    }

    if (ev) {
      speakOnce(`purpose:${pageKey}`, () => enterPurposeOnPdp());
      return;
    }

    if (!isGift() && isGreenProduct(info)) {
      speakOnce(`green:${pageKey}`, () => {
        pdpNote(DATA.tips.forWhat, { closetKey: "green", ...purposeAskChips(DATA.tips.green) });
      });
      return;
    }

    if (state.spent > 0 && pairingMatch(info) && !isGift()) {
      speakOnce(`pair:${pageKey}`, () => {
        pdpNote(DATA.tips.pairing, { closetKey: "shorts" });
        runCheck();
      });
      return;
    }

    speakOnce(`pdp:${pageKey}`, () => runCheck());
  }

  function skipShoes() {
    spokenKey = null;
    saveState();
    clearPdp();
    whisper(DATA.tips.skipShoes);
  }

  // ── cart ─────────────────────────────────────────────────────
  function renderCart() {
    document.querySelector("#yom-cart-panel")?.remove();
    if (!isCart() || !state.mode) return;

    const host =
      document.querySelector(".cart-page, .cart, #cart-table, .cart__body, main, .container") ||
      document.body;
    const panelEl = el("div", { class: "yom-ui yom-cart-panel", id: "yom-cart-panel" });
    const names =
      state.cartNames.length > 0
        ? state.cartNames
        : [...document.querySelectorAll(".line-item-name, .product-name, [data-product-component='name']")]
            .map((n) => n.textContent.trim())
            .filter(Boolean)
            .slice(0, 3);

    const ev = purposeMeta();
    const rows = (names.length ? names : ["Your picks"]).map((name) => {
      const checked = Object.values(state.checked || {}).find((c) => {
        const hay = `${c.title || ""} ${c.body || ""}`.toLowerCase();
        return name && hay.includes(String(name).toLowerCase().slice(0, 10));
      });
      if (Number.isFinite(Number(checked?.regret))) {
        return {
          name,
          score: Number(checked.regret),
          tone: regretTone(checked.regret),
          label: formatRegretLabel(Number(checked.regret)),
        };
      }
      const kind = /dress/i.test(name) ? "dress" : "pairing";
      const keep = DATA.keep[kind] || DATA.keep.other;
      const score = Math.max(8, 100 - keep.score);
      return { name, score, tone: regretTone(score), label: formatRegretLabel(score) };
    });

    const contextLine = ev
      ? `for ${ev.label}${ev.when ? ` · ${ev.when}` : ""}`
      : isGift()
        ? "picked as a gift"
        : "from browsing";
    const budgetLine =
      state.budget != null ? ` · $${remainingBudget()} left of $${state.budget}` : "";

    panelEl.innerHTML = `
      <div class="yom-pdp-kicker">yom</div>
      <h3>regret score</h3>
      <p>${contextLine}${budgetLine}. size, reviews, shipping, and whether you’d still want this in three weeks.</p>
      ${rows
        .map(
          (r) => `
        <div class="yom-keep-row yom-regret ${r.tone}">
          <div>
            <strong>${r.name}</strong>
            <div class="yom-keep-bar"><span style="width:${r.score}%"></span></div>
            <span class="yom-regret-label">${r.label}</span>
          </div>
          <div class="yom-keep-score">${r.score}</div>
        </div>`
        )
        .join("")}
      <div class="yom-chips" data-chips></div>
    `;
    host.prepend(panelEl);
    attachChips(
      panelEl.querySelector("[data-chips]"),
      [
        {
          label: "checkout",
          onPick: () => {
            state.checkedOut = true;
            saveState();
            whisper(
              ev
                ? { title: "go for it", body: `this holds up for ${ev.label}.` }
                : DATA.tips.done,
              4000
            );
          },
        },
        {
          label: "keep looking",
          onPick: () => whisper({ title: "i’ll stay on the bag" }),
        },
      ],
      [{ label: "not yet", onPick: () => whisper({ title: "no rush" }) }]
    );
  }

  function pagePath(href) {
    try {
      return new URL(href, location.origin).pathname;
    } catch {
      return href;
    }
  }

  function render() {
    dockBuddy();
    renderPanel();
    bindTiles();
    applyBudgetFlags();
    if (isPdp()) renderPdpPresence();
    else clearPdp();
    if (isCart()) renderCart();
  }

  window.addEventListener("resize", () => {
    dockBuddy();
  });

  let lastHref = location.href;
  let bindTimer = null;
  const mo = new MutationObserver((mutations) => {
    ensureMounted();
    if (location.href !== lastHref) {
      const samePath = pagePath(location.href) === pagePath(lastHref);
      lastHref = location.href;
      state.panelOpen = false;
      closeAsk();
      clearWhisper();
      if (!samePath) {
        spokenKey = null;
        clearExpandedNotes();
      }
      render();
      if (state.mode === "sos" && !isPdp()) runSos();
      return;
    }
    const foreign = mutations.some((m) =>
      [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1 && !yomNode(n))
    );
    if (!foreign) return;
    if (bindTimer) return;
    bindTimer = setTimeout(() => {
      bindTimer = null;
      bindTiles();
    }, 250);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[LIVE_KEY]) return;
    liveAccount = changes[LIVE_KEY].newValue || null;
    if (applyLivePersona()) return;
    const demo = demoPersona();
    if (!demo) return;
    state.userId = demo.userId || state.userId || "yom-ban";
    state.trait = demo.trait;
    state.preBuy = demo.preBuy;
    state.keepLean = demo.keepLean;
    state.read = demo.read || composeRead(demo.trait, demo.preBuy, demo.keepLean);
  });

  async function boot() {
    try {
      if (!(await shouldRun())) {
        host.remove();
        return;
      }
    } catch {
      host.remove();
      return;
    }
    armed = true;
    try {
      await loadLiveAccount();
      state = await loadState();
    } catch {
      state = defaultState();
    }
    if (!applyLivePersona()) {
      const demo = demoPersona();
      if (demo) {
        state.userId = demo.userId || state.userId || "yom-ban";
        state.trait = demo.trait;
        state.preBuy = demo.preBuy;
        state.keepLean = demo.keepLean;
        state.read = demo.read || composeRead(demo.trait, demo.preBuy, demo.keepLean);
      }
    }
    dockBuddy(true);
    startHoverWatch();
    try {
      render();
    } catch (err) {
      console.warn("yom boot", err);
      try {
        bindTiles();
      } catch {
        /* ignore */
      }
    }
  }

  boot();
})();
