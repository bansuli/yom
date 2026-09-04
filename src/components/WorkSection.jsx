import { useEffect, useRef, useState } from 'react'
import './WorkSection.css'

/*
 * How one pair of jeans turns into an afternoon.
 *
 * Told as one continuous shot, and wordless until it has earned a sentence. A
 * cart rolls in, the jeans spin in, something clicks add to cart — and then the
 * cart keeps going, right through everything you actually have to do before you
 * are allowed to buy anything. The checkout is in view the whole way and never
 * gets any closer until the very end.
 *
 * One line carries it, and it arrives late on purpose:
 *
 *   buying one thing became researching everything.
 *
 * There was a first line over the opening too. It is gone: the cart, the jeans
 * and the button say what it said, and a caption over a picture that is already
 * legible is the page not trusting the picture.
 *
 * Almost everything here is scrubbed rather than played. The entrance, the
 * cursor's approach and the run down the aisle are all positions written from
 * the scroll offset, so the shot moves exactly as fast as the wheel does and
 * takes as long as the rail is tall. Only the two things that are genuinely
 * events — the click and the throw — are transitions, because a throw does not
 * happen at whatever speed you happen to be scrolling.
 */

/*
 * What the cart goes through. Not features of a problem — the actual five
 * places anyone ends up before buying a pair of jeans, in the order they end up
 * in them.
 */
const STOPS = ['reviews', 'size charts', 'tiktok videos', 'reddit threads', 'the groupchat']

/*
 * Where each beat sits on the rail.
 *
/*
 * Where each beat sits, and there are two clocks rather than one.
 *
 * The entrance runs off the section *rising into view* — how far its top edge
 * has come up the screen — not off the sticky rail. That distinction is the
 * whole fix: the rail's own progress cannot begin until the section's top
 * reaches the top of the window, which is a full screen of scrolling after the
 * hero, so no threshold small enough existed. Nothing could happen "after a
 * tiny scroll" because nothing was on screen to happen to.
 *
 * On the rise clock, the cart and the jeans are already coming in while the
 * line above them is still leaving, and they have finished arriving at the
 * exact moment the stage locks to the top.
 *
 * Everything after that is on the rail, where the numbers below are fractions
 * of the sticky run. The click and the throw are quick; the aisle has the
 * remaining four fifths, because the aisle is the part that has to drag.
 */
const REACH_END = 0.08
const THROW_END = 0.14
const TRAVEL_END = 0.95

/*
 * Where things stand, as fractions of the floor's width.
 *
 * Handed to the stylesheet as custom properties rather than written out again
 * in it. The component measures against these numbers every frame; a second
 * copy in the CSS would only be a copy that drifts, and the first thing to
 * break when it did would be the cart quietly parking on top of the checkout.
 *
 * The button is not in the list on purpose: it is measured, not placed. It has
 * to sit midway between the cart's right edge and the jeans' left one, and the
 * cart's width is a clamp — so any fraction written here would be centred at
 * one size and off at every other.
 */
const CART_AT = 0.06
const JEANS_AT = 0.75
const TILL_AT = 0.88

function span(p, a, b) {
  return Math.min(1, Math.max(0, (p - a) / (b - a)))
}

