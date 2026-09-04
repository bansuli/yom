import { useEffect, useRef, useState } from 'react'
import './WorkSection.css'

/*
 * How one pair of jeans turns into an afternoon.
 *
 * Told as one continuous shot rather than as a list of complaints. A cart
 * rolls in, the jeans spin in, something clicks add to cart — and then the cart
 * keeps going, right through everything you actually have to do before you are
 * allowed to buy anything. The checkout is visible the whole way and never
 * gets any closer until the very end.
 *
 * Two sentences carry it, and the second one is the whole argument:
 *
 *   shopping became work.
 *   buying one thing became researching everything.
 *
 * Nothing here explains itself in copy. The cart passing five signs is the
 * explanation, and a paragraph underneath saying "shopping involves a lot of
 * research" would only be the page apologising for not trusting the picture.
 */

/*
 * The first line, revealed by scrolling rather than on a timer.
 *
 * It is the one thing here that answers to the wheel directly — a couple of
 * degrees of scroll and the words start coming, which is what makes the
 * section feel like it is being pulled rather than played at you.
 */
const L1 = 'shopping became work.'

/*
 * What the cart goes through. Not features of a problem — the actual five
 * places anyone ends up before buying a pair of jeans, in the order they end
 * up in them.
 */
const STOPS = ['reviews', 'size charts', 'tiktok videos', 'reddit threads', 'the groupchat']

/*
 * Where each beat sits on the rail.
 *
 * The travel is deliberately the longest stretch by a distance. It is the part
 * that has to feel like it is taking too long, and a section that says buying
 * one thing became researching everything cannot get through the researching
 * in two turns of the wheel.
 */
const TITLE_END = 0.09
const ARRIVE_END = 0.2
const CLICK_END = 0.28
const THROW_END = 0.36
const TRAVEL_END = 0.94

export default function WorkSection() {
  const railRef = useRef(null)
  const stageRef = useRef(null)
  const floorRef = useRef(null)
  const rigRef = useRef(null)
  const tillRef = useRef(null)

  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState('title')
  const [passed, setPassed] = useState(0)

  useEffect(() => {
    const rail = railRef.current
    const stage = stageRef.current
    if (!rail || !stage) return undefined

    let queued = false
    let lastTyped = -1
    let lastPhase = ''
    let lastPassed = -1

    const measure = () => {
      queued = false
      const r = rail.getBoundingClientRect()
      const travel = r.height - window.innerHeight
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel))

      /* One letter per slice of the opening beat. */
      const n = Math.min(L1.length, Math.floor((p / TITLE_END) * L1.length))
      if (n !== lastTyped) {
        lastTyped = n
        setTyped(n)
      }

      const ph =
        p < TITLE_END
          ? 'title'
          : p < ARRIVE_END
            ? 'arrive'
            : p < CLICK_END
              ? 'click'
              : p < THROW_END
                ? 'thrown'
                : p < TRAVEL_END
                  ? 'research'
                  : 'checkout'
      if (ph !== lastPhase) {
        lastPhase = ph
        setPhase(ph)
      }

      /*
       * How far along the aisle the cart is, 0 to 1, and then how far that
       * actually is in pixels.
       *
       * Measured rather than written as a length. The distance was a vw figure
       * while the checkout sits at a percentage of the floor, and the two
       * cannot be reconciled — the cart came to rest on top of the button at
       * some widths and stopped half a screen short at others. Read off the two
       * elements, it stops the same distance short of the till everywhere.
       *
       * Both ends are written out: the aisle's, and the shorter push it makes
       * once it has seen the till. Neither is allowed past the button.
       */
      const c = Math.min(1, Math.max(0, (p - THROW_END) / (TRAVEL_END - THROW_END)))
      stage.style.setProperty('--c', c.toFixed(4))

      const floor = floorRef.current
      const rig = rigRef.current
      const till = tillRef.current
      if (floor && rig && till) {
        /* A gap the width of the cart, so it reads as approaching rather than
           as having parked. */
        const gap = rig.offsetWidth * 0.55
        const room = Math.max(0, till.offsetLeft - rig.offsetWidth - gap - rig.offsetLeft)
        stage.style.setProperty('--travel', `${(c * room).toFixed(1)}px`)
        stage.style.setProperty('--travel-on', `${(c * room + gap * 0.42).toFixed(1)}px`)
      }

      /* Which signs it has already gone by. They stay lit — you do not stop
         having read the reviews because you have moved on to the size chart. */
      const k = Math.min(STOPS.length, Math.floor(c * (STOPS.length + 0.6)))
      if (k !== lastPassed) {
        lastPassed = k
        setPassed(k)
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
        <div className="wk-stage" ref={stageRef} data-phase={phase}>
          {/* Both lines in one cell, so the picture underneath never shifts
              when the sentence changes. */}
          <h2 className="wk-line" id="wk-title">
            <span className="wk-l1" data-off={phase !== 'title' && phase !== 'arrive' && phase !== 'click' && phase !== 'thrown' ? '' : undefined}>
              {L1.split('').map((ch, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={i} data-on={i < typed || undefined}>
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
            </span>
            <span className="wk-l2">buying one thing became researching everything.</span>
          </h2>

          <div className="wk-floor" ref={floorRef}>
            {/*
              * The signs, laid along the aisle it has to get down. They are
              * behind the cart rather than in front of it — it goes past them,
              * not through a menu of them.
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

            {/* Visible from the moment the aisle starts and no nearer for any
                of it, which is the joke. */}
            <span className="wk-checkout" ref={tillRef} aria-hidden="true">
              checkout
            </span>

            {/*
              * The cart and the jeans travel as one thing once the jeans are in
              * it, so they share a rig and the rig is what moves down the
              * aisle. Kept apart they would have to be kept in step by hand,
              * and anything that has to be kept in step by hand comes apart.
              */}
            <div className="wk-rig" ref={rigRef} aria-hidden="true">
              <span className="wk-cart">
                <svg viewBox="0 0 68 48" fill="none">
                  <g
                    stroke="#111111"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 4h7l3 6" />
                    <path d="M12 10h54l-8 20H20z" />
                    <path d="M20 30l3 7h33" />
                    <circle cx="27" cy="42" r="3.2" />
                    <circle cx="52" cy="42" r="3.2" />
                  </g>
                </svg>
              </span>

              {/*
                * Off to the right and spinning at first, then standing still,
                * then in the basket. One element and one transform the whole
                * way through, so it is the same pair of jeans throughout rather
                * than three pictures of some.
                */}
              <img className="wk-jeans" src="/pinkjeans.jpg" alt="" />
            </div>

            {/* Between the two of them, and nothing more than the words. */}
            <span className="wk-buy" aria-hidden="true">
              add to cart
            </span>

            {/* Four or five times life size, so what it is doing is legible
                from across a room. */}
            <span className="wk-cursor" aria-hidden="true">
              <svg viewBox="0 0 24 32" fill="none">
                <path
                  d="M2 2 L2 26 L8.4 20.2 L12.4 29.4 L16.6 27.6 L12.7 18.6 L21 18.2 Z"
                  fill="#ffffff"
                  stroke="#111111"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          {/* The whole thing in words, for anything that cannot watch it. */}
          <p className="wk-sr">
            Shopping became work. You add one pair of jeans to a cart, and then buying
            that one thing turns into researching everything — reviews, size charts,
            TikTok videos, Reddit threads and the group chat — before you ever reach the
            checkout.
          </p>
        </div>
      </div>
    </section>
  )
}
