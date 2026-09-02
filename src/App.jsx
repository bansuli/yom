import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import TokenField from './components/TokenField.jsx'
import Pet from './components/Pet.jsx'
import { captureAcquisitionFromUrl, track } from './lib/analytics.js'
import './App.css'

/*
 * The homepage, cleared back to the pet.
 *
 * Everything that was here is off the page rather than out of the repository:
 * the falling clothes, the wordmark, the rules, the one-liner, the footer and
 * the way-in animation. GravityPills, heroGarments and heroArtwork are
 * untouched, docs/HERO_OBJECTS.md still describes how the objects are made and
 * docs/NAVBARS.md holds both parked navbars. Nothing has to be rebuilt to bring
 * any of it back.
 *
 * It sits on its own class rather than on .hero, which Join, Survey and the
 * account panel also use. The old homepage had grown a ground colour and a pair
 * of gutter rules on .hero, and those were quietly drawing on all three of
 * them; both are gone with it.
 *
 * The tracking below stays. It is not something on the page: it reads the
 * acquisition parameters off the URL before they are lost on the first
 * navigation, which is how a QR scan or a campaign link is attributed at all.
 * Dropping it would break attribution rather than clear the canvas.
 */
function App() {
  useEffect(() => {
    const acq = captureAcquisitionFromUrl()
    track('landing_viewed', { path: '/' })
    if (acq.qr) track('qr_scanned', { path: '/' })
  }, [])

  return (
    <main className="home">
      {/* Behind everything, and hidden from readers — it is texture. */}
      <TokenField />

      {/*
        * Laid over the page rather than stacked above it, so the pet's screen
        * is a whole viewport tall and the bar costs it nothing.
        */}
      {/*
        * The old footer row, moved to the top: a line edge to edge with the
        * mark and the routes sitting on it. Mono, small and letterspaced,
        * which is the machine voice this site uses for anything that labels
        * rather than speaks.
        */}
      <header className="home-line">
        <nav className="home-line-row" aria-label="Site">
          <Link to="/" className="home-mark" aria-label="yom, home">
            yom
          </Link>
          <Link to="/signin">Sign in</Link>
          <Link to="/about">About yom</Link>
          <Link to="/how-it-works">How it works</Link>
        </nav>
      </header>

      <section className="home-stage">
        {/*
          * Everything the first screen has to say, in one column on the left.
          * The right is left to the field of shop language, which is the only
          * other thing on this screen and reads as part of the composition
          * rather than as wallpaper behind it.
          */}
        <div className="home-say">
          <p className="home-eyebrow">An online shopping companion</p>

          {/*
            * Two tones, one sentence. The problem is set back and the answer
            * is in full ink, so the turn lands on "yom does." rather than
            * having to be underlined or coloured.
            */}
          <h1 className="home-head">
            <span className="home-head-set">your shopping knows nothing about you.</span>{' '}
            <span className="home-head-turn">yom does.</span>
          </h1>

          <p className="home-sub">
            it learns your taste, remembers what you own, and does the research
            while you shop.
          </p>

          {/*
            * A line and an arrow, not a filled pill. The page is built out of
            * hairlines and letterspaced mono, and a glossy button would be the
            * only object of its kind on it.
            */}
          <Link to="/onboarding" className="home-cta">
            Create your yom
            <span className="home-cta-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <div className="home-pet">
          <Pet />
        </div>
      </section>
    </main>
  )
}

export default App
