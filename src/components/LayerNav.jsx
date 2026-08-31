import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./LayerNav.css";

/*
 * A layered curtain menu.
 *
 * The icon is two lines that become a cross. Opening sweeps four coloured
 * panels up the screen one after another — the last of them is the menu's own
 * ground, so the colour that arrives last is the one you end up reading on —
 * and the links rise after them, staggered. Closing runs it backwards.
 *
 * The panels are the whole effect, so they are what the timings are built
 * around: they are plain transforms on solid colour, which composite on the
 * GPU and stay smooth on a phone.
 */

const LAYERS = ["#E5387E", "#F4A300", "#2EC4B6", "#111111"];
const LAYER_STEP = 90; // ms between one panel leaving and the next
const LAYER_RIDE = 620; // ms a panel takes to cross
const LINK_STEP = 70;

export default function LayerNav({ items = [], email = "", socials = [] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);

  // Kept mounted through the close so the panels can run backwards; unmounted
  // once they are off screen, so nothing invisible sits over the page.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    const t = setTimeout(
      () => setMounted(false),
      LAYER_RIDE + LAYER_STEP * (LAYERS.length - 1)
    );
    return () => clearTimeout(t);
  }, [open, mounted]);

  // A menu over the whole page should not leave the page scrolling underneath.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      // Hold focus inside the menu while it is covering everything else.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      panelRef.current?.querySelector("a, button")?.focus();
    }, LAYER_RIDE);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      <div className={`lnav-bar${open ? " is-open" : ""}`}>
        <Link to="/" className="lnav-mark" aria-label="yom, home">
          yom
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className={`lnav-toggle${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span />
          <span />
        </button>
      </div>

      {mounted && (
        <div className={`lnav-sheet${open ? " is-open" : ""}`} aria-hidden={!open}>
          {LAYERS.map((color, i) => (
            <span
              key={color}
              className="lnav-layer"
              style={{
                background: color,
                // Opening runs first to last; closing runs last to first, so
                // the curtain retreats the way it arrived.
                transitionDelay: `${(open ? i : LAYERS.length - 1 - i) * LAYER_STEP}ms`,
              }}
            />
          ))}

          <div className="lnav-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu">
            <nav className="lnav-links">
              {items.map((item, i) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="lnav-link"
                  style={{ transitionDelay: `${LAYER_RIDE * 0.55 + i * LINK_STEP}ms` }}
                  onClick={close}
                >
                  <span className="lnav-index">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div
              className="lnav-foot"
              style={{ transitionDelay: `${LAYER_RIDE * 0.55 + items.length * LINK_STEP}ms` }}
            >
              {email ? (
                <div className="lnav-foot-col">
                  <span className="lnav-foot-label">Work with us</span>
                  <a href={`mailto:${email}`} className="lnav-foot-link">
                    {email}
                  </a>
                </div>
              ) : null}
              {socials.length > 0 ? (
                <div className="lnav-foot-col">
                  <span className="lnav-foot-label">Elsewhere</span>
                  <div className="lnav-socials">
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        className="lnav-foot-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
