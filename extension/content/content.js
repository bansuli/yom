(() => {
  if (window.__YOM_LOADED__) return;
  window.__YOM_LOADED__ = true;

  const DATA = window.YOM_DEMO;
  const STORAGE_KEY = "yom-companion-v2";
  const PAUSE_MS = 1000;
  const GREEN_WORDS =
    /\b(green|emerald|forest|jade|moss|olive|sage|evergreen|tarragon|fern|kelly|pistachio)\b/i;
  const SHOE_WORDS = /\b(shoe|heel|sandal|boot|mule|pump|loafer|sneaker|slingback)\b/i;

  const defaultState = () => ({
    // modes: null | browse | purpose
    mode: null,
    purpose: null, // e.g. Sofia's wedding
    budget: null,
    // hardcoded beats (invisible to user)
    beat: "off", // off|onboarding|browse|similar|material|green|pdp|purposeOn|checking|checked|postDress|budgeted|pairing|pairingPdp|shoes|cart|done
    spent: 0,
    cartNames: [],
    tipHistory: [],
    dressChecked: false,
    pairingChecked: false,
    panelOpen: false,
  });

  let state = loadState();
  let hoverTimer = null;
  let hoverTile = null;
  let speechEl = null;
  let buddyDocked = true;
  let clickCount = 0;
  let clickTimer = null;
  let spokenKey = null;

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
    clearSpeech();
    clearBudgetFlags();
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
  buddy.innerHTML = `<span class="yom-buddy-ring"></span><img src="${asset("yom-mark.png")}" alt="" />`;
  root.appendChild(buddy);

  const modePill = el("button", { class: "yom-mode-pill hidden", type: "button" });
  root.appendChild(modePill);

  const panel = el("div", { class: "yom-panel hidden" });
  root.appendChild(panel);

  function dockPoint() {
    return {
      left: window.innerWidth - 84,
      top: window.innerHeight - 96,
    };
  }

  function setBuddyPos(left, top, { pop = false, notice = false, docked = false } = {}) {
    buddy.style.left = `${Math.max(8, left)}px`;
    buddy.style.top = `${Math.max(8, top)}px`;
    buddy.classList.toggle("docked", docked);
    buddyDocked = docked;
    if (pop) {
      buddy.classList.remove("pop");
      void buddy.offsetWidth;
      buddy.classList.add("pop");
    }
    if (notice) {
      buddy.classList.remove("notice");
      void buddy.offsetWidth;
      buddy.classList.add("notice");
    }
    positionModePill();
  }

  function dockBuddy(animatePop = false) {
    const p = dockPoint();
    setBuddyPos(p.left, p.top, { docked: true, pop: animatePop });
    positionModePill();
  }

  function hopToElement(target, side = "right") {
    if (!target) {
      dockBuddy(true);
      return { left: 0, top: 0, side };
    }
    const rect = target.getBoundingClientRect();
    let left = side === "left" ? rect.left - 72 : rect.right + 8;
    let top = rect.top + Math.min(40, rect.height * 0.15);
    if (left + 70 > window.innerWidth) {
      left = rect.left - 72;
      side = "left";
    }
    if (left < 8) {
      left = Math.min(rect.right + 8, window.innerWidth - 72);
      side = "right";
    }
    if (top + 70 > window.innerHeight) top = window.innerHeight - 80;
    if (top < 8) top = 8;
    setBuddyPos(left, top, { pop: true, docked: false });
    return { left, top, side };
  }

  function positionModePill() {
    if (!state.mode) {
      modePill.classList.add("hidden");
      return;
    }
    modePill.classList.remove("hidden");
    modePill.classList.toggle("purpose", state.mode === "purpose");
    const label =
      state.mode === "browse"
        ? "browsing"
        : state.purpose || "something coming up";
    modePill.innerHTML = `<span class="dot"></span><span>${label}</span>`;
    const bLeft = parseFloat(buddy.style.left) || dockPoint().left;
    const bTop = parseFloat(buddy.style.top) || dockPoint().top;
    if (buddyDocked) {
      modePill.style.left = `${Math.max(8, bLeft - 40)}px`;
      modePill.style.top = `${bTop + 66}px`;
    } else {
      modePill.style.left = `${Math.max(8, bLeft - 10)}px`;
      modePill.style.top = `${bTop + 66}px`;
    }
  }

  function clearSpeech() {
    speechEl?.remove();
    speechEl = null;
  }

  function say(anchorOrNull, tip, { actions = [], closetKey = null, resolve = null, alts = null, onMount = null } = {}) {
    clearSpeech();
    const pos = hopToElement(anchorOrNull, "right");
    const bubble = el("div", { class: `yom-speech tail-${pos.side === "left" ? "right" : "left"}` });
    const closet = closetKey ? DATA.closet[closetKey] : tip.closetKey ? DATA.closet[tip.closetKey] : null;
    bubble.innerHTML = `
      <div class="yom-speech-kicker">yom</div>
      <h3>${tip.title}</h3>
      ${tip.body ? `<p>${tip.body}</p>` : ""}
      ${resolve ? `<div class="yom-resolve">${resolve}</div>` : ""}
      ${
        alts
          ? `<div class="yom-alts">${alts
              .map(
                (a) =>
                  `<div class="yom-alt"><strong>${a.brand} ${a.name}</strong><span>${a.why} · ${a.price}</span></div>`
              )
              .join("")}</div>`
          : ""
      }
      ${
        closet
          ? `<div class="yom-speech-closet">
              <img src="${asset(closet.file)}" alt="" />
              <div><strong>${closet.title}</strong><span>${closet.note}</span></div>
            </div>`
          : ""
      }
      ${actions.length ? `<div class="yom-speech-actions" data-actions></div>` : ""}
    `;
    root.appendChild(bubble);
    speechEl = bubble;

    const actionsHost = bubble.querySelector("[data-actions]");
    actions.forEach((a) => {
      const btn = el("button", { class: `yom-btn${a.ghost ? " ghost" : ""}`, type: "button" }, a.label);
      btn.addEventListener("click", a.onClick);
      actionsHost.appendChild(btn);
    });

    // place bubble beside buddy
    requestAnimationFrame(() => {
      const bLeft = parseFloat(buddy.style.left) || 0;
      const bTop = parseFloat(buddy.style.top) || 0;
      const w = bubble.offsetWidth;
      const h = bubble.offsetHeight;
      let left = pos.side === "left" ? bLeft - w - 10 : bLeft + 72;
      let top = bTop - 4;
      if (left + w > window.innerWidth - 8) left = bLeft - w - 10;
      if (left < 8) left = 8;
      if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
      if (top < 8) top = 8;
      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    });

    onMount?.(bubble);
  }

  // ── activation / modes ───────────────────────────────────────
  buddy.addEventListener("click", () => {
    // triple-click resets quietly
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
    state.beat = "onboarding";
    saveState();
    clearSpeech();

    const backdrop = el("div", { class: "yom-modal-backdrop" });
    const modal = el("div", { class: "yom-modal" });
    modal.innerHTML = `
      <img class="yom-modal-char" src="${asset("yom-mark.png")}" alt="" />
      <h2>hey — what’s the vibe?</h2>
      <p>yom can hang out while you browse, or help you shop for something real coming up.</p>
      <div class="yom-choice">
        <button type="button" data-mode="browse">just browsing</button>
        <button type="button" data-mode="purpose">something coming up</button>
      </div>
    `;
    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    modal.querySelector('[data-mode="browse"]').addEventListener("click", () => {
      backdrop.remove();
      startBrowseMode();
    });
    modal.querySelector('[data-mode="purpose"]').addEventListener("click", () => {
      backdrop.remove();
      openPurposePicker();
    });
  }

  function startBrowseMode() {
    const backdrop = el("div", { class: "yom-modal-backdrop" });
    const modal = el("div", { class: "yom-modal" });
    modal.innerHTML = `
      <img class="yom-modal-char" src="${asset("yom-mark.png")}" alt="" />
      <h2>budget?</h2>
      <p>you can skip this — add one later if shopping turns real.</p>
      <div class="yom-choice">
        <button type="button" data-budget="none">no budget</button>
        <button type="button" data-budget="200">$200</button>
        <button type="button" data-budget="400">$400</button>
      </div>
      <div class="yom-actions">
        <button type="button" class="yom-btn ghost" data-back>back</button>
      </div>
    `;
    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    modal.querySelector("[data-back]").addEventListener("click", () => {
      backdrop.remove();
      openModePicker();
    });

    modal.querySelectorAll("[data-budget]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.budget === "none" ? null : Number(btn.dataset.budget);
        backdrop.remove();
        finishBrowseMode(value);
      });
    });
  }

  function finishBrowseMode(budget) {
    state.mode = "browse";
    state.purpose = null;
    state.budget = budget;
    state.beat = "browse";
    state.panelOpen = false;
    saveState();
    dockBuddy(true);
    render();
    say(null, DATA.tips.welcome);
    setTimeout(() => {
      if (state.beat === "browse") clearSpeech();
      dockBuddy();
    }, 2800);
  }

  function openPurposePicker() {
    const backdrop = el("div", { class: "yom-modal-backdrop" });
    const modal = el("div", { class: "yom-modal" });
    modal.innerHTML = `
      <img class="yom-modal-char" src="${asset("yom-mark.png")}" alt="" />
      <h2>what’s coming up?</h2>
      <p>pulled from your calendar — pick one, or keep it open-ended.</p>
      <div class="yom-choice" data-events>
        ${DATA.events
          .map(
            (e) =>
              `<button type="button" class="yom-event" data-event="${e.id}">
                ${e.label}
                <small>${e.when} · ${e.source}</small>
              </button>`
          )
          .join("")}
        <button type="button" class="yom-event" data-event="other">something else</button>
      </div>
      <div class="yom-field">
        <label>budget (optional)</label>
        <div class="yom-choice" data-budgets style="grid-template-columns:1fr 1fr 1fr">
          <button type="button" data-budget="none">none</button>
          <button type="button" data-budget="200">$200</button>
          <button type="button" data-budget="400">$400</button>
        </div>
      </div>
      <div class="yom-actions">
        <button type="button" class="yom-btn" data-go disabled>let’s go</button>
        <button type="button" class="yom-btn ghost" data-back>back</button>
      </div>
    `;
    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    let eventId = null;
    let budget = null;
    let budgetChosen = false;
    const go = modal.querySelector("[data-go]");

    const sync = () => {
      go.disabled = !eventId;
    };

    modal.querySelector("[data-events]").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-event]");
      if (!btn) return;
      eventId = btn.dataset.event;
      modal.querySelectorAll("[data-event]").forEach((b) => b.classList.toggle("selected", b === btn));
      sync();
    });

    modal.querySelector("[data-budgets]").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-budget]");
      if (!btn) return;
      budgetChosen = true;
      budget = btn.dataset.budget === "none" ? null : Number(btn.dataset.budget);
      modal.querySelectorAll("[data-budget]").forEach((b) => b.classList.toggle("selected", b === btn));
    });

    modal.querySelector("[data-back]").addEventListener("click", () => {
      backdrop.remove();
      openModePicker();
    });

    go.addEventListener("click", () => {
      const ev = DATA.events.find((e) => e.id === eventId);
      state.mode = "purpose";
      state.purpose = ev ? ev.label : "something coming up";
      state.budget = budgetChosen ? budget : null;
      state.beat = state.purpose === "Sofia's wedding" ? "browse" : "browse";
      // demo narrative still starts in browse-like discovery, then purpose deepens on the dress
      state.panelOpen = false;
      saveState();
      backdrop.remove();
      dockBuddy(true);
      render();
      say(null, {
        title: `shopping for ${state.purpose}`,
        body: state.budget == null ? "no budget for now — we can add one later." : `keeping an eye on $${state.budget}.`,
      });
      setTimeout(() => {
        clearSpeech();
        dockBuddy();
      }, 2600);
    });
  }

  // ── context panel ────────────────────────────────────────────
  function renderPanel() {
    if (!state.panelOpen || !state.mode) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="yom-panel-head">
        <strong>context</strong>
        <button type="button" data-close>close</button>
      </div>
      <div class="yom-field">
        <label>shopping for</label>
        <select data-context>
          <option value="browse" ${state.mode === "browse" ? "selected" : ""}>just browsing</option>
          ${DATA.events
            .map(
              (e) =>
                `<option value="${e.label}" ${
                  state.mode === "purpose" && state.purpose === e.label ? "selected" : ""
                }>${e.label} · ${e.when}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="yom-meta" style="margin-top:-0.15rem;margin-bottom:0.65rem">
        ${
          state.mode === "purpose"
            ? "from your calendar"
            : "no particular goal"
        }
      </div>
      <div class="yom-field">
        <label>budget</label>
        <select data-budget>
          <option value="none" ${state.budget == null ? "selected" : ""}>no budget</option>
          <option value="150" ${state.budget === 150 ? "selected" : ""}>$150</option>
          <option value="200" ${state.budget === 200 ? "selected" : ""}>$200</option>
          <option value="300" ${state.budget === 300 ? "selected" : ""}>$300</option>
          <option value="400" ${state.budget === 400 ? "selected" : ""}>$400</option>
        </select>
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

    panel.querySelector("[data-context]").addEventListener("change", (e) => {
      const next = e.target.value;
      if (next === "browse") {
        state.mode = "browse";
        saveState();
        render();
        return;
      }
      // e.g. Sofia's wedding
      state.mode = "purpose";
      state.purpose = next;
      saveState();
      if (isPdp() && !state.dressChecked) {
        enterPurposeOnDress();
        return;
      }
      render();
    });

    panel.querySelector("[data-budget]").addEventListener("change", (e) => {
      const v = e.target.value;
      state.budget = v === "none" ? null : Number(v);
      if (state.budget != null && state.spent > 0 && state.dressChecked) {
        state.beat = "budgeted";
        saveState();
        render();
        say(null, DATA.tips.budgetOn);
        setTimeout(() => {
          clearSpeech();
          dockBuddy();
        }, 2400);
        return;
      }
      saveState();
      render();
    });
  }

  function enterPurposeOnDress() {
    state.mode = "purpose";
    if (!state.purpose) state.purpose = "Sofia's wedding";
    state.beat = "purposeOn";
    state.panelOpen = false;
    spokenKey = `purposeOn:${location.pathname}`;
    saveState();
    renderPanel();
    positionModePill();
    const host = document.querySelector("h1") || document.body;
    say(host, DATA.tips.delivery, {
      actions: [
        {
          label: "check it",
          onClick: () => runCheckDress(),
        },
      ],
    });
  }

  function runCheckDress() {
    state.beat = "checking";
    saveState();
    const host = document.querySelector("h1") || document.body;
    say(host, DATA.tips.checking);
    setTimeout(() => {
      state.beat = "checked";
      state.dressChecked = true;
      saveState();
      say(host, DATA.tips.check, {
        resolve: DATA.tips.check.resolve,
        actions: [
          {
            label: "I added it to bag",
            onClick: () => {
              const info = pdpInfo();
              const price = info.price || 278;
              if (!state.cartNames.includes(info.name)) {
                state.spent += price;
                state.cartNames.push(info.name || "green dress");
              }
              state.beat = "postDress";
              state.panelOpen = false;
              spokenKey = null;
              saveState();
              say(null, DATA.tips.afterDress);
              render();
              setTimeout(() => {
                clearSpeech();
                dockBuddy();
              }, 2800);
            },
          },
        ],
      });
    }, 1400);
  }

  // ── PLP pauses ───────────────────────────────────────────────
  function onPause(tile) {
    if (!state.mode) return;
    const info = tileInfo(tile);
    if (!info.name) return;

    // After the dress: wait for a budget before the next shopping beat
    if (state.beat === "postDress" && state.budget == null) {
      say(null, DATA.tips.afterDress);
      return;
    }

    // after dress + budget: pairing path
    if (["budgeted", "postDress"].includes(state.beat) && state.budget != null && state.spent > 0) {
      if (info.price > remainingBudget()) {
        say(info.root, DATA.tips.overBudget);
        return;
      }
      state.beat = "pairing";
      saveState();
      say(info.root, DATA.tips.pairing, { closetKey: "shorts" });
      return;
    }

    if (state.beat === "pairing") {
      say(info.root, DATA.tips.pairing, { closetKey: "shorts" });
      return;
    }

    // don't restart discovery after the wedding arc begins
    if (["purposeOn", "checking", "checked", "shoes", "cart", "done", "pairingPdp"].includes(state.beat)) {
      return;
    }

    // discovery beats
    if (state.beat === "browse") {
      state.beat = "similar";
      state.tipHistory.push(info.id);
      saveState();
      say(info.root, DATA.tips.similar, { closetKey: "similar" });
      return;
    }

    if (state.beat === "similar") {
      if (state.tipHistory.includes(info.id)) return;
      state.beat = "material";
      state.tipHistory.push(info.id);
      saveState();
      say(info.root, DATA.tips.material);
      return;
    }

    if (state.beat === "material" || state.beat === "green") {
      if (isGreenProduct(info) || isDress(info)) {
        state.beat = "green";
        saveState();
        say(info.root, DATA.tips.green, { closetKey: "green" });
      }
    }
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

      target.addEventListener("click", () => {
        const info = tileInfo(target);
        if (state.beat === "green" && (isGreenProduct(info) || isDress(info))) {
          state.beat = "pdp";
          saveState();
        }
        if (state.beat === "pairing") {
          state.beat = "pairingPdp";
          saveState();
        }
        if (isShoeProduct(info) && state.pairingChecked) {
          state.beat = "shoes";
          saveState();
        }
      });
    });
    applyBudgetFlags();
  }

  function clearBudgetFlags() {
    document.querySelectorAll(".yom-budget-flag").forEach((n) => n.remove());
  }

  function applyBudgetFlags() {
    clearBudgetFlags();
    if (state.budget == null || state.spent <= 0) return;
    if (!["budgeted", "pairing", "pairingPdp", "shoes", "postDress", "cart"].includes(state.beat)) return;
    const rem = remainingBudget();
    document.querySelectorAll(".product-tile-wrapper, .product-tile").forEach((tile) => {
      const info = tileInfo(tile);
      if (!info.price || info.price <= rem) return;
      const host = tile.querySelector(".product-tile__media, .product-tile__media-container") || tile;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      if (host.querySelector(".yom-budget-flag")) return;
      host.appendChild(el("div", { class: "yom-budget-flag" }, "over budget"));
    });
  }

  function speakOnce(key, fn) {
    if (spokenKey === key) return;
    spokenKey = key;
    fn();
  }

  // ── PDP presence ─────────────────────────────────────────────
  function renderPdpPresence() {
    if (!isPdp() || !state.mode) return;
    const info = pdpInfo();
    const dressish = isDress(info) || isGreenProduct(info);
    const shoeish = isShoeProduct(info);
    const host = document.querySelector("h1") || document.body;
    const pageKey = location.pathname;

    if (shoeish && (state.pairingChecked || state.beat === "shoes")) {
      state.beat = "shoes";
      saveState();
      speakOnce(`shoes:${pageKey}`, () => {
        say(host, DATA.tips.shoes, {
          alts: DATA.shoeAlts,
          actions: [
            {
              label: "I don’t need shoes",
              onClick: () => {
                state.beat = "cart";
                spokenKey = null;
                saveState();
                say(null, DATA.tips.skipShoes);
                setTimeout(() => {
                  clearSpeech();
                  dockBuddy();
                }, 2800);
              },
            },
          ],
        });
      });
      return;
    }

    // Pairing PDP: click in → yom checks automatically
    if (["pairing", "pairingPdp"].includes(state.beat) && state.spent > 0 && !dressish && !shoeish) {
      state.beat = "pairingPdp";
      saveState();
      if (!state.pairingChecked) {
        speakOnce(`pairing-check:${pageKey}`, () => {
          say(host, DATA.tips.checking);
          setTimeout(() => {
            state.pairingChecked = true;
            saveState();
            say(host, DATA.tips.pairingCheck, {
              actions: [
                {
                  label: "I added it to bag",
                  onClick: () => {
                    const price = info.price || 88;
                    state.spent += price;
                    state.cartNames.push(info.name || "pairing piece");
                    state.beat = "shoes";
                    spokenKey = null;
                    saveState();
                    clearSpeech();
                    dockBuddy();
                    render();
                  },
                },
              ],
            });
          }, 1100);
        });
      }
      return;
    }

    // Green dress PDP while still browsing — remind, then wait for context change
    if (["green", "pdp"].includes(state.beat) && dressish) {
      state.beat = "pdp";
      saveState();
      if (state.mode === "browse") {
        speakOnce(`green-browse:${pageKey}`, () => {
          say(host, DATA.tips.green, { closetKey: "green" });
        });
        return;
      }
      // already in purpose mode
      speakOnce(`purpose-enter:${pageKey}`, () => enterPurposeOnDress());
      return;
    }

    if (state.beat === "purposeOn" && !state.dressChecked) {
      speakOnce(`purposeOn:${pageKey}`, () => enterPurposeOnDress());
      return;
    }

    if ((state.beat === "checked" || state.beat === "purposeOn") && state.dressChecked && dressish) {
      speakOnce(`checked:${pageKey}`, () => {
        say(host, DATA.tips.check, {
          resolve: DATA.tips.check.resolve,
          actions: [
            {
              label: "I added it to bag",
              onClick: () => {
                const price = info.price || 278;
                if (!state.cartNames.includes(info.name)) {
                  state.spent += price;
                  state.cartNames.push(info.name || "green dress");
                }
                state.beat = "postDress";
                spokenKey = null;
                saveState();
                render();
                clearSpeech();
                dockBuddy();
              },
            },
          ],
        });
      });
    }
  }

  // ── cart ─────────────────────────────────────────────────────
  function renderCart() {
    document.querySelector("#yom-cart-panel")?.remove();
    if (!isCart() || !state.mode) return;

    state.beat = state.beat === "done" ? "done" : "cart";
    saveState();

    const host =
      document.querySelector(".cart-page, .cart, #cart-table, .cart__body, main, .container") ||
      document.body;
    const panelEl = el("div", { class: "yom-cart-panel", id: "yom-cart-panel" });
    const names =
      state.cartNames.length > 0
        ? state.cartNames
        : [...document.querySelectorAll(".line-item-name, .product-name, [data-product-component='name']")]
            .map((n) => n.textContent.trim())
            .filter(Boolean)
            .slice(0, 3);

    const rows = (names.length ? names : ["Your picks"]).map((name, i) => {
      const kind = /dress/i.test(name) ? "dress" : i === 0 && state.dressChecked ? "dress" : "pairing";
      return { name, keep: DATA.keep[kind] || DATA.keep.other };
    });

    panelEl.innerHTML = `
      <h3>keep confidence</h3>
      <p>a read on the purchase as a whole — sizing, preferences, returns, reviews, closet, and what yom has learned about you.</p>
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
      <div class="yom-actions">
        <button type="button" class="yom-btn" data-checkout>checkout</button>
      </div>
    `;
    host.prepend(panelEl);

    hopToElement(panelEl, "left");
    panelEl.querySelector("[data-checkout]").addEventListener("click", () => {
      state.beat = "done";
      saveState();
      say(panelEl, DATA.tips.done);
    });
  }

  function render() {
    if (!state.mode) {
      dockBuddy(state.beat === "off");
      modePill.classList.add("hidden");
    } else {
      positionModePill();
      if (buddyDocked) dockBuddy();
    }
    renderPanel();
    bindTiles();
    applyBudgetFlags();
    if (isPdp()) renderPdpPresence();
    if (isCart()) renderCart();
  }

  window.addEventListener("resize", () => {
    if (buddyDocked) dockBuddy();
    else positionModePill();
  });

  window.addEventListener(
    "scroll",
    () => {
      // when scrolling the grid, let yom settle back so it doesn't feel sticky-noisy
      if (!isPdp() && !isCart() && speechEl && buddyDocked === false) {
        // keep speech until user moves on; soft dock after scroll burst
      }
    },
    { passive: true }
  );

  let lastHref = location.href;
  const mo = new MutationObserver(() => {
    bindTiles();
    if (location.href !== lastHref) {
      lastHref = location.href;
      spokenKey = null;
      clearSpeech();
      dockBuddy();
      render();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // boot
  dockBuddy(true);
  render();
})();
