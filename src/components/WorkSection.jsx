import { useEffect, useRef, useState } from 'react'
import ShopPage from './ShopPage.jsx'
import './WorkSection.css'

/*
 * One pair of jeans, and then the tabs.
 *
 * The shop is up first and by itself — the thing you actually wanted, in a
 * browser, looking perfectly reasonable. Then the tabs start landing on it, one
 * per turn of the wheel, until you cannot see the jeans any more.
 *
 * The pile is the whole argument and it is made without a word of it. Nobody
 * needs telling that twenty tabs is too many once they have watched the thing
 * they were trying to buy disappear underneath them. The line at the top only
 * turns up at the end, to agree with what the screen has already said.
 *
 * The shop is itself a tab — one card, filling the frame, with the listing
 * inside it. That is the repair: the tabs were landing *on* a page, which made
 * them a thing happening to the shop from outside. As one of them, the shop is
 * simply the tab you had open first, and everything after it is the same kind
 * of object arriving behind.
 *
 * The deck leans as it grows. The tilt is on the deck rather than on each card,
 * so every card shares one geometry — leaned individually they came out subtly
 * different shapes, tilted one way at one edge and another at the other.
 */

/*
 * The five places anyone actually ends up before buying a pair of jeans, in the
 * order they end up in them.
 */
const TABS = ['reviews', 'size charts', 'tiktok videos', 'reddit threads', 'the groupchat']

/*
 * The sentence, in two halves, in two places.
 *
 * The first is above the shop and drawn a letter at a time as the section
 * climbs into view — so it is being written while there is still only one tab
 * and nothing has gone wrong yet. The second waits until the third tab is on
 * screen and lands *under* the pile, which is the only place it can go: by then
 * the tabs are what it is about, and it has to read as what they added up to
 * rather than as a title sitting over them.
 */
const LEDE = 'buying one thing'
const TURN = 'became researching everything.'

/* The Evisu tab counts, so the third tab on screen is the second one to open. */
const TURN_AT = 2

/*
 * Where each beat sits, and there are two clocks rather than one.
 *
 * The page arrives on the section *rising into view* — how far its top edge has
 * come up the screen — not on the sticky rail. The rail's own progress cannot
 * begin until the section's top reaches the top of the window, which is a whole
 * screen of scrolling after the hero; on the rise clock the shop is already
 * coming up while the line above it is still leaving.
 *
 * Everything after is a fraction of the sticky run. The pile takes nearly all
 * of it, because the accumulation is the argument and it has to feel long.
 */
const PILE_START = 0.06
const PILE_END = 0.82

function span(p, a, b) {
  return Math.min(1, Math.max(0, (p - a) / (b - a)))
}

export default function WorkSection() {
  const railRef = useRef(null)
  const stageRef = useRef(null)

  /* How many tabs are down, and whether the shop is buried. Both change a
     handful of times across the whole scroll rather than every frame. */
  const [open, setOpen] = useState(0)
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    const rail = railRef.current
    const stage = stageRef.current
    if (!rail || !stage) return undefined

    let queued = false
    let lastOpen = -1
    let lastTyped = -1

    const measure = () => {
      queued = false
      const r = rail.getBoundingClientRect()
      const vh = window.innerHeight

      /* How far the section has climbed the window: 0 as its top edge touches
         the bottom, 1 as it reaches the top and the stage locks. */
      const rise = Math.min(1, Math.max(0, (vh - r.top) / vh))
      const run = r.height - vh
      const p = run <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / run))
      const arriving = r.top > 0

      /* Eased here rather than in CSS: a transition cannot be scrubbed, and a
         linear rise reads as a slide rather than as something arriving. */
      const ea = 1 - Math.pow(1 - (arriving ? rise : 1), 3)
      stage.style.setProperty('--rise', ea.toFixed(4))

      /*
       * The first half, drawn by the climb rather than on a timer. It finishes
       * exactly as the stage locks, so the line is complete the moment the shop
       * has settled and before anything has happened to it.
       */
      const t = Math.min(LEDE.length, Math.round(ea * LEDE.length))
      if (t !== lastTyped) {
        lastTyped = t
        setTyped(t)
      }

      /*
       * One tab per slice of the pile. Floor rather than round, so a tab is
       * either down or it is not — a tab caught half way is a tab that looks
       * like a rendering fault.
       */
      const filling = arriving ? 0 : span(p, PILE_START, PILE_END)
      const n = Math.min(TABS.length, Math.floor(filling * (TABS.length + 0.4)))
      if (n !== lastOpen) {
        lastOpen = n
        setOpen(n)
      }

    }

    /* Coalesced to a frame: scroll fires far more often than the screen
       updates, and none of this is read anywhere but at paint. */
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section className="wk" id="about" aria-labelledby="wk-title">
      {/* Tall, and only to be scrolled through — the stage inside it sticks. */}
      <div className="wk-rail" ref={railRef}>
        <div className="wk-stage" ref={stageRef}>
          {/*
            * The accessible name is the whole sentence; the letters below are
            * scenery. Read one span at a time it is not a line of type, it is
            * sixteen of them.
            */}
          <h2 className="wk-lede" id="wk-title" aria-label={`${LEDE} ${TURN}`}>
            <span aria-hidden="true">
              {LEDE.split('').map((ch, i) => (
                // Positional by nature: the same letter appears more than once
                // and it is the place in the line being revealed, not the
                // character.
                // eslint-disable-next-line react/no-array-index-key
                <span key={i} data-on={i < typed || undefined}>
                  {ch === ' ' ? '\u00a0' : ch}
                </span>
              ))}
            </span>
          </h2>

          <div className="wk-win">
            {/*
              * The deck. It carries the lean and the count, so the cards inside
              * only have to know their own index.
              */}
            <div className="wk-deck" style={{ '--open': open }}>
              {/*
                * The ones arriving behind. Each sits a fixed step higher than
                * the next, so they build upward out of the back of the shop and
                * only their bars ever show.
                */}
              <ul className="wk-pile">
                {TABS.map((t, i) => (
                  <li
                    className="wk-card wk-back"
                    key={t}
                    style={{ '--i': i }}
                    data-on={i < open || undefined}
                  >
                    <span className="wk-bar">
                      <span className="wk-x" />
                      <span className="wk-name">{t}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {/*
                * And the shop, in front, in a card of exactly the same make.
                * It steps down as the pile grows — which is what gives the ones
                * behind somewhere to appear, and what buries the listing.
                */}
              <div className="wk-card wk-front">
                <span className="wk-bar">
                  <span className="wk-x" />
                  <span className="wk-name">daicock print baggy-fit jeans #2000</span>
                </span>
                <div className="wk-front-body">
                  {/* Scaled rather than cropped — see .wk-zoom. */}
                  <div className="wk-zoom">
                    <ShopPage />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* And the other half, under the pile, once the third tab is up. */}
          <p className="wk-turn" data-on={open >= TURN_AT || undefined} aria-hidden="true">
            {TURN}
          </p>

          {/* The whole thing in words, for anything that cannot watch it. */}
          <p className="wk-sr">
            You find one pair of jeans you want. Then come the reviews, the size charts,
            the TikTok videos, the Reddit threads and the group chat — until you cannot
            see the jeans for the tabs. Buying one thing became researching everything.
          </p>
        </div>
      </div>
    </section>
  )
}
