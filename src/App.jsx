import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import sneakerImg from './assets/product-sneaker-nobg.webp'
import shirtImg from './assets/product-shirt-nobg.webp'
import cardiganImg from './assets/product-cardigan-nobg.webp'
import tabiImg from './assets/product-tabi-nobg.webp'
import tankImg from './assets/product-tank-nobg.webp'
import pantsImg from './assets/PRECIOUS V3 PANTS BLUE & PINK BY COLD CULTURE-nobg.webp'
import bagImg from './assets/Isabel Marant Maia Large Cognac Shoulder Bag & Authentic-nobg.webp'
// Every product photo again with its background actually cut away. Phones get
// these; the desktop collage keeps the original files exactly as they were.
import cutSneaker from './assets/cut-sneaker.webp'
import cutShirt from './assets/cut-shirt.webp'
import cutCardigan from './assets/cut-cardigan.webp'
import cutTabi from './assets/cut-tabi.webp'
import cutTank from './assets/cut-tank.webp'
import cutPants from './assets/cut-pants.webp'
import cutBag from './assets/cut-bag.webp'
import cutPuzzle from './assets/cut-puzzle.webp'
import extraImg from './assets/8e33e8051d690d5d76801ad0d826fdc8-nobg.webp'
import { captureAcquisitionFromUrl, track } from './lib/analytics.js'
import { captureLead } from './lib/capture-lead.js'
import './App.css'

const NAV = [
  { label: 'about', angle: -3 },
  { label: 'how it works', angle: 2 },
  { label: 'join waitlist', angle: -1 },
]

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
        <div className="sticker prod-sneaker">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutSneaker} />
            <img src={sneakerImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-shirt">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutShirt} />
            <img src={shirtImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-cardigan">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutCardigan} />
            <img src={cardiganImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-tabi">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutTabi} />
            <img src={tabiImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-tank">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutTank} />
            <img src={tankImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-pants">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutPants} />
            <img src={pantsImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-bag">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutBag} />
            <img src={bagImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>
        <div className="sticker prod-extra">
          <picture>
            <source media="(max-width: 640px)" srcSet={cutPuzzle} />
            <img src={extraImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block' }} />
          </picture>
        </div>

        <nav className="tilted-nav" aria-label="Primary">
          {NAV.map((item) => (
            item.label === 'about' ? (
              <Link
                key={item.label}
                to="/about"
                className="nav-pill"
                style={{ '--angle': `${item.angle}deg` }}
              >
                {item.label}
              </Link>
            ) : item.label === 'how it works' ? (
              <Link
                key={item.label}
                to="/how-it-works"
                className="nav-pill"
                style={{ '--angle': `${item.angle}deg` }}
              >
                {item.label}
              </Link>
            ) : item.label === 'join waitlist' ? (
              <a
                key={item.label}
                href="#waitlist"
                className="nav-pill nav-pill-waitlist"
                style={{ '--angle': `${item.angle}deg` }}
                onClick={e => { e.preventDefault(); setWaitlistOpen(true) }}
              >
                {item.label}
              </a>
            ) : (
              <a
                key={item.label}
                href={`#${item.label.toLowerCase().replace(/ /g, '-')}`}
                className="nav-pill"
                style={{ '--angle': `${item.angle}deg` }}
              >
                {item.label}
              </a>
            )
          ))}
        </nav>

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
            <Link className="cta cta-primary" to="/survey">
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
                  <Link to="/survey" className="waitlist-trip-link" onClick={closeModal}>go on a trip with yom →</Link>
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
                  <Link to="/survey" className="waitlist-cta" onClick={closeModal}>take yom shopping →</Link>
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
