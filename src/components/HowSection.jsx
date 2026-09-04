import { useEffect, useRef, useState } from 'react'
import './HowSection.css'

/*
 * The same purchase, decided.
 *
 * The section before this one ends on "or you could just ask yom", which is a
 * promise. This is the receipt: identical jeans, identical price, and the six
 * things you were going to spend two hours finding out arriving in a panel
 * beside them one at a time.
 *
 * Deliberately not a feature grid. A grid of six cards headed REVIEWS, FIT,
 * PRICE is a product page for the product — it explains what yom has rather
 * than showing what it does, and the difference between those two is the
 * difference between being told and being convinced. So the cards arrive on
 * the actual listing, in the actual sidebar, in the order they would.
 *
 * The panel is also the answer to "how it works", which is what the bar links
 * here for: yom is a thing that sits beside the shop and reads it. That is the
 * whole mechanic, and it is easier to show than to write.
 */

/*
 * Six, in the order a person would want them.
 *
 * Fit and reviews first because they decide whether you would wear it, price
 * and the closet next because they decide whether you should, and the two
 * logistics last because they only matter once the answer is already yes. A
 * panel that opened on the return window would be answering a question nobody
 * had got to yet.
 */
const CARDS = [
  ['reviews', 'People consistently say these run large.'],
  ['fit', "Based on what you usually keep, I'd try 32 instead of 34."],
  ['price', '$375 here. I found a similar pair for less.'],
  ['your closet', 'You already own two similar wide-leg blue jeans.'],
  ['returns', '14-day return window.'],
  ['delivery', 'Arrives before Saturday.'],
]

/*
 * Where the cards have finished and the verdict is allowed to speak.
 *
 * It waits for all six on purpose. A recommendation that lands before its own
 * reasoning is an opinion; one that lands after it is a conclusion, and the
 * only thing separating those two on screen is which order they arrive in.
 */
const CARDS_END = 0.72

export default function HowSection() {
  const railRef = useRef(null)
  const stageRef = useRef(null)

  /* How many cards are down, and whether the verdict is up. Both change a
     handful of times across the whole scroll rather than every frame. */
  const [shown, setShown] = useState(0)
  const [verdict, setVerdict] = useState(false)

  useEffect(() => {
    const rail = railRef.current
    const stage = stageRef.current
    if (!rail || !stage) return undefined

    let queued = false
    let lastShown = -1
    let lastVerdict = null

    const measure = () => {
      queued = false
      const r = rail.getBoundingClientRect()
      const travel = r.height - window.innerHeight
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel))
      stage.style.setProperty('--p', p.toFixed(4))

      /*
       * A short lead-in before the first card, so the listing is on screen by
       * itself for a moment. Arriving with a card already in the panel, the
       * panel reads as part of the shop rather than as something that turned up
       * on top of it.
       */
      const filling = Math.min(1, Math.max(0, (p - 0.06) / (CARDS_END - 0.06)))
      const n = Math.min(CARDS.length, Math.floor(filling * (CARDS.length + 0.001)))
      if (n !== lastShown) {
        lastShown = n
        setShown(n)
      }

      const v = p >= CARDS_END
      if (v !== lastVerdict) {
        lastVerdict = v
        setVerdict(v)
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
    <section className="hw" id="how" aria-labelledby="hw-title">
      <div className="hw-rail" ref={railRef}>
        <div className="hw-stage" ref={stageRef} data-verdict={verdict || undefined}>
          <h2 className="hw-line" id="hw-title">
            <span data-on={!verdict || undefined}>so you ask yom instead.</span>
            <span data-on={verdict || undefined}>and yom actually answers.</span>
          </h2>

          <div className="hw-win">
            <div className="hw-tabs" aria-hidden="true">
              <span className="hw-tab">daicock print baggy-fit jeans #2000</span>
            </div>

            <div className="hw-page">
              {/* The shop, reduced to the two things that are actually being
                  decided about — the jeans and what they cost. Everything the
                  listing had to say has been said already; repeating the whole
                  page here would only be somewhere for the eye to get lost. */}
              <div className="hw-shop">
                <img className="hw-item" src="/pinkjeans.jpg" alt="" aria-hidden="true" />
                <div className="hw-meta" aria-hidden="true">
                  <p className="hw-name">Daicock Print Baggy-Fit Jeans #2000</p>
                  <p className="hw-price">$375 USD</p>
                  <p className="hw-size">Size 34 · Indigo</p>
                </div>
              </div>

              {/*
                * The panel, docked to the edge of the shop rather than floating
                * over the middle of it. That is where an extension lives, and
                * it is the one detail that makes this read as something running
                * on the page instead of a screenshot of a different product.
                */}
              <aside className="hw-panel" aria-hidden="true">
                <p className="hw-brand">yom</p>

                <ul className="hw-cards">
                  {CARDS.map(([label, line], i) => (
                    <li
                      className="hw-card"
                      key={label}
                      style={{ '--i': i }}
                      data-on={i < shown || undefined}
                    >
                      <span className="hw-card-label">{label}</span>
                      <span className="hw-card-line">{line}</span>
                    </li>
                  ))}
                </ul>

                {/*
                  * The whole point of the six above it.
                  *
                  * "Skip" and not "buy", because a shopping assistant that only
                  * ever says yes is an ad. The one thing that would make anyone
                  * trust this is watching it talk someone out of a sale, and it
                  * costs nothing here to let it.
                  */}
                <div className="hw-verdict">
                  <p className="hw-says">
                    yom says: <b>skip.</b>
                  </p>
                  <p className="hw-why">
                    You own two pairs like these, and the size you keep is a 32 — not
                    the 34 in your bag.
                  </p>
                </div>
              </aside>
            </div>
          </div>

          {/* The whole thing in words, for anything that cannot watch it. */}
          <p className="hw-sr">
            yom sits beside the listing and answers it: the reviews say they run large,
            your fit is a 32 rather than the 34 selected, the same pair is cheaper
            elsewhere, you already own two like them, returns close after fourteen days
            and delivery beats Saturday. Its recommendation is to skip this one.
          </p>
        </div>
      </div>
    </section>
  )
}
