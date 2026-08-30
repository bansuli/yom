import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import GooeyNavbar from './components/GooeyNavbar.jsx'
import { captureAcquisitionFromUrl, track } from './lib/analytics.js'
import { captureLead } from './lib/capture-lead.js'
import './App.css'

function App() {
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
      setWaitlistErr(res.error || 'could not save — try again.')
      return
    }
    track('signup_completed', { channel: 'waitlist', allowlisted: res.allowlisted })
    setSubmitted(true)
  }

  return (
    <div className="page">
      <section className="hero" aria-label="yom homepage">
        <GooeyNavbar
          items={[
            { label: 'about', to: '/about' },
            { label: 'how it works', to: '/how-it-works' },
            { label: 'sign in', to: '/beta' },
          ]}
        />

        <div className="hero-center">
          <p className="brand" aria-label="yom">
            <span className="brand-y">y</span>
            <span className="brand-o">o</span>
            <span className="brand-m">m</span>
          </p>
          <h1 className="hero-line">
            let's go on a shopping trip together
          </h1>
          <div className="cta-row">
            <Link className="cta cta-primary" to="/onboarding">
              i'm in
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
                <h2 className="waitlist-headline">join the waitlist.</h2>
                <p className="waitlist-body">be first to know when yom is ready for you.</p>
                <form className="waitlist-form" onSubmit={handleSubmit}>
                  <input
                    type="email"
                    className="waitlist-input"
                    placeholder="your email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={waitlistBusy}
                  />
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="yom-hp" aria-hidden="true" />
                  <button type="submit" className="waitlist-cta" disabled={waitlistBusy}>
                    {waitlistBusy ? 'saving…' : 'join →'}
                  </button>
                </form>
                {waitlistErr && <p className="waitlist-body" style={{ color: '#8b1e1e' }}>{waitlistErr}</p>}
                <div className="waitlist-nudge">
                  <p>don&rsquo;t forget — take yom on a shopping trip too. that&rsquo;s how yom actually learns about you.</p>
                  <Link to="/onboarding" className="waitlist-trip-link" onClick={closeModal}>go on a trip with yom →</Link>
                  <Link to="/beta" className="waitlist-trip-link" onClick={closeModal}>already in beta? log in →</Link>
                  <Link to="/scan" className="waitlist-trip-link" onClick={closeModal}>scan a piece on your phone →</Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="waitlist-headline">you&rsquo;re on the list.</h2>
                <p className="waitlist-body">we&rsquo;ll be in touch when yom is ready for you.</p>
                <div className="waitlist-nudge">
                  <p>now — take yom on a shopping trip. that&rsquo;s how yom gets to know you before we launch.</p>
                  <Link to="/onboarding" className="waitlist-cta" onClick={closeModal}>take yom shopping →</Link>
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
