import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TokenField from './components/TokenField.jsx'
import Doll from './components/Doll.jsx'
import WorkSection from './components/WorkSection.jsx'
import SignInDialog from './components/SignInDialog.jsx'
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
/* Withheld and then given, one letter at a time. Kept out here so the effect
   below and the markup agree on its length without either one counting. */
const NAME = 'meet yom.'

function App() {
  const [signIn, setSignIn] = useState(false)
  /* How much of her name has been said, and how far past it the introduction
     has got. See the effect below. */
  const [typed, setTyped] = useState(0)
  const [step, setStep] = useState(0)
  /* Memoised: the dialog keys an effect on it, and a fresh arrow every render
     would tear that effect down and set it up again on each keystroke. */
  const closeSignIn = useCallback(() => setSignIn(false), [])

  useEffect(() => {
    const acq = captureAcquisitionFromUrl()
    track('landing_viewed', { path: '/' })
    if (acq.qr) track('qr_scanned', { path: '/' })
  }, [])

  /*
   * The introduction, on its own clock.
   *
   *   MEET YOM     one letter at a time
   *   1            she arrives, at rest
   *   2            and smiles
   *   3            and settles back
   *
   * What the page is for is already on it, in ink, before any of that happens.
   * Only her name is withheld, because her name is the only part that needs
   * introducing — the rest is a caption and a caption does not get an entrance.
   *
   * Timers rather than scroll, because this is a greeting and a greeting has a
   * pace of its own. Tied to the wheel it would run at whatever speed someone
   * happened to be turning it, which is the one thing a hello cannot do.
   *
   * It never gates anything: every word is in the markup from the first paint
   * and the steps only turn opacity on, so a reader who scrolls straight past
   * has missed a flourish rather than the content.
   */
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTyped(NAME.length)
      setStep(3)
      return undefined
    }

    /*
     * Milliseconds from the first moment anyone can see the page.
     *
     * The gap between her arriving and her smiling is the longest pause in the
     * sequence, and it is the one doing the work: she has to be still for a
     * beat before she can be seen to change. Landed already smiling she is a
     * picture of a smiling character; landed at rest and then smiling, she is
     * someone who has just noticed you.
     *
     * And then it goes. A smile held forever is a mask — it is the face
     * dropping back that makes the one before it read as something she did
     * rather than something she is drawn with.
     */
    const LETTER = 62
    const at = [1080, 1760, 3100]
    let ids = []

    /*
     * Waits for the tab to actually be looked at.
     *
     * Timers in a background tab are coalesced and then flushed all at once
     * when it comes forward, so a page opened in a new tab and read a minute
     * later would run its whole introduction inside a single frame — every
     * word, her arrival and her smile, over before the first paint anyone saw.
     * Started on the first visible moment instead, the greeting happens when
     * there is somebody there for it.
     */
    const start = () => {
      let n = 0
      const typing = setInterval(() => {
        n += 1
        setTyped(n)
        if (n >= NAME.length) clearInterval(typing)
      }, LETTER)
      ids = [
        () => clearInterval(typing),
        ...at.map((ms, i) => {
          const id = setTimeout(() => setStep(i + 1), ms)
          return () => clearTimeout(id)
        }),
      ]
    }

    if (document.visibilityState === 'visible') {
      start()
      return () => ids.forEach((stop) => stop())
    }

    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', onShow)
      start()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onShow)
      ids.forEach((stop) => stop())
    }
  }, [])

  return (
    <>
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
          {/*
            * Fragments, not routes. Both of these are places further down this
            * same page now, and a plain anchor does the whole job natively — it
            * scrolls, it updates the address, and it still opens in a new tab
            * or gets copied like the link it is.
            */}
          <a href="#about">About yom</a>
          <a href="#how">How it works</a>

          {/* A button, not a link: it opens something here rather than going
              anywhere, and a link that does not navigate lies to anyone reading
              the status bar or opening it in a new tab. */}
          <button type="button" onClick={() => setSignIn(true)}>
            Sign in
          </button>

          {/*
            * The one thing in the bar asking to be pressed, and the only one
            * set apart. A rule around it and the ink filled in is enough at
            * this size — a filled pill here would be a SaaS button parked on an
            * editorial rule, and it would be the loudest thing on the page
            * before anyone had read a word.
            */}
          <Link to="/onboarding" className="home-get">
            Get yom <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </header>

      <section className="home-stage">
        {/*
          * Type first, and at the top edge — the headline is the layout rather
          * than a block sitting inside one. Everything else is placed against
          * it: a tag on the pet, the small print in the corner, the way in
          * under the words.
          */}
        {/*
          * An introduction, in the order an introduction happens.
          *
          * Her name first and one word at a time, so it lands as a name rather
          * than as a headline. Then she arrives and smiles — which is the only
          * moment on the page where she does something rather than being
          * looked at, and it is what turns her from a graphic into someone.
          * Only then does the page say what she is for.
          *
          * The old headline said what she was over a character nobody had been
          * told the name of, so she read as decoration on a product line. Named
          * first, everything after it is about her.
          */}
        {/*
          * Her name, and then her, on the same line.
          *
          * She used to sit in the middle of the screen a long way under the
          * words, which made her an illustration of a page about a product.
          * Set into the sentence that names her, the sentence and the character
          * are one statement: this is yom, and yom is her. Nothing else on the
          * page has to explain the connection because there is no gap left to
          * explain across.
          *
          * She is inside the heading and hidden from readers — the heading
          * already says her name, and a canvas announcing itself in the middle
          * of it would only say it twice.
          */}
        <h1 className="home-head">
          <span className="home-name">
            {NAME.split('').map((ch, i) => (
              <span
                // Positional by nature: the same letter appears more than once
                // in this string and it is the place in the word that is being
                // revealed, not the character.
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                data-on={i < typed || undefined}
              >
                {ch === ' ' ? '\u00a0' : ch}
              </span>
            ))}
          </span>

          {/* A cell of its own, not a span inside the name — nested in the line
              she was capped at whatever the leading could absorb, and every
              grid placement written for her was inert. */}
          <span className="home-face" data-on={step >= 1 || undefined} aria-hidden="true">
            <Doll expression={step === 2 ? 'happy' : 'resting'} />
          </span>

          {/* Already there, in ink, before anything has happened. It is what
              the page is about rather than part of the greeting. */}
          <span className="home-role">your online shopping companion.</span>
        </h1>

      </section>

      <WorkSection />

    </main>

      <SignInDialog open={signIn} onClose={closeSignIn} />
    </>
  )
}

export default App
