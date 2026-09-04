import { useEffect, useRef, useState } from 'react'
import Doll from './Doll.jsx'
import './AboutSection.css'

/*
 * Why yom exists, told as the thing everyone has actually done.
 *
 * Four beats, and a line of type over each of them:
 *
 *   you find something you like.      one tab, one pair of jeans, quiet
 *   then come the questions.          the tabs, and the thinking around them
 *   somehow, shopping became work.    said at the worst of it, not before
 *   or you could just ask yom.        everything shuts and she is there
 *
 * The order is the whole repair. The thesis used to open the section, over a
 * shop page nobody had been given a reason to care about — so there was no want
 * to interrupt and the nineteen interruptions had nothing to interrupt. Said
 * last, at peak clutter, it is a conclusion the screen has already made and the
 * words only have to agree with.
 *
 * The turn is the point. A section that only piles up says shopping is hard; it
 * is the collapse that says why we built something.
 */

/*
 * Twenty tabs, and every one of them has to stay readable.
 *
 * The version before this compressed them, and by the fifth the titles were
 * down to a letter and an ellipsis — so the frame that was meant to carry the
 * whole argument was the least informative one on the screen. You watched a
 * grey ribbon get finer and never saw a single place you had been.
 *
 * These are titles rather than questions because a search *is* the question.
 * "uk customs charges" is a worry with a URL attached, and reading twenty of
 * them in a row is the story the compression was hiding.
 */
const TABS = [
  'daicock print baggy-fit jeans #2000',
  'reddit: does evisu run small',
  'evisu size chart',
  'google: is the pink see through',
  'tiktok: evisu haul',
  'youtube: are evisu worth it',
  'depop: evisu daicock',
  'evisu return policy',
  'vinted: evisu 34',
  'r/streetwear: evisu?',
  'evisu shipping to uk',
  'uk customs charges',
  'tiktok: how to style baggy jeans',
  'grailed: daicock #2000',
  'trustpilot: evisu reviews',
  'unidays: evisu student code',
  'reddit: size 32 vs 34',
  'girls 🩷',
  'reddit: real vs fake evisu',
  'evisu sale ending?',
]

/*
 * The other half of the pile, and the half nobody sees in a screenshot.
 *
 * Tabs are only the residue — the actual weight of buying something is the
 * asking, and none of it is written down anywhere. These come up around the
 * window while the tabs are opening, one per couple of tabs, and they stay up:
 * a question you have not answered does not go away because you opened a tab
 * about it.
 *
 * Written the way anyone actually thinks, which mostly means the money one is
 * rude and none of them are sentences a brand would print. The moment this
 * reads as marketing it stops being the reader's own head and becomes ours.
 */
