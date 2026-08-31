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
          <p className="brand" aria-label="yom">
            <span className="brand-y">y</span>
            <span className="brand-o">o</span>
            <span className="brand-m">m</span>
          </p>
          <div className="brand-rule" aria-hidden="true" />
        </div>
      </section>
    </div>
  )
}

export default App
