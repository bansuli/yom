(() => {
  if (window.__YOM_LOADED__) return;
  window.__YOM_LOADED__ = true;

  const DATA = window.YOM_DEMO;
  const STORAGE_KEY = "yom-companion-v4";
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
  });

  let state = loadState();
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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    state = defaultState();
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

  function asset(file) {
    return chrome.runtime.getURL(`assets/${file}`);
  }

  function isPdp() {
    return /\/products\//.test(location.pathname);
  }

  function isCart() {
    return /^\/cart\/?$/.test(location.pathname);
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

  function tileInfo(tile) {
    const root =
      tile.closest(".product-tile-wrapper") ||
      tile.closest(".product-tile") ||
      tile;
    const nameEl = root.querySelector('[data-product-component="name"]');
    const priceEl =
      root.querySelector('[itemprop="price"]') ||
      root.querySelector(".price--formated, .price__sales .value");
    const tracking = parseTracking(root);
    const product =
      tracking?.trackObject?.ecommerce?.click?.products?.[0] ||
      tracking?.ecommerce?.click?.products?.[0] ||
      null;
    const name = (nameEl?.textContent || product?.name || "").trim();
    const color = (product?.dimension1 || "").trim();
    const price = Number(
      product?.price ||
        priceEl?.getAttribute("content") ||
        (priceEl?.textContent || "").replace(/[^0-9.]/g, "") ||
        0
    );
    const id =
      product?.id ||
      root.getAttribute("data-pid") ||
      root.querySelector("[data-pid]")?.getAttribute("data-pid") ||
      name;
    const href = root.querySelector("a[href*='/products/']")?.href || "";
    const category = (product?.category || href).toLowerCase();
    return {
      root,
      name,
      color,
      price,
      id: String(id),
      href,
      category,
      text: `${name} ${color} ${category}`,
    };
  }

  function pdpInfo() {
    const name =
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector('[data-product-component="name"]')?.textContent?.trim() ||
      document.title.split("|")[0].trim();
    const priceText =
      document.querySelector('[itemprop="price"]')?.getAttribute("content") ||
      document.querySelector(".price--formated")?.textContent ||
      "";
    const price = Number(String(priceText).replace(/[^0-9.]/g, "")) || 0;
    const color =
      document
        .querySelector(".product-attribute--color .selected, .color-value, [data-attr-value]")
        ?.textContent?.trim() || "";
    return { name, price, color, text: `${name} ${color} ${location.pathname}` };
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
        title: `shopping for ${ev.label}`,
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
    return (
      tile.querySelector(".product-tile__media, .product-tile__media-container, .tile-image, picture") ||
      tile
    );
  }

  // ── shell ────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.id = "yom-root";
  document.documentElement.appendChild(root);

  if (!document.getElementById("yom-fonts")) {
    const link = document.createElement("link");
    link.id = "yom-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@500;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }

  const buddy = el("button", {
    class: "yom-buddy docked",
    type: "button",
    "aria-label": "yom",
  });
  buddy.innerHTML = `<img src="${asset("yom-mark.png")}" alt="" />`;
  root.appendChild(buddy);

  const modePill = el("button", { class: "yom-mode-pill hidden", type: "button" });
  root.appendChild(modePill);

  const panel = el("div", { class: "yom-panel hidden" });
  root.appendChild(panel);

  function dockPoint() {
    return {
      left: window.innerWidth - 72,
      top: window.innerHeight - 80,
    };
  }

  function dockBuddy(animatePop = false) {
    const p = dockPoint();
    buddy.style.left = `${p.left}px`;
    buddy.style.top = `${p.top}px`;
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
    const p = dockPoint();
    const bLeft = parseFloat(buddy.style.left) || p.left;
    const bTop = parseFloat(buddy.style.top) || p.top;

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
      requestAnimationFrame(() => {
        const pw = modePill.offsetWidth || 88;
        modePill.style.left = `${Math.max(8, bLeft - pw - 10)}px`;
        modePill.style.top = `${bTop + 12}px`;
      });
    }

    if (whisperEl) {
      requestAnimationFrame(() => {
        const w = whisperEl.offsetWidth;
        const h = whisperEl.offsetHeight;
        whisperEl.style.left = `${Math.max(8, bLeft + 52 - w)}px`;
        whisperEl.style.top = `${Math.max(8, bTop - h - 8)}px`;
      });
    }

    if (askEl) {
      requestAnimationFrame(() => {
        const w = askEl.offsetWidth;
        const h = askEl.offsetHeight;
        askEl.style.left = `${Math.max(8, window.innerWidth - w - 16)}px`;
        askEl.style.top = `${Math.max(8, bTop - h - 14)}px`;
      });
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
    const wrap = tile.closest(".product-tile-wrapper") || tile;
    wrap.classList.toggle("yom-tile-love", !!mark.love);
    tile.classList.toggle("yom-tile-love", !!mark.love);
    const existing = host.querySelector(".yom-stamp");
    const cls = `yom-stamp${mark.love ? " love" : ""}${mark.warn ? " warn" : ""}`;
    if (existing && existing.textContent === mark.stamp && existing.className === cls) return;
    existing?.remove();
    host.appendChild(el("div", { class: cls }, mark.stamp));
  }

  function restampTiles() {
    document.querySelectorAll(".product-tile-wrapper, .product-tile").forEach((tile) => {
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
    const price =
      document.querySelector("[itemprop='price']") ||
      document.querySelector(".price--formated, .prices, .product-price");
    if (price && !isSticky(price)) return { el: sizable(price), where: "after" };

    const h1 = document.querySelector("h1");
    if (h1 && !isSticky(h1)) return { el: sizable(h1), where: "after" };

    const addBtn = findAddButton();
    if (addBtn && !isSticky(addBtn) && !isSticky(addBtn.parentElement)) {
      const block =
        addBtn.closest("form, [class*='add-to'], [class*='addtocart'], [class*='AddTo']") ||
        addBtn.parentElement;
      return { el: sizable(block), where: "before" };
    }
    return { el: document.querySelector("main") || document.body, where: "prepend" };
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
    document.querySelectorAll(".product-tile-wrapper, .product-tile").forEach((tile) => {
      const info = tileInfo(tile);
      const wrap = info.root.closest(".product-tile-wrapper") || info.root;
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
    saveState();
    renderPanel();
  });

  modePill.addEventListener("click", () => {
    state.panelOpen = true;
    saveState();
    renderPanel();
  });

  function openModePicker() {
    saveState();
    ask({
      title: "what’s the vibe?",
      body: "I’ll hang on the page. no chat unless I need a tap.",
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
    closeAsk();
    state.mode = mode;
    state.purpose = purpose;
    state.budget = budget;
    state.panelOpen = false;
    saveState();
    dockBuddy(true);
    render();
    whisper(welcomeTip());
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
      <div class="yom-meta">${
        state.spent
          ? `bag so far · $${state.spent}${state.budget != null ? ` · $${remainingBudget()} left` : ""}`
          : "hanging with you on Reformation"
      }</div>
    `;

    panel.querySelector("[data-close]").addEventListener("click", () => {
      state.panelOpen = false;
      saveState();
      renderPanel();
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
      whisper(welcomeTip());
      return;
    }
    if (next === "gift") {
      state.mode = "gift";
      state.purpose = null;
      saveState();
      state.panelOpen = false;
      render();
      whisper(welcomeTip());
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
    whisper(welcomeTip());
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
    setTimeout(() => {
      state.checking = false;
      const result = checkResult(info);
      state.checked[pageKey] = result;
      saveState();
      if (location.pathname !== pageKey) return;
      pdpNote(result, { resolve: result.resolve, kicker: "yom · checked" });
    }, 1400);
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

  // ── PLP pauses — driven by profile, not a script ─────────────
  function onPause(tile) {
    if (!state.mode) return;
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

  function bindTiles() {
    document.querySelectorAll(".product-tile, .product-tile-wrapper").forEach((tile) => {
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

  function renderPdpPresence() {
    if (!isPdp() || !state.mode) return;
    const info = pdpInfo();
    const pageKey = location.pathname;
    const ev = purposeMeta();

    if (state.checked[pageKey]) {
      speakOnce(`checked:${pageKey}`, () => {
        const result = state.checked[pageKey];
        pdpNote(result, { resolve: result.resolve, kicker: "yom · checked" });
      });
      return;
    }

    if (state.checking) return;

    if (isShoeProduct(info) && !isGift()) {
      speakOnce(`shoes:${pageKey}`, () => {
        pdpNote(DATA.tips.shoes, {
          alts: DATA.shoeAlts,
          chips: [
            { label: "I don’t need shoes", onPick: () => skipShoes() },
            { label: "I’ll look", onPick: () => pdpNote(DATA.tips.shoes, { alts: DATA.shoeAlts }) },
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
    if (location.href !== lastHref) {
      lastHref = location.href;
      spokenKey = null;
      closeAsk();
      clearWhisper();
      clearExpandedNotes();
      dockBuddy();
      render();
      return;
    }
    const foreign = mutations.some((m) =>
      [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1 && !yomNode(n))
    );
    if (foreign) bindTiles();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  dockBuddy(true);
  render();
})();
