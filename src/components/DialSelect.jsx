import { useEffect, useId, useRef, useState } from 'react'
import './DialSelect.css'

/*
 * The country code picker, built rather than borrowed.
 *
 * A native <select> renders its open list as an operating-system menu — dark on
 * a Mac, a full-screen wheel on a phone — and no amount of CSS reaches inside
 * it. That is the whole reason the old one looked like it came from somewhere
 * else: it did. The closed field could be styled and the list could not, so the
 * two never belonged to the same form.
 *
 * A listbox has to earn what the native control gave away for free, so: arrows
 * and Home/End move, Enter and Space commit, Escape and an outside press close,
 * typing a letter jumps to it, and the open list is described to assistive
 * technology through aria-activedescendant rather than by moving focus into it.
 */
export default function DialSelect({ options, value, onChange, label = 'Country code' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.dial === value)))
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId().replace(/:/g, '')

  const chosen = options.find((o) => o.dial === value) || options[0]

  useEffect(() => {
    if (!open) return undefined
    /* Opening on the current value, not on wherever it was left last time. */
    setActive(Math.max(0, options.findIndex((o) => o.dial === value)))

    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, options, value])

  /* Keep the highlighted row in view when the arrows walk past the edge of the
     scroll box — a selection you cannot see is not a selection. */
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const commit = (i) => {
    onChange(options[i].dial)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      commit(active)
    } else if (/^[a-z0-9+]$/i.test(e.key)) {
      /* Type-ahead. Letters within a second of each other build a search;
         after that the run has ended and the next letter starts a new one. */
      const now = e.timeStamp
      const text = now - typed.current.at < 1000 ? typed.current.text + e.key : e.key
      typed.current = { text, at: now }
      const hit = options.findIndex((o) =>
        `${o.code} ${o.dial}`.toLowerCase().startsWith(text.toLowerCase()),
      )
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <div className="ds" ref={rootRef}>
      <button
        type="button"
        className="ds-field"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="ds-value">
          {chosen.code} {chosen.dial}
        </span>
        {/*
          * Drawn, not the native triangle. The one a select brings sits hard
          * against the control's own edge with no say in the matter, which is
          * why it was crowding the hairline.
          */}
        <svg className="ds-chev" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1.5 1.75 6 6.25l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul className="ds-list" id={`${id}-list`} role="listbox" ref={listRef} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.code}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.dial === value}
              data-on={i === active}
              className="ds-opt"
              /* Pointer down rather than click: the outside-press handler runs
                 on pointerdown too, and a click would arrive after it had
                 already shut the list. */
              onPointerDown={(e) => {
                e.preventDefault()
                commit(i)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ds-opt-code">{o.code}</span>
              <span className="ds-opt-dial">{o.dial}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
