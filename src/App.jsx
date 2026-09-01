import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import GravityPills from './components/GravityPills.jsx'
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
        {/*
          * The top bar is laid over the pill yard rather than stacked above it.
          * Everything in this column shares its height with the pills, which
          * take whatever is left over, so a row added in the normal way would
          * come straight out of the pile. Overlaid it costs nothing, and the
          * pills fall past it on the way down.
          */}
        <div className="top-bar">
          <div className="top-bar-left">
            <span className="top-mark">yom</span>
            <span className="chip">Open beta</span>
          </div>
          <Link to="/onboarding" className="top-cta">
            Create your yom <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="hero-center">
          <GravityPills />

          <div className="brand-rule brand-rule-top" aria-hidden="true" />

          {/* Placeholder copy — the shape is right, the words are yours. */}
          <div className="brand-lede">
            <div className="brand-lede-say">
              <h1 className="brand-lede-line">AI online shopping companion</h1>
              <p className="brand-lede-sub">
                Yom sits with you while you shop. It reads the fit, learns your
                taste, and tells you the truth.
              </p>
              {/*
                * One action, not two. "See how it works" was a third route to
                * a page the footer already lists, and it competed with the
                * thing the page actually wants you to do.
                *
                * The wording is the product's own: "create your yom" is what
                * the join flow already calls this. "Early access" was wrong for
                * the same reason "start a trip" was — the beta is open, there
                * is no list to get onto, and a CTA that implies a queue asks
                * people to wait for something they can already have.
                */}
              <div className="brand-lede-cta">
                <Link to="/onboarding" className="btn btn-primary">
                  Create your yom
                </Link>
                <span className="brand-lede-note">
                  Free while we are in beta. No card.
                </span>
              </div>
            </div>

            {/*
              * Three claims, in the machine voice. The third is the one worth
              * having: saying nothing when the data is thin is the position
              * docs/SIZING.md takes, and it is the hardest of the three for
              * anyone else to copy.
              */}
            <dl className="spec">
              <div className="spec-row">
                <dt>Reads</dt>
                <dd>Size, fit and returns off the listing you are already on.</dd>
              </div>
              <div className="spec-row">
                <dt>Learns</dt>
                <dd>What you actually wear, not what you clicked on.</dd>
              </div>
              <div className="spec-row">
                <dt>Holds back</dt>
                <dd>Says nothing when the data is not there to say it.</dd>
              </div>
            </dl>
          </div>

          <p className="brand" aria-label="yom">
            <span className="brand-y">y</span>
            <span className="brand-o">o</span>
            <span className="brand-m">m</span>
          </p>
          <div className="brand-rule" aria-hidden="true" />

          {/* Help has no page of its own, so it goes where the help actually
              is rather than to a route invented to receive it. */}
          <nav className="brand-links" aria-label="Site">
            {/* An anchor at the left edge. Spread across the full width with
                nothing holding either end, the row floated free of the page. */}
            <span className="brand-links-mark" aria-hidden="true">
              yom
            </span>
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
