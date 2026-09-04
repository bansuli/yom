import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Beta from '../Beta.jsx'
import './SignInDialog.css'

/*
 * Signing in without leaving the page.
 *
 * The form itself is not rebuilt here. It lives in Beta along with the phone
 * and Google flows and the account panel, and all of that is real
 * authentication — a second copy of it that only looked the same would be a
 * second copy to keep correct. So Beta is mounted in dialog dress instead: same
 * component, same handlers, told to hand back the moment it has a session
 * rather than carrying on into the panel, which has nowhere to go in a box this
 * size.
 *
 * The page behind is blurred by this element's own backdrop-filter rather than
 * by a filter on the page. Filtering the page would give every fixed child a
 * new containing block — the header and the grain would both come unstuck from
 * the viewport — for a result nobody could tell apart.
 */
export default function SignInDialog({ open, onClose }) {
  const panelRef = useRef(null)
  const restoreTo = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined

    restoreTo.current = document.activeElement
    /* The page under a modal should not scroll away behind it. */
    const wasOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      /*
       * Kept inside. Tabbing out of an open dialog lands you on the page behind
       * it, which is inert to look at and still perfectly focusable — you end
       * up typing into something you cannot see.
       */
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = wasOverflow
      /* Back to whatever opened it, so a keyboard is not dropped at the top of
         the document every time this closes. */
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  /* Signed in: close, and go to the account page, which is where the panel this
     dialog will not render actually lives. */
  const onAuthed = useCallback(() => {
    onClose()
    navigate('/signin')
  }, [onClose, navigate])

  if (!open) return null

  return (
    <div
      className="sid"
      role="presentation"
      /* Only a press that both starts and ends on the backdrop closes it — a
         drag that began inside the panel and released outside is a selection
         being made, not a dismissal. */
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="sid-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to yom"
        tabIndex={-1}
        ref={panelRef}
      >
        <button type="button" className="sid-close" onClick={onClose} aria-label="Close sign in">
          ×
        </button>
        <Beta variant="dialog" onAuthed={onAuthed} />
      </div>
    </div>
  )
}
