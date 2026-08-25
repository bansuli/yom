const TAP =
  "button, a.pnm-cta, a.cta, a.nav-pill, a.waitlist-cta, a.waitlist-trip-link, .pnm-action, .pnm-chip, .pnm-choice, .pnm-mini, .pnm-step-do, .yom-nav a, .scan-modes button, .scan-flip";

export function startTapFeel() {
  if (typeof document === "undefined") return;
  const quiet = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const pulse = (el) => {
    el.classList.remove("is-tapped");
    void el.offsetWidth;
    el.classList.add("is-tapped");
    if (quiet()) return;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* iOS has no vibrate */
    }
  };

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const el = event.target?.closest?.(TAP);
      if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
      pulse(el);
    },
    { passive: true }
  );

  document.addEventListener("animationend", (event) => {
    if (event.animationName === "yom-tap") event.target.classList?.remove("is-tapped");
  });
}
