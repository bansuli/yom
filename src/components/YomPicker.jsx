import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Pet from './Pet.jsx'
import { VARIANTS, VARIANT_NAMES } from './petVariants.js'
import './YomPicker.css'

/*
 * The way in, and the choice, in one control.
 *
 * Hovering or clicking the call to action sends the four of them out from
 * behind it into an arc; picking one carries that choice into onboarding. It is
 * the same gesture either way, so nothing here depends on a pointer that can
 * hover — a touch opens it exactly as a cursor does, and the first tap reveals
 * rather than navigating.
 *
 * Two things worth knowing about how it is wired:
 *
 * The button is a button, not a link. It has to be able to open something
 * without going anywhere, and a link that swallows its own navigation on the
 * first click is a link that lies about what it does — middle-click and
 * open-in-new-tab would both do the wrong thing.
 *
 * The four pets are mounted the first time it opens and never unmounted. Each
 * one is a WebGL context and a browser hands out about sixteen, so mounting
 * them on every open would burn through the budget in a couple of minutes of
 * fiddling; building them once and leaving them is both cheaper and smoother.
 */

/*
 * Where each one lands, as a fraction of the arc's size. Written here rather
 * than computed from an angle because the arc is shallow and hand-placing four
 * points reads better than the circle they nearly sit on.
 */
const ARC = [
  { x: 0.1, y: -0.72 },
  { x: 1.24, y: -1.06 },
  { x: 2.38, y: -1.06 },
  { x: 3.52, y: -0.72 },
]

export default function YomPicker({ to = '/onboarding', label = 'Create your yom' }) {
  const [open, setOpen] = useState(false)
  /* Built on first open and kept — see the note above about contexts. */
  const [armed, setArmed] = useState(false)
  const [hovered, setHovered] = useState(null)
  const rootRef = useRef(null)
  const panelId = useId()
  const navigate = useNavigate()

  function reveal() {
    setArmed(true)
    setOpen(true)
  }

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

  function choose(name) {
    setOpen(false)
    /*
     * The choice travels in the URL rather than in memory, so it survives the
     * navigation and a reload, and so onboarding can read it without this
     * component and that one having to agree on a store first.
     */
    navigate(`${to}?yom=${encodeURIComponent(name)}`)
  }

  return (
    <div
      className="yp"
      ref={rootRef}
      data-open={open || undefined}
      /*
       * Enter opens, leave closes — but bound to the whole control rather than
       * to the button, because the arc is a child of this element. Crossing the
       * gap from the button up to the pets therefore never leaves it, which is
       * what lets the cursor reach them at all.
       */
      onMouseEnter={reveal}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="yp-fan" aria-hidden={!open}>
        {/* Only ever announced on the small screens it is written for. */}
        <span className="yp-hint">pick your yom</span>

        <ul className="yp-list" id={panelId} role="listbox" aria-label="Pick your yom">
          {VARIANT_NAMES.map((name, i) => (
            <li
              key={name}
              className="yp-slot"
              style={{ '--x': ARC[i].x, '--y': ARC[i].y, '--i': i }}
            >
              <button
                type="button"
                className="yp-one"
                role="option"
                aria-selected="false"
                aria-label={VARIANTS[name].label}
                tabIndex={open ? 0 : -1}
                onMouseEnter={() => setHovered(name)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(name)}
                onBlur={() => setHovered(null)}
                onClick={() => choose(name)}
              >
                {armed ? (
                  <Pet
                    variant={name}
                    expression={hovered === name ? 'happy' : 'resting'}
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="yp-cta home-cta"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : reveal())}
        onFocus={reveal}
      >
        {label}
        <span className="home-cta-arrow" aria-hidden="true">
          →
        </span>
      </button>
    </div>
  )
}
