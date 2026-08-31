import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LayerNav from './components/LayerNav.jsx'
import { loadBetaSession } from './lib/yom-api.js'
import { captureAcquisitionFromUrl, track } from './lib/analytics.js'
import { captureLead } from './lib/capture-lead.js'
import './App.css'

function App() {
  // Signed in, the third nav item is a way back into your yom rather than an
  // invitation to sign in again.
  const [signedIn] = useState(() => Boolean(loadBetaSession()?.access_token))
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [waitlistBusy, setWaitlistBusy] = useState(false)
  const [waitlistErr, setWaitlistErr] = useState('')

  useEffect(() => {
    const acq = captureAcquisitionFromUrl()
    track('landing_viewed', { path: '/' })
    if (acq.qr) track('qr_scanned', { path: '/' })
  }, [])

  const closeModal = () => {
    setWaitlistOpen(false)
    setEmail('')
    setSubmitted(false)
    setWaitlistErr('')
    setWaitlistBusy(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setWaitlistBusy(true)
    setWaitlistErr('')
    track('signup_started', { channel: 'waitlist' })
    const res = await captureLead({ email, channel: 'waitlist', path: '/' })
    setWaitlistBusy(false)
    if (!res.ok && !res.fallback) {
      setWaitlistErr(res.error || 'Could not save — try again.')
      return
    }
    track('signup_completed', { channel: 'waitlist', allowlisted: res.allowlisted })
    setSubmitted(true)
  }

  return (
    <div className="page">
      <section className="hero" aria-label="yom homepage">
        <LayerNav
          items={[
            { label: 'About', to: '/about' },
            { label: 'How it works', to: '/how-it-works' },
            { label: 'Start a trip', to: '/onboarding' },
            signedIn
              ? { label: 'Your yom', to: '/me' }
              : { label: 'Sign in', to: '/signin' },
          ]}
          email="support@youryom.com"
        />

        <div className="hero-center">
          <p className="brand" aria-label="yom">
            <span className="brand-y">y</span>
            <span className="brand-o">o</span>
            <span className="brand-m">m</span>
          </p>
          <h1 className="hero-line">
            Let&rsquo;s go on a shopping trip together
          </h1>
          <div className="cta-row">
            <Link className="cta cta-primary" to="/onboarding">
              I&rsquo;m in
            </Link>
          </div>
        </div>
      </section>

      {waitlistOpen && (
        <div className="waitlist-overlay" onClick={closeModal}>
          <div className="waitlist-modal" onClick={e => e.stopPropagation()}>
            <button className="waitlist-close" onClick={closeModal}>✕</button>

            {!submitted ? (
              <>
                <h2 className="waitlist-headline">Join the waitlist</h2>
                <p className="waitlist-body">Be first to know when Yom is ready for you.</p>
                <form className="waitlist-form" onSubmit={handleSubmit}>
                  <input
                    type="email"
                    className="waitlist-input"
                    placeholder="Your email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={waitlistBusy}
                  />
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="yom-hp" aria-hidden="true" />
                  <button type="submit" className="waitlist-cta" disabled={waitlistBusy}>
                    {waitlistBusy ? 'Saving…' : 'Join →'}
                  </button>
                </form>
                {waitlistErr && <p className="waitlist-body" style={{ color: '#8b1e1e' }}>{waitlistErr}</p>}
                <div className="waitlist-nudge">
                  <p>Don&rsquo;t forget — take Yom on a shopping trip too. That&rsquo;s how Yom actually learns about you.</p>
                  <Link to="/onboarding" className="waitlist-trip-link" onClick={closeModal}>Go on a trip with Yom →</Link>
                  <Link to="/signin" className="waitlist-trip-link" onClick={closeModal}>Already have an account? Sign in →</Link>
                  <Link to="/scan" className="waitlist-trip-link" onClick={closeModal}>Scan a piece on your phone →</Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="waitlist-headline">You&rsquo;re on the list</h2>
                <p className="waitlist-body">We&rsquo;ll be in touch when Yom is ready for you.</p>
                <div className="waitlist-nudge">
                  <p>Now — take Yom on a shopping trip. That&rsquo;s how Yom gets to know you before we launch.</p>
                  <Link to="/onboarding" className="waitlist-cta" onClick={closeModal}>Take Yom shopping →</Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
