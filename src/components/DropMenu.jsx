import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './DropMenu.css'

/*
 * A mega drop-down: a list on the left, a card on the right.
 *
 * The card is the whole idea. Moving down the names swaps what is shown beside
 * them — art, a heading and a line about it — so the menu previews where you
 * are about to go instead of only naming it. A drop-down that is just its own
 * links in a box is a list with extra steps.
 *
 * The description types itself in each time the card changes. Fast enough to
 * read as the panel catching up rather than as something being performed at
 * you: two characters a tick, so a line lands in about a fifth of a second.
 */

/* Milliseconds a tick, and characters a tick. */
const TICK = 11
const PER_TICK = 2

function useTyped(text, live) {
  const [shown, setShown] = useState(text)

  useEffect(() => {
    if (!live) {
      setShown(text)
      return undefined
    }

    /*
     * Typing is decoration, and decoration that cannot be turned off is a
     * problem for anyone who gets motion sick or simply needs to read. Off, the
     * line is just there.
     */
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(text)
      return undefined
    }

    setShown('')
    let n = 0
    const id = setInterval(() => {
      n += PER_TICK
      setShown(text.slice(0, n))
      if (n >= text.length) clearInterval(id)
    }, TICK)
    return () => clearInterval(id)
  }, [text, live])

  return shown
}

export default function DropMenu({ items = [], label = 'Menu' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const panelId = useId()

  const item = items[active] ?? items[0]
  /*
   * Keyed on the item as well as the open state, so the line retypes when the
   * card swaps and not only when the panel first appears.
   */
  const typed = useTyped(item?.note ?? '', open)

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
    <div className="dm" ref={rootRef} data-open={open || undefined}>
      <button
        type="button"
        className="dm-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-label={label}
      >
        {/*
          * Three lines that become a cross. The outer two travel to the middle
          * and then rotate — two transitions with the second held back, so the
          * bars meet before they turn. Done together they cross while still
          * apart and read as a shape collapsing rather than a cross being
          * drawn. The middle one fades, because a third bar has nowhere useful
          * to go in a two-stroke X.
          */}
        <span className="dm-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {/*
        * Kept mounted while shut rather than unmounted, so opening and closing
        * are one transition run in two directions. Mounted on demand it would
        * have nothing to animate from going in and would vanish going out.
        */}
      <div className="dm-panel" id={panelId} role="menu" aria-hidden={!open}>
        <ul className="dm-list">
          {items.map((it, i) => (
            <li key={it.to}>
              <Link
                to={it.to}
                role="menuitem"
                className="dm-name"
                data-on={i === active || undefined}
                style={{ '--i': i }}
                tabIndex={open ? 0 : -1}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="dm-card">
          <span
            className="dm-card-art"
            style={{ '--tint': item?.tint ?? '#e85a86' }}
            aria-hidden="true"
          />
          <span className="dm-card-title">{item?.label}</span>
          <p className="dm-card-note">
            {/* The real line, for anything reading rather than watching. */}
            <span className="dm-sr">{item?.note}</span>
            <span className="dm-card-typed" aria-hidden="true">
              {typed}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
