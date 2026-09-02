import { useEffect } from 'react'
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
      <section className="home-stage">
        <div className="home-pet">
          <Pet />
        </div>
      </section>
    </main>
  )
}

export default App
