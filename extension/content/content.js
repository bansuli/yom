(() => {
  if (window.__YOM_LOADED__) return;
  window.__YOM_LOADED__ = true;

  const DATA = window.YOM_DEMO;
  const EXTRACT = window.YOM_EXTRACT;
  const USER_KEY = "yom-user";
  const STORAGE_KEY = "yom-companion-v4";
  const PROFILE_KEY = "yom-profile";
  const PAUSE_MS = 1000;
  const NOTE_HOLD_MS = 3800;
  const GREEN_WORDS =
    /\b(green|emerald|forest|jade|moss|olive|sage|evergreen|tarragon|fern|kelly|pistachio)\b/i;
  const SHOE_WORDS = /\b(shoe|heel|sandal|boot|mule|pump|loafer|sneaker|slingback)\b/i;

  const defaultState = () => ({
    mode: null, // browse | purpose | gift
    purpose: null,
    budget: null,
    spent: 0,
    cartNames: [],
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
  });

  const PROFILE_FIELDS = [
    "mode",
    "purpose",
    "budget",
    "spent",
    "cartNames",
    "insightN",
    "checked",
    "budgetAsked",
    "checkedOut",
  ];
  const USER_FIELDS = ["userId", "trait", "preBuy", "keepLean", "read"];

  let state = defaultState();
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
    return isDemoSite() ? DATA.persona?.demo : null;
  }

  function activePersona() {
    const demo = demoPersona();
    if (demo) {
      return {
        userId: demo.userId || state.userId,
        trait: demo.trait,
        preBuy: demo.preBuy,
        keepLean: demo.keepLean,
        read: demo.read,
        memory: demo.memory,
      };
    }
    return {
      userId: state.userId,
      trait: state.trait,
      preBuy: state.preBuy,
      keepLean: state.keepLean,
      read: state.read,
      memory: "",
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
    const forced = await chrome.storage.local.get("yomForceHost");
    if (forced.yomForceHost && host.endsWith(forced.yomForceHost)) return true;
    if (isDemoSite()) return true;
    if (EXTRACT.skipHost(host)) return false;
    return EXTRACT.looksLikeShop();
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
    if (isDemoSite()) {
      return [...document.querySelectorAll(".product-tile-wrapper, .product-tile")];
    }
    const tiles = EXTRACT.findTiles();
    tiles.forEach((t) => t.classList.add("yom-tile-host"));
    return tiles;
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

  function parseTracking(node) {
    const anchor = node.querySelector?.("[data-tracking]") || node.closest?.("[data-tracking]");
    const raw = anchor?.getAttribute("data-tracking");
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
    const host =
      tile.closest(".product-tile-wrapper") ||
      tile.closest(".product-tile") ||
      tile;
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
    const price = EXTRACT.parsePrice
      ? EXTRACT.parsePrice(
          product?.price ||
            product?.item_price ||
            host.querySelector("[itemprop='price']")?.getAttribute("content") ||
            host.querySelector(".price--formated, .price__sales .value, [data-product-component='price']")
              ?.textContent ||
            ""
        )
      : Number(
          product?.price ||
            host.querySelector("[itemprop='price']")?.getAttribute("content") ||
            0
        );
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
    const media = tile.querySelector(
      ".product-tile__media, .product-tile__media-container, .tile-image"
    );
    if (media) return media;
    const img = tile.querySelector("picture, img");
    if (!img) return tile;
    const host = img.closest("[class*='media'], [class*='image'], [class*='Image']") || img.parentElement;
    return host || tile;
  }

  // ── shell ────────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = "yom-root";
  host.setAttribute("data-yom-host", "1");
  host.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;z-index:2147483647;pointer-events:none;overflow:visible;background:transparent;";

  const shadow = host.attachShadow({ mode: "open" });
  const shadowCss = document.createElement("style");
  shadowCss.textContent = `
    :host { display: block; position: fixed; right: 0; bottom: 0; width: 0; height: 0; overflow: visible; z-index: 2147483647; pointer-events: none; }
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

  function mountHost() {
    const parent = document.body || document.documentElement;
    if (parent && host.parentElement !== parent) parent.appendChild(host);
  }
  mountHost();

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
    mountHost();
    host.style.display = "block";
    host.style.visibility = "visible";
    host.style.opacity = "1";
    buddy.style.display = "block";
    buddy.style.visibility = "visible";
    buddy.style.opacity = "1";
  }

  function dockBuddy(animatePop = false) {
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

  dockBuddy(true);

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
        state.mode === "gift"
          ? "a gift"
          : state.mode === "browse"
            ? "browsing"
            : state.purpose || "something coming up";
      modePill.innerHTML = `<span class="dot"></span><span>${label}</span>`;
      modePill.style.left = "auto";
      modePill.style.top = "auto";
      modePill.style.right = `${gutter + buddySize + 8}px`;
      modePill.style.bottom = `${gutter + 10}px`;
    }

    if (whisperEl) {
      whisperEl.style.left = "auto";
      whisperEl.style.top = "auto";
      whisperEl.style.right = `${gutter}px`;
      whisperEl.style.bottom = `${gutter + buddySize + 12}px`;
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
  }

  function attachChips(host, chips, otherChoices) {
    const paint = (list, extras) => {
      host.innerHTML = "";
      list.forEach((c) => {
        const btn = el(
          "button",
          {
            class: `yom-chip${c.block ? " block" : ""}${c.ghost ? " yom-chip-other" : ""}${c.on ? " on" : ""}`,
            type: "button",
          },
          c.label
        );
        if (c.sub) btn.appendChild(el("small", {}, c.sub));
        btn.addEventListener("click", () => c.onPick());
        host.appendChild(btn);
      });
      if (extras && extras.length) {
        const other = el("button", { class: "yom-chip yom-chip-other", type: "button" }, "other");
        other.addEventListener("click", () => paint(extras, null));
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

  // ── in-page tile marks ───────────────────────────────────────
  function clearExpandedNotes() {
    document.querySelectorAll(".yom-tile-note").forEach((n) => n.remove());
    noteTimers.forEach((t) => clearTimeout(t));
    noteTimers.clear();
  }

  function clearAllMarks() {
    clearExpandedNotes();
    document.querySelectorAll(".yom-stamp, .yom-budget-flag").forEach((n) => n.remove());
    document.querySelectorAll(".yom-tile-love, .yom-tile-dim").forEach((n) => {
      n.classList.remove("yom-tile-love", "yom-tile-dim");
    });
  }

  function applyStamp(tile, mark) {
    const host = mediaHost(tile);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const wrap = tile.closest(".product-tile-wrapper, .yom-tile-host") || tile;
    wrap.classList.toggle("yom-tile-love", !!mark.love);
    tile.classList.toggle("yom-tile-love", !!mark.love);
    const existing = host.querySelector(".yom-stamp");
    const cls = `yom-stamp${mark.love ? " love" : ""}${mark.warn ? " warn" : ""}`;
    if (existing && existing.textContent === mark.stamp && existing.className === cls) return;
    existing?.remove();
    host.appendChild(el("div", { class: cls }, mark.stamp));
  }

  function restampTiles() {
    findTiles().forEach((tile) => {
      const info = tileInfo(tile);
      const mark = state.stamps[info.id];
      if (mark) applyStamp(info.root, mark);
    });
  }

  function noteTile(tile, tip, { love = false, warn = false } = {}) {
    const info = tileInfo(tile);
    if (!info.name) return;
    clearExpandedNotes();

    const mark = {
      stamp: tip.stamp || "yom",
      love,
      warn,
      closetKey: tip.closetKey || null,
    };
    state.stamps[info.id] = mark;
    saveState();
    applyStamp(info.root, mark);

    const host = mediaHost(info.root);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const closet = tip.closetKey ? DATA.closet[tip.closetKey] : null;
    const note = el("div", { class: "yom-tile-note yom-ui" });
    note.innerHTML = `
      ${closet ? `<img src="${asset(closet.file)}" alt="" />` : ""}
      <div>
        <strong>${tip.title}</strong>
        <span>${closet ? closet.note : tip.body || ""}</span>
      </div>
    `;
    host.appendChild(note);
    pulseBuddy();

    const timer = setTimeout(() => {
      note.classList.add("out");
      setTimeout(() => note.remove(), 360);
      noteTimers.delete(info.id);
    }, NOTE_HOLD_MS);
    noteTimers.set(info.id, timer);
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
    if (!node || node.closest?.("#yom-root, .yom-pdp-note, .yom-cart-panel, .yom-ask, .yom-panel")) {
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

  function pdpNote(tip, { closetKey, resolve, alts, chips, otherChoices, checking = false, kicker = "yom" } = {}) {
    const closet = closetKey ? DATA.closet[closetKey] : tip.closetKey ? DATA.closet[tip.closetKey] : null;
    const node = el("div", { class: `yom-ui yom-pdp-note${checking ? " checking" : ""}` });
    node.innerHTML = `
      <div class="yom-pdp-kicker">${kicker}</div>
      <h3>${tip.title}</h3>
      ${tip.body ? `<p>${tip.body}</p>` : ""}
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
    `;
    mountPdp(node);
    if (chips?.length) attachChips(node.querySelector("[data-chips]"), chips, otherChoices);
    pulseBuddy();
    return node;
  }

  // ── budget dimming on the grid ───────────────────────────────
  function clearBudgetFlags() {
    document.querySelectorAll(".yom-budget-flag").forEach((n) => n.remove());
    document.querySelectorAll(".yom-tile-dim").forEach((n) => n.classList.remove("yom-tile-dim"));
  }

  function applyBudgetFlags() {
    if (state.budget == null) {
      if (document.querySelector(".yom-budget-flag, .yom-tile-dim")) clearBudgetFlags();
      return;
    }
    const rem = remainingBudget();
    findTiles().forEach((tile) => {
      const info = tileInfo(tile);
      const wrap = info.root.closest(".product-tile-wrapper, .yom-tile-host") || info.root;
      const host = mediaHost(info.root);
      const over = info.price && info.price > rem;
      wrap.classList.toggle("yom-tile-dim", over);
      info.root.classList.toggle("yom-tile-dim", over);
      if (!over) {
        host.querySelector(".yom-budget-flag")?.remove();
        return;
      }
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      if (!host.querySelector(".yom-budget-flag")) {
        host.appendChild(el("div", { class: "yom-budget-flag" }, "over budget"));
      }
    });
  }

  function setBudget(value) {
    state.budget = value;
    saveState();
    closeAsk();
    render();
    if (value != null) whisper(DATA.tips.budgetOn);
  }

  function addToBag(name, price, fallbackName) {
    const label = name || fallbackName;
    if (!state.cartNames.includes(label)) {
      state.spent += price;
      state.cartNames.push(label);
    }
    saveState();
  }

  // ── activation / questions ───────────────────────────────────
  buddy.addEventListener("click", () => {
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

  modePill.addEventListener("click", () => {
    state.panelOpen = !state.panelOpen;
    renderPanel();
  });

  function openModePicker() {
    saveState();
    ask({
      title: "what’s the vibe?",
      body: "i’ll hang on the page. no chat unless i need a tap.",
      options: [
        { label: "just browsing", onPick: () => startBrowseMode() },
        { label: "something coming up", onPick: () => openPurposePicker() },
      ],
      otherChoices: [
        { label: "just looking around", onPick: () => startBrowseMode() },
        { label: "a gift", onPick: () => startGiftMode() },
        { label: "not sure yet", onPick: () => startBrowseMode() },
      ],
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

  function finishSession(mode, purpose, budget) {
    state.mode = mode;
    state.purpose = purpose;
    state.budget = budget;
    state.panelOpen = false;
    saveState();
    if (!isDemoSite() && !hasPersona()) {
      askPersona();
      return;
    }
    closeAsk();
    dockBuddy(true);
    render();
    whisper(welcomeTip());
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
      { label: "just browsing", value: "browse", on: state.mode === "browse" },
      { label: "a gift", value: "gift", on: state.mode === "gift" },
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

    const persona = activePersona();
    const readHtml = persona.read ? `<p class="yom-read">${persona.read}</p>` : "";
    const spentHtml = state.spent
      ? `bag so far · $${state.spent}${state.budget != null ? ` · $${remainingBudget()} left` : ""}`
      : "";
    const newYomHtml = isDemoSite()
      ? ""
      : `<button type="button" class="yom-new-yom" data-new-yom>new yom</button>`;

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
      ${readHtml}
      ${spentHtml ? `<div class="yom-meta">${spentHtml}</div>` : ""}
      ${newYomHtml}
    `;

    panel.querySelector("[data-close]").addEventListener("click", () => {
      state.panelOpen = false;
      saveState();
      renderPanel();
    });

    panel.querySelector("[data-new-yom]")?.addEventListener("click", () => {
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

  function checkResult(info) {
    const ev = purposeMeta();
    if (ev?.story === "wedding" && (isDress(info) || isGreenProduct(info))) return ev.check;
    if (ev?.check) return ev.check;
    if (isDress(info) && hashStr(info.name) % 3 === 0) return DATA.reviews.long;
    return hashStr(info.name || location.pathname) % 2 === 0 ? DATA.reviews.strong : DATA.reviews.mixed;
  }

  function lookIntoChips(tip, extras = {}) {
    return {
      ...extras,
      chips: [
        { label: "look into this", onPick: () => runCheck() },
        { label: "not now", onPick: () => pdpNote(tip, extras) },
      ],
      otherChoices: [
        { label: "remind me later", onPick: () => pdpNote(tip, extras) },
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
    const tip = deliveryTip();
    pdpNote(tip, lookIntoChips(tip));
  }

  function runCheck() {
    const info = pdpInfo();
    const pageKey = location.pathname;
    state.checking = true;
    saveState();
    pdpNote(DATA.tips.checking, { checking: true, kicker: "yom · looking" });

    const finish = (result) => {
      state.checking = false;
      state.checked[pageKey] = result;
      saveState();
      if (location.pathname !== pageKey) return;
      pdpNote(result, { resolve: result.resolve, kicker: "yom · checked" });
    };

    advise("check", info).then((advice) => {
      if (advice && !advice.quiet && advice.title) {
        finish({
          title: advice.title,
          body: advice.body,
          resolve: advice.resolve,
          stamp: advice.stamp,
        });
        return;
      }
      finish(checkResult(info));
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
    addToBag(info.name, info.price || 0, info.name || "piece");
    afterAdded(info);
  }

  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("#yom-root, .yom-pdp-note, .yom-cart-panel, .yom-ask, .yom-panel")) return;
      const btn = e.target.closest("button, a, input");
      if (isAddToBagTarget(btn)) onNativeAdd();
    },
    true
  );

  function advise(surface, product) {
    return new Promise((resolve) => {
      const productUrl = product.href || (isPdp() ? location.href : "");
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
          memory: activePersona().memory || "",
        },
      };
      chrome.runtime.sendMessage({ type: "YOM_ADVISE", payload }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) resolve(null);
        else resolve(res.advice || null);
      });
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
    if (!info.name) return true;
    if (state.stamps[info.id]) return true;

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
    if (!isPdp() || !state.mode) return false;
    const info = pdpInfo();
    const pageKey = location.pathname;

    if (state.checked[pageKey]) {
      speakOnce(`checked:${pageKey}`, () => {
        const result = state.checked[pageKey];
        pdpNote(result, { resolve: result.resolve, kicker: "yom · checked" });
      });
      return true;
    }
    if (state.checking) return true;
    if (spokenKey === `live:${pageKey}` && document.getElementById("yom-pdp-note")) return true;

    spokenKey = `live:${pageKey}`;
    const advice = await advise("pdp", info);
    if (location.pathname !== pageKey) return true;
    if (advice && !advice.quiet && advice.title) {
      const tip = { title: advice.title, body: advice.body, stamp: advice.stamp };
      const extras = { resolve: advice.resolve, kicker: "yom" };
      if (advice.checkable) pdpNote(tip, lookIntoChips(tip, extras));
      else pdpNote(tip, extras);
      return true;
    }
    spokenKey = null;
    return false;
  }

  function demoOnPause(tile) {
    const info = tileInfo(tile);
    if (!info.name) return;
    if (state.stamps[info.id]) return;

    if (state.budget != null && info.price > remainingBudget()) {
      noteTile(info.root, DATA.tips.overBudget, { warn: true });
      return;
    }

    if (!isGift() && isGreenProduct(info)) {
      state.insightN += 1;
      saveState();
      noteTile(info.root, DATA.tips.green, { love: true });
      return;
    }

    const ev = purposeMeta();
    if (ev?.plp && occasionMatch(info)) {
      state.insightN += 1;
      saveState();
      noteTile(info.root, ev.plp, { love: true });
      return;
    }

    if (!isGift() && state.spent > 0 && pairingMatch(info)) {
      noteTile(info.root, DATA.tips.pairing, { love: true });
      return;
    }

    if (isGift()) {
      noteTile(info.root, DATA.tips.material, { warn: true });
      return;
    }

    if (state.insightN === 0) {
      state.insightN = 1;
      saveState();
      noteTile(info.root, DATA.tips.similar);
      return;
    }
    if (state.insightN === 1) {
      state.insightN = 2;
      saveState();
      noteTile(info.root, DATA.tips.material, { warn: true });
      return;
    }

    const lane = hashStr(info.id) % 2;
    noteTile(info.root, lane === 0 ? DATA.tips.similar : DATA.tips.material, { warn: lane === 1 });
  }

  async function onPause(tile) {
    if (!state.mode) return;
    const applied = await liveOnPause(tile);
    if (applied) return;
    if (isDemoSite()) demoOnPause(tile);
  }

  function bindTiles() {
    findTiles().forEach((tile) => {
      if (tile.dataset.yomBound) return;
      tile.dataset.yomBound = "1";
      const target = tile.classList.contains("product-tile-wrapper")
        ? tile
        : tile.closest(".product-tile-wrapper") || tile;

      target.addEventListener("mouseenter", () => {
        if (!state.mode) return;
        hoverTile = target;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          if (hoverTile === target) onPause(target);
        }, PAUSE_MS);
      });

      target.addEventListener("mouseleave", () => {
        if (hoverTile === target) {
          clearTimeout(hoverTimer);
          hoverTile = null;
        }
      });
    });
    restampTiles();
    applyBudgetFlags();
  }

  function yomNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return !!(
      node.id === "yom-root" ||
      node.id === "yom-pdp-note" ||
      node.id === "yom-cart-panel" ||
      node.closest?.("#yom-root, .yom-pdp-note, .yom-cart-panel") ||
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
    const applied = await livePdp();
    if (applied) return;
    if (isDemoSite()) demoPdp();
    else if (purposeMeta()) enterPurposeOnPdp();
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
        setTimeout(() => {
          if (location.pathname === pageKey) runCheck();
        }, 900);
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
      const kind = /dress/i.test(name) ? "dress" : "pairing";
      return { name, keep: DATA.keep[kind] || DATA.keep.other };
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
      <h3>keep confidence</h3>
      <p>${contextLine}${budgetLine}. a read on sizing, reviews, closet, and what you told me.</p>
      ${rows
        .map(
          (r) => `
        <div class="yom-keep-row">
          <div>
            <strong>${r.name}</strong>
            <div class="yom-keep-bar"><span style="width:${r.keep.score}%"></span></div>
            <span style="font-size:12px;color:#5a5a5a">${r.keep.label}</span>
          </div>
          <div class="yom-keep-score">${r.keep.score}</div>
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
      return;
    }
    const foreign = mutations.some((m) =>
      [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1 && !yomNode(n))
    );
    if (foreign) bindTiles();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  async function boot() {
    try {
      state = await loadState();
    } catch {
      state = defaultState();
    }
    dockBuddy(true);
    render();
  }

  boot();
})();
