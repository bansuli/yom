import { useEffect, useRef, useState } from 'react'
import './AboutSection.css'

/*
 * Why yom exists, told as the thing everyone has actually done.
 *
 * One pair of jeans, and then the tabs. They open one at a time as you scroll
 * and every new one squeezes the rest narrower — which is the whole argument,
 * made without a word of it: nobody needs told that twenty tabs is too many
 * once they watch the titles disappear. A clock beside them counts what it
 * cost. Then they all shut at once and one is left.
 *
 * The turn is the point. A section that only piles up says shopping is hard; it
 * is the collapse that says why we built something.
 */

/*
 * Twenty, as lived. Ordinary and specific — "reddit: does evisu run small" is a
 * tab someone has actually had open, and "research" is not.
 */
const TABS = [
  'daicock print baggy-fit jeans #2000',
  'reddit: does evisu run small',
  'size chart',
  'is this see through?',
  'tiktok: evisu haul',
  'youtube: evisu review',
  'depop: evisu',
  'return policy',
  'vinted: evisu 34',
  'r/streetwear',
  'shipping to uk',
  'customs fees?',
  'tiktok: how to style',
  'grailed: daicock #2000',
  'reviews',
  'student discount code',
  'size 32 vs 34',
  'groupchat',
  'are these real?',
  'final sale??',
]

/*
 * The listing as it actually is. Ban's call, made with the copyright position
 * on the photograph spelled out — it is their page and their risk to take.
 *
 * The wordmark is set in type rather than traced or embedded: it reads as the
 * brand at this size without a copy of their artwork living in the repository.
 */
const SIZES = ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40']
const PICKED = '34'
const NAV = ["what's new", 'men', 'women', 'denim', 'signature', 'sale']
const TAGS = ['best seller', 'signature', 'jeans/ regular', 'daicock']

/* What yom already has, so none of the above has to happen. Ban's three. */
const KNOWS = ['your size', 'what you have bought before', 'your taste']

/*
 * Where the three beats sit in the scroll. The pile takes most of it, because
 * the accumulation is the argument and it needs to feel long; the collapse is
 * deliberately short, because the whole point of it is that it is sudden.
 */
const PILE_END = 0.58
const SHUT_END = 0.68

/* What the pile costs, in minutes, by the end of it. */
const COST = 252