const THOUGHTS = [
  'do these run small?',
  'is $375 insane?',
  'will they actually look like that on me?',
  'can i return them?',
  'is there somewhere cheaper?',
  'do i already own something basically identical?',
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

/*
 * Where the beats sit in the scroll.
 *
 * The asking takes most of it, because the accumulation is the argument and it
 * has to feel long. The collapse is deliberately the shortest stretch on the
 * rail: the whole point of it is that it is sudden.
 *
 * FIND_END is the first repair — a stretch at the start where nothing happens
 * except that you want the jeans, reach for the button, and get stopped.
 *
 * REACH is where inside that stretch the cursor has finished travelling. It
 * stops short of the button rather than on it: the pause has to arrive while
 * the click is still coming, because a pause that lands after it is not an
 * interruption, it is a receipt. PILE_END runs past ASK_END on purpose, so the
 * last few tabs are still landing under "somehow, shopping became work" and the
 * line arrives as a conclusion rather than a caption.
 */
const FIND_END = 0.28
const ASK_END = 0.6
const PILE_END = 0.7
const WORK_END = 0.8

/* How far through the opening the cursor is done moving, and where the pause
   cuts in. */
const REACH = 0.74
const CUT = 0.62

/*
 * What it cost, and it does not tick.
 *
 * A number counting smoothly upward is a stopwatch, and a stopwatch is a thing
 * you are watching on purpose. This is the other kind of time — you look up and
 * it is gone. So it sits still and then jumps, four times, and the last jump is
 * the one that hurts: three quarters of an hour to over two hours between one
 * tab and the next.
 */
const LADDER = [
  [5, '4 min'],
  [10, '17 min'],
  [15, '46 min'],
  [Infinity, '2 hr 14 min'],
]

function clock(n) {
  return LADDER.find(([upto]) => n < upto)[1]
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
  const [beat, setBeat] = useState('find')
  /* Whether the pause has cut in. Its own flag rather than a slice of the
     progress value, because it is a thing that happens rather than a position. */
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const rail = railRef.current
    const stage = stageRef.current
    if (!rail || !stage) return undefined

    let queued = false
    let lastOpen = -1
    let lastBeat = ''
    let lastClock = ''
    let lastHeld = null

    const measure = () => {
      queued = false
      const r = rail.getBoundingClientRect()
      const travel = r.height - window.innerHeight
      const p = travel <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / travel))
      stage.style.setProperty('--p', p.toFixed(4))

      /*
       * The opening beat's own progress, 0 to 1, which is what the cursor is
       * driven by. Written as a custom property rather than through state: it
       * changes every frame of the scroll and the stylesheet is the only thing
       * that reads it.
       */
      const q = Math.min(1, Math.max(0, p / FIND_END))
      stage.style.setProperty('--q', Math.min(1, q / REACH).toFixed(4))

      const h = q >= CUT
      if (h !== lastHeld) {
        lastHeld = h
        setHeld(h)
      }

      /*
       * The pile is cut into one slot per tab. Where we are inside a slot is
       * what drives the question: it comes up at the start of the slot and the
       * tab it causes opens at the end of it.
       */
      /* The pile only starts once the finding is done, so nothing opens over
         the top of the first beat. */
      const filling = Math.min(1, Math.max(0, (p - FIND_END) / (PILE_END - FIND_END)))
      const n = Math.min(TABS.length, Math.max(1, 1 + Math.floor(filling * TABS.length)))
      if (n !== lastOpen) {
        lastOpen = n
        setOpen(n)
      }

      const b =
        p < FIND_END ? 'find' : p < ASK_END ? 'ask' : p < WORK_END ? 'work' : 'yom'
      if (b !== lastBeat) {
        lastBeat = b
        setBeat(b)
      }

      if (clockRef.current) {
        /* Climbs with the tabs, then stops dead. The clock stopping is the first
           sign anything has changed, before a single tab has closed. */
        const t = b === 'yom' ? 'about a minute' : clock(n)
        if (t !== lastClock) {
          lastClock = t
          clockRef.current.textContent = t
        }
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
  /* Holds at twenty while they are closing and drops on the turn, so the
     number falls at the same moment everything else does. */
  const count = beat === 'yom' ? 1 : open

  return (
    <section className="aw" id="about" aria-labelledby="aw-title">
      {/* Tall, and only to be scrolled through — the stage inside it sticks. */}
      <div className="aw-rail" ref={railRef}>
        <div
          className="aw-stage"
          ref={stageRef}
          data-beat={beat}
          data-held={held || undefined}
        >
          <div className="aw-head">
            {/*
              * Four lines, one at a time, in the same place. Stacked in a grid
              * rather than swapped, so the headline never changes height and
              * shoves the window under it around between beats.
              */}
            <h2 className="aw-line" id="aw-title">
              <span data-on={beat === 'find' || undefined}>
                you find something you like.
              </span>
              <span data-on={beat === 'ask' || undefined}>then come the questions.</span>
              <span data-on={beat === 'work' || undefined}>
                somehow, shopping became work.
              </span>
              <span data-on={beat === 'yom' || undefined}>
                or you could just ask yom.
              </span>
            </h2>

            {/*
              * The count, out loud.
              *
              * It was the width of the tabs carrying the whole load, and a tab
              * getting narrower is something you have to notice. A number
              * climbing is not: it says twenty before anyone has looked at the
              * strip, and it makes the drop back to one at the turn the loudest
              * thing on the screen.
              */}
            <p className="aw-tally" aria-hidden="true">
              <span className="aw-tally-n">{count}</span>
              <span className="aw-tally-w">{count === 1 ? 'tab' : 'tabs'}</span>
            </p>
          </div>

          <div className="aw-win">
            {/*
              * The strip stays mounted through the collapse rather than being
              * swapped out. Unmounted, twenty tabs would simply vanish between
              * one frame and the next; kept, they can be shut.
              */}
            <ul className="aw-strip" aria-hidden="true">
              {shown.map((title) => (
                <li className="aw-tab" key={title}>
                  <span className="aw-tab-name">{title}</span>
                </li>
              ))}
            </ul>

            <div className="aw-yomtab" aria-hidden="true">
              <span className="aw-tab-name">yom</span>
            </div>


          <ul className="aw-thoughts" aria-hidden="true">
              {THOUGHTS.map((t, i) => (
                <li
                  key={t}
                  className="aw-thought"
                  style={{ '--i': i }}
                  data-on={open > 2 + i * 3 || undefined}
                >
                  {t}
                </li>
              ))}
            </ul>

            {/*
              * The cursor, at four or five times life size.
              *
              * At its real size it would be a detail nobody would find on a
              * screen this busy. This large it is a character — the second one
              * on the page — and what it is doing is legible from across a
              * room, which is the whole test this section keeps failing.
              *
              * Driven off --q, the opening beat's progress, so it is scrubbed
              * by the scroll rather than played at one.
              */}
            <span className="aw-cursor" aria-hidden="true">
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
                {/*
                  * The opening, in the space the listing is about to fill.
                  *
                  * Not the whole page — a page is somewhere you read, and this
                  * beat is about something you do. The jeans and one button is
                  * the entire transaction as anyone actually experiences it:
                  * you want it, you reach, you click. Everything the rest of
                  * this section is about is what happens in the half second
                  * before that click, and it cannot be about it until the click
                  * has been set up as the obvious thing to do.
                  *
                  * It sits in the same grid cell as the listing, so when the
                  * page does arrive it arrives around the jeans rather than
                  * moving them.
                  */}
                <div className="aw-buy" aria-hidden="true">
                  <span className="aw-buy-btn">add to cart</span>

                  {/*
                    * And then it does not happen.
                    *
                    * A pause, not a stop and not a warning — nothing has gone
                    * wrong and nobody is being told off. It is the smallest
                    * possible version of the thing yom does: it puts a hand up
                    * for a second between wanting something and buying it, and
                    * everything below is what it does with that second.
                    */}
                  <span className="aw-pause">
                    <i />
                    <i />
                  </span>
                </div>

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

              </div>
            </div>
          </div>

          {/*
            * Her, arriving as everything else leaves.
            *
            * The tabs do not simply fade — they shrink toward this spot, so the
            * clutter reads as going somewhere rather than being tidied away.
            * That is the actual claim: the research still happens, it just
            * stops happening to you.
            *
            * A second WebGL context on the page, and worth it. The first screen
            * holds the other one, and browsers give out about sixteen.
            */}
          <div className="aw-doll" aria-hidden="true">
            <Doll expression="happy" />
          </div>

          {/*
            * The thinking, crowding the window from outside it.
            *
            * They come up one per two or three tabs and none of them leave,
            * because a question you have not answered does not go away
            * because you opened a tab about it. Positioned from an index
            * handed to the stylesheet, so the order here is the order they
            * arrive in and nothing about where they sit lives in this file.
            */}

          <p className="aw-clock">
            <span className="aw-clock-label">your time</span>
            <span className="aw-clock-value" ref={clockRef}>
              0 min
            </span>
          </p>

          {/* The whole thing in words, for anything that cannot watch it. */}
          <p className="aw-sr">
            You find a pair of jeans you like. Then come the questions — do they run
            small, is the price mad, can you return them, is it cheaper somewhere else
            — and twenty tabs and over two hours later you still have not decided.
            Or you could just ask yom.
          </p>
        </div>
      </div>
    </section>
  )
}
