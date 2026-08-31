import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { captureAcquisitionFromUrl, track } from './lib/analytics.js'
import './App.css'

/*
 * The homepage, stripped back to the wordmark to be rebuilt on.
 *
 * The nav, the line, the button and the waitlist modal are gone. The modal was
 * already unreachable — nothing had called setWaitlistOpen(true) for a while —
 * so it went with the rest rather than being kept as a dead branch.
 *
 * The tracking below stays. It is not something on the page: it reads the
 * acquisition parameters off the URL before they are lost on the first
 * navigation, which is how a QR scan or a campaign link is attributed at all.
 * Dropping it would quietly break attribution rather than clear the canvas.
 */
function App() {
  useEffect(() => {
    const acq = captureAcquisitionFromUrl()
    track('landing_viewed', { path: '/' })
    if (acq.qr) track('qr_scanned', { path: '/' })
  }, [])

  return (
    <div className="page">
      <section className="hero" aria-label="yom homepage">
        <div className="hero-center">
          <div className="brand-rule brand-rule-top" aria-hidden="true" />

          <p className="brand" aria-label="yom">
            <span className="brand-y">y</span>
            <span className="brand-o">o</span>
            <span className="brand-m">m</span>
          </p>
          <div className="brand-rule" aria-hidden="true" />

          {/* Help has no page of its own, so it goes where the help actually
              is rather than to a route invented to receive it. */}
          <nav className="brand-links" aria-label="Site">
            <Link to="/about">About yom</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:support@youryom.com">Help</a>
          </nav>
        </div>
      </section>
    </div>
  )
}

export default App
