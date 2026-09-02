import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './MorphedMenu.css'

/*
 * A menu that is the button.
 *
 * Closed, it is a glass pill saying MENU. Open, the same pill springs out into
 * a card and the links flip up inside it. There is no second surface appearing
 * over the first — one rounded rectangle changes size, which is what makes it
 * read as the button opening rather than a panel being summoned.
 *
 * Built with transitions rather than a motion library. The morph is width,
 * height and radius; the links are opacity and transform with a stagger from a
 * custom property; the label is a two-face column that rolls. None of that
 * needs a runtime, and the page already carries three.js and matter — a fourth
 * animation dependency for one component is not worth the weight.
 *
 * The overshoot in the easing is doing the spring's job. A plain ease lands
 * flat and the pill looks like it is being resized; a curve that goes past its
 * end and comes back reads as something with weight arriving.
 */

export default function MorphedMenu({ items = [], email = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const panelId = useId()

  /*
   * Closing on an outside press and on Escape, because this covers a good part
   * of the screen when open and the button is the only other way out of it.
   * Bound while open only — a document listener that lives for the life of the
   * page to service a menu that is shut is a listener running for nothing.
   */
  useEffect(() => {
    if (!open) return undefined

    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="mm" ref={rootRef} data-open={open || undefined}>
      {/*
        * The panel sits under the button and shares its top right corner, so
        * growing it opens the card downward and to the left from exactly where
        * the pill was.
        */}
      <div className="mm-panel" id={panelId} role="menu" aria-hidden={!open}>
        {/*
          * The padding lives in here, not on the panel.
          *
          * A border-box element cannot be shorter than its own padding, so a
          * panel with the card's padding on it could not shrink back to the
          * pill — the browser floored it at the padding's height and the
          * closed button came out visibly too tall. Inside a wrapper, the
          * panel is free to be forty pixels and simply clips this.
          */}
        <div className="mm-inner">
          <nav className="mm-links">
            {items.map((item, i) => (
              <div className="mm-row" key={item.to} style={{ '--i': i }}>
              <Link
                className="mm-link"
                to={item.to}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </div>
          ))}
          </nav>

          {email ? (
            <div className="mm-foot" style={{ '--i': items.length }}>
              <span className="mm-foot-label">Work with us</span>
              <a
                className="mm-foot-link"
                href={`mailto:${email}`}
                tabIndex={open ? 0 : -1}
              >
                {email}
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="mm-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
      >
        {/*
          * Three lines that become a cross. The outer two travel to the middle
          * and rotate; the one already there fades, because a third bar cannot
          * go anywhere useful in a two-stroke X.
          *
          * Moving and turning are split across two transitions with the second
          * held back, so the bars meet in the middle first and only then
          * rotate. Done together they cross while still apart and read as a
          * shape collapsing rather than a cross being drawn.
          */}
        <span className="mm-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
    </div>
  )
}