export default function WorkSection() {
  const railRef = useRef(null)
  const stageRef = useRef(null)
  const floorRef = useRef(null)
  const rigRef = useRef(null)

  /* The only two things that go through React are the two that are events
     rather than positions. Everything else is a custom property. */
  const [phase, setPhase] = useState('idle')
  const [passed, setPassed] = useState(0)

  useEffect(() => {
    const rail = railRef.current
    const stage = stageRef.current
    if (!rail || !stage) return undefined

    let queued = false
    let lastPhase = ''
    let lastPassed = -1

    const measure = () => {
      queued = false
      const r = rail.getBoundingClientRect()
      const vh = window.innerHeight

      /* How far the section has climbed the window: 0 as its top edge touches
         the bottom, 1 as it reaches the top and the stage locks. */
      const rise = Math.min(1, Math.max(0, (vh - r.top) / vh))
      /* And how far through the sticky run it is, which only starts once the
         rise has finished. */
      const run = r.height - vh
      const p = run <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / run))

      const arriving = r.top > 0
      const ph = arriving
        ? 'enter'
        : p < REACH_END
          ? 'reach'
          : p < THROW_END
            ? 'thrown'
            : p < TRAVEL_END
              ? 'research'
              : 'checkout'
      if (ph !== lastPhase) {
        lastPhase = ph
        setPhase(ph)
      }

      const floor = floorRef.current
      const rig = rigRef.current
      if (!floor || !rig) return

      /*
       * Every position is measured off the floor rather than written as a vw
       * figure. The two cannot be reconciled — the floor is the stage minus its
       * gutters — and mixing them is why the cart used to park on top of the
       * checkout at one width and stop half a screen short at another.
       */
      const W = floor.clientWidth
      const rigX = rig.offsetLeft
      const cartW = rig.offsetWidth

      /* Dead centre of the space between the two of them, and the cursor goes
         wherever it goes. */
      stage.style.setProperty('--buy-x', `${((rigX + cartW + W * JEANS_AT) / 2).toFixed(1)}px`)

      /* ── In from the sides ── */
      const a = arriving ? rise : 1
      /* Eased here rather than in CSS: a transition cannot be scrubbed, and a
         linear entrance reads as a slide rather than as something arriving. */
      const ea = 1 - Math.pow(1 - a, 3)
      stage.style.setProperty('--cart-x', `${((ea - 1) * (rigX + cartW * 1.6)).toFixed(1)}px`)
      stage.style.setProperty(
        '--jeans-x',
        `${(W * 1.25 + (W * JEANS_AT - W * 1.25) * ea - rigX).toFixed(1)}px`,
      )
      stage.style.setProperty('--jeans-turn', `${((1 - ea) * 214).toFixed(1)}deg`)

      /* ── The hand ── */
      const k = arriving ? 0 : span(p, 0, REACH_END)
      const ek = 1 - Math.pow(1 - k, 3)
      stage.style.setProperty('--cur-x', `${((1 - ek) * W * 0.22).toFixed(1)}px`)
      stage.style.setProperty('--cur-y', `${((1 - ek) * W * 0.14).toFixed(1)}px`)

      /* ── Down the aisle ── */
      const c = arriving ? 0 : span(p, THROW_END, TRAVEL_END)
      /* A gap over half the cart's width, so it reads as approaching the till
         rather than as having parked at it. */
      const gap = cartW * 0.55
      const room = Math.max(0, W * TILL_AT - cartW - gap - rigX)
      stage.style.setProperty('--travel', `${(c * room).toFixed(1)}px`)
      stage.style.setProperty('--travel-on', `${(c * room + gap * 0.42).toFixed(1)}px`)

      /* Which signs it has already gone by. They stay lit — you do not stop
         having read the reviews because you have moved on to the size chart. */
      const n = Math.min(STOPS.length, Math.floor(c * (STOPS.length + 0.6)))
      if (n !== lastPassed) {
        lastPassed = n
        setPassed(n)
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
        <div
          className="wk-stage"
          ref={stageRef}
          data-phase={phase}
          style={{
            '--cart-at': `${CART_AT * 100}%`,
            '--till-at': `${TILL_AT * 100}%`,
          }}
        >
          {/* Late, and the only words in the section. */}
          <h2 className="wk-line" id="wk-title">
            buying one thing became researching everything.
          </h2>

          <div className="wk-floor" ref={floorRef}>
            {/*
              * The signs, laid along the aisle it has to get down. It goes past
              * them rather than through a menu of them.
              */}
            <ul className="wk-stops" aria-hidden="true">
              {STOPS.map((s, i) => (
                <li
                  key={s}
                  className="wk-stop"
                  style={{ '--i': i }}
                  data-on={i < passed || undefined}
                >
                  {s}
                </li>
              ))}
            </ul>

            {/* Up from the moment the cart sets off and no nearer for any of
                it — the thing you were trying to do the whole time, in view the
                whole time. */}
            <span className="wk-till" aria-hidden="true">
              checkout
            </span>

            {/*
              * The cart and the jeans travel as one thing once the jeans are in
              * it, so they share a rig and the rig is what goes down the aisle.
              * Kept apart they would have to be held in step by hand, and
              * anything held in step by hand comes apart.
              */}
            <div className="wk-rig" ref={rigRef} aria-hidden="true">
              <span className="wk-cart">
                {/*
                  * Shorter, and thin.
                  *
                  * It was 72 wide by 46 tall, which is a trolley stretched into
                  * a diagram of one — long, low, and reading as a bench at a
                  * glance. Just over five to four is closer to what one actually
                  * looks like side on.
                  *
                  * The strokes are 1.5 rather than 2.4, so it carries the same
                  * weight as the hairlines under the signs and belongs to the
                  * same drawing instead of sitting on it as an icon.
                  */}
                <svg viewBox="0 0 56 46" fill="none">
                  <g
                    stroke="#111111"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 4h5.6l2.3 6.4" />
                    <path d="M9.9 10.4h44l-5.2 17.2H15.7z" />
                    <path d="M15.7 27.6l1.9 5.2h27" />
                    <circle cx="22" cy="38.6" r="2.9" />
                    <circle cx="41" cy="38.6" r="2.9" />
                  </g>
                </svg>
              </span>

              {/*
                * Off to the right and turned right over to start with, then
                * upright and still, then in the basket. One element and one
                * transform the whole way through — three pictures of some jeans
                * in three places would be three different pairs, and the point
                * of the shot is that it is the one pair the whole time.
                */}
              <img className="wk-jeans" src="/pinkjeans.jpg" alt="" />
            </div>

            {/* Between the two of them, in the bar's own voice. */}
            <span className="wk-buy" aria-hidden="true">
              Add to cart
            </span>

            {/* Big enough to be a character in the shot rather than a detail in
                it — what it is doing has to be legible from across a room. */}
            <span className="wk-cursor" aria-hidden="true">
              <svg viewBox="0 0 24 32" fill="none">
                <path
                  d="M2 2 L2 26 L8.4 20.2 L12.4 29.4 L16.6 27.6 L12.7 18.6 L21 18.2 Z"
                  fill="#111111"
                  stroke="#ffffff"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          {/* The whole thing in words, for anything that cannot watch it. */}
          <p className="wk-sr">
            You add one pair of jeans to a cart, and buying that one thing turns into
            researching everything — reviews, size charts, TikTok videos, Reddit threads
            and the group chat — before you ever reach the checkout.
          </p>
        </div>
      </div>
    </section>
  )
}
