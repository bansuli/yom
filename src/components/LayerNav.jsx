import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./LayerNav.css";

/*
 * A layered menu that drops from the top.
 *
 * Pressing the icon sends four bands down from the top edge one after another.
 * They stop partway down the screen rather than covering it, so the page stays
 * visible underneath and the menu reads as something laid over it. The last
 * band is the ground the menu is read on. Closing lifts them back, last first,
 * so the stack retreats the way it arrived.
 *
 * The bands are plain transforms on solid colour — they composite on the GPU
 * instead of repainting, which is what keeps this smooth on a phone.
 */

const LAYERS = ["#F4A300", "#E5387E", "#2EC4B6", "#111111"];
const LAYER_STEP = 85; // ms between one band starting and the next
const LAYER_RIDE = 640; // ms a band takes to fall
const LINK_STEP = 60;

export default function LayerNav({ items = [], email = "", socials = [] }) {
  // The sheet is always in the DOM. Mounting it at the moment it opens gave
  // the browser no first frame to transition away from, so the bands arrived
  // already in place — opening jumped while closing swept. Nothing here is
  // expensive to keep around: four spans and some text.
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);

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
      const focusable = panelRef.current?.querySelectorAll("a[href], button:not([disabled])");
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
    if (!open) return undefined;
    const t = setTimeout(() => {
      panelRef.current?.querySelector("a, button")?.focus();
    }, LAYER_RIDE);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      <div className={`lnav-sheet${open ? " is-open" : ""}`} aria-hidden={!open}>
          {LAYERS.map((color, i) => (
            <span
              key={color}
              className="lnav-layer"
              style={{
                background: color,
                // Opening runs first band to last; closing runs last to first.
                transitionDelay: `${(open ? i : LAYERS.length - 1 - i) * LAYER_STEP}ms`,
              }}
            />
          ))}

          <div className="lnav-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu">
            <div className="lnav-col lnav-col-start">
              {email ? (
                <>
                  <span className="lnav-label">Work with us:</span>
                  <a href={`mailto:${email}`} className="lnav-small">
                    {email}
                  </a>
                </>
              ) : null}
            </div>

            <nav className="lnav-links">
              {items.map((item, i) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="lnav-link"
                  style={{ transitionDelay: `${LAYER_RIDE * 0.5 + i * LINK_STEP}ms` }}
                  onClick={close}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="lnav-col lnav-col-end">
              {socials.length > 0 ? (
                <>
                  <span className="lnav-label">Elsewhere:</span>
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      className="lnav-small"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.label}
                    </a>
                  ))}
                </>
              ) : null}
            </div>
        </div>
      </div>

      {/* Above the bands, so the mark and the icon stay on top of them. */}
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
    </>
  );
}