function clock(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} hr ${String(m).padStart(2, '0')} min` : `${m} min`
}

export default function AboutSection() {
  const railRef = useRef(null)
  const stageRef = useRef(null)
  const clockRef = useRef(null)

  /*
   * Only two things go through React, and both change a couple of dozen times
   * across the whole scroll rather than every frame: how many tabs are open,
   * and which beat we are in. The clock is written straight to the node and the
   * rest is a custom property the stylesheet reads — putting any of it in state
   * would re-render twenty elements on every frame of every scroll.
   */
  const [open, setOpen] = useState(1)
  const [beat, setBeat] = useState('pile')

  useEffect(() => {
    const rail = railRef.current
    const stage = stageRef.current
    if (!rail || !stage) return undefined

    let queued = false
    let lastOpen = -1
    let lastBeat = ''

    const measure = () => {
      queued = false
      const r = rail.getBoundingClientRect()
      const travel = r.height - window.innerHeight
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel))
      stage.style.setProperty('--p', p.toFixed(4))

      const filling = Math.min(1, p / PILE_END)
      const n = Math.max(1, Math.round(filling * TABS.length))
      if (n !== lastOpen) {
        lastOpen = n
        setOpen(n)
      }

      const b = p < PILE_END ? 'pile' : p < SHUT_END ? 'shut' : 'yom'
      if (b !== lastBeat) {
        lastBeat = b
        setBeat(b)
      }

      if (clockRef.current) {
        /* Runs up through the pile, then stops dead — the clock stopping is the
           first sign anything has changed, before the tabs even close. */
        clockRef.current.textContent =
          b === 'yom' ? '0 min' : clock(Math.round(Math.min(1, filling) * COST))
      }
    }

    /* Coalesced to a frame. Scroll fires far more often than the screen
       updates, and the value is only ever read at paint. */
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

  const shown = TABS.slice(0, open)

  return (
    <section className="aw" id="about" aria-labelledby="aw-title">
      {/* Tall, and only to be scrolled through — the stage inside it sticks. */}
      <div className="aw-rail" ref={railRef}>
        <div className="aw-stage" ref={stageRef} data-beat={beat}>
          <h2 className="aw-line" id="aw-title">
            <span className="aw-said">somehow, shopping became work.</span>
            <span className="aw-turn">so we built yom.</span>
          </h2>

          <div className="aw-win">
            {/*
              * The strip stays mounted through the collapse rather than being
              * swapped out. Unmounted, twenty tabs would simply vanish between
              * one frame and the next; kept, they can be shut.
              */}
            <ul className="aw-strip" aria-hidden="true">
              {shown.map((t) => (
                <li className="aw-tab" key={t}>
                  <span className="aw-tab-name">{t}</span>
                </li>
              ))}
            </ul>

            <div className="aw-yomtab" aria-hidden="true">
              <span className="aw-tab-name">yom</span>
            </div>

            <div className="aw-page">
              {/* The chrome across the top of the shop, which is most of what
                  makes a page recognisable as somewhere you have been. */}
              <div className="pdp-top" aria-hidden="true">
                <div className="pdp-bar">
                  <span className="pdp-logo">EVISU</span>
                  <nav className="pdp-nav">
                    {NAV.map((n) => (
                      <span key={n} className={n === 'sale' ? 'is-sale' : undefined}>
                        {n}
                      </span>
                    ))}
                  </nav>
                  <span className="pdp-icons">
                    <i /> <i /> <i /> <i />
                  </span>
                </div>
              </div>

              {/* One photograph, in both beats. The shop's details fall away
                  and yom's take their place beside it — same jeans, different
                  experience, which is easier to feel when the jeans do not
                  move. */}
              <div className="aw-shot">
                <div className="aw-thumbs" aria-hidden="true">
                  <span className="is-on" />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="aw-hero">
                  <img className="aw-item" src="/pinkjeans.jpg" alt="" aria-hidden="true" />
                  <span className="aw-count" aria-hidden="true">1/9</span>
                </div>
              </div>

              <div className="aw-side">
                <div className="pdp" aria-hidden="true">
                  <p className="pdp-crumb">
                    <span>home</span> › <span>all products</span> › daicock print baggy-fit
                    jeans #2000
                  </p>

                  <div className="pdp-panel">
                    <h3 className="pdp-name">Daicock Print Baggy-Fit Jeans #2000</h3>
                    <p className="pdp-price">$375 USD</p>
                    <p className="pdp-pay">
                      4 interest-free installments, or from $33.85/mo with <b>shop</b>
                    </p>

                    <p className="pdp-label">Color: INDIGO</p>
                    <span className="pdp-swatch" />

                    <p className="pdp-label pdp-sizerow">
                      Size: {PICKED}
                      <span className="pdp-guide">View Size Guide</span>
                    </p>
                    <ul className="pdp-sizes">
                      {SIZES.map((z) => (
                        <li key={z} className={z === PICKED ? 'is-on' : undefined}>
                          {z}
                        </li>
                      ))}
                    </ul>
                    <p className="pdp-model">- Model is 180cm tall and wears size 32</p>

                    <p className="pdp-cart">add to cart</p>

                    <p className="pdp-style">STYLE: 2EAECM2JE99500CT</p>
                    <p className="pdp-tags">
                      {TAGS.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </p>
                  </div>
                </div>

                <ul className="aw-knows">
                  {KNOWS.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="aw-clock">
            <span className="aw-clock-label">your time</span>
            <span className="aw-clock-value" ref={clockRef}>
              0 min
            </span>
          </p>

          {/* The whole thing in words, for anything that cannot watch it. */}
          <p className="aw-sr">
            One pair of jeans took twenty tabs and over four hours. yom does the
            research instead — it already knows your size, what you have bought before,
            and your taste.
          </p>
        </div>
      </div>
    </section>
  )
}
