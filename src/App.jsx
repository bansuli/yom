import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import DropMenu from './components/DropMenu.jsx'
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
      <header className="home-bar">
        <Link to="/" className="home-mark" aria-label="yom, home">
          yom
        </Link>
        <DropMenu
          items={[
            {
              label: 'Sign in',
              to: '/signin',
              note: 'Pick up where you left off.',
              tint: '#4A7BE8',
            },
            {
              label: 'About yom',
              to: '/about',
              note: 'Why we built it, and who it is for.',
              tint: '#e85a86',
            },
            {
              label: 'How it works',
              to: '/how-it-works',
              note: 'What yom does on a product page.',
              tint: '#6faa10',
            },
          ]}
        />
      </header>

      <section className="home-stage">
        <div className="home-pet">
          <Pet />
        </div>
      </section>
    </main>
  )
}

export default App
