import { useEffect, useRef, useState } from 'react'
import './TokenField.css'

/*
 * The field of shop talk drifting behind the page.
 *
 * A monospace grid, rebuilt a few times a second, where a slow-moving field
 * decides what sits in each cell — nothing at the thin edges, a size or a price
 * where it thickens, a whole phrase where it is densest. The result is a cloud
 * of the language of buying something, shifting slowly enough that you notice
 * it has changed rather than watching it change.
 *
 * A <pre> of one long string rather than an element per token. The whole grid
 * is one text node replaced each tick, which is a single DOM write; several
 * hundred spans being created and destroyed five times a second would be an
 * enormous amount of work to do behind something nobody is looking at.
 *
 * It is decoration and nothing else, so it is hidden from assistive technology
 * entirely — a screen reader ploughing through six thousand characters of
 * SKU numbers is the opposite of helpful.
 */

/*
 * Sorted by weight rather than meaning. The field's value picks how far down
 * this list to reach, so the thin parts of the cloud get short tokens and the
 * dense middle gets the long ones — which is what gives the drift its shape.
 */
const TOKENS = [
  ['XS', 'S', 'M', 'L', 'XL', '2XL', '$20', '$49', '$75', '-20%'],
  ['$120', '$200', '$340', '-$50', 'SALE', 'IN STOCK', 'SIZE 8', 'SIZE 27'],
  ['SOLD OUT', 'LOW STOCK', 'DISCOUNT', 'RUNS SMALL', 'SHIPS FREE', 'TRUE TO FIT'],
  ['ADD TO CART', 'FREE RETURNS', 'SKU 839289', 'SKU 44012', '100% COTTON', 'FINAL SALE'],
]

/* How often the grid is rebuilt, and how far the field moves each time. */
const TICK = 190
const DRIFT = 0.055

/*
 * Three sine pairs crossed against each other — enough to look organic without
 * a noise library, and the same trick the pet's shell uses. Returns 0..1.
 */
function field(x, y, t) {
  /*
   * The x frequencies have to be high enough to fit several waves across the
   * grid. Low ones gave barely a wave and a half over sixty columns, so the
   * crests came out as tall vertical bands stuck to one edge rather than as
   * clusters scattered through the page.
   *
   * The third term is diagonal, and deliberately not a whole multiple of the
   * other two — three waves that share an axis line up into stripes.
   */
  const n =
    Math.sin(x * 0.31 + t) * Math.cos(y * 0.19 - t * 0.7) +
    Math.sin(y * 0.27 - t * 0.5) * Math.cos(x * 0.23 + t * 0.9) +
    Math.sin((x * 0.7 + y * 1.3) * 0.13 + t * 0.3)
  return (n / 3 + 1) / 2
}

export default function TokenField({ className = '' }) {
  const hostRef = useRef(null)
  const [grid, setGrid] = useState('')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let cols = 0
    let rows = 0
    let t = 0

    /*
     * Measured from the rendered font rather than assumed. Monospace advance
     * widths differ between faces, and a guess leaves the grid either short of
     * the edge or overflowing it — and an overflowing <pre> would give the page
     * a sideways scrollbar.
     */
    function measure() {
      const probe = document.createElement('span')
      probe.textContent = '0'.repeat(50)
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
      host.appendChild(probe)
      const cw = probe.getBoundingClientRect().width / 50
      host.removeChild(probe)

      const lh = parseFloat(getComputedStyle(host).lineHeight) || 18
      cols = Math.max(8, Math.floor(host.clientWidth / cw))
      rows = Math.max(4, Math.floor(host.clientHeight / lh))
    }

    function build() {
      const lines = []
      for (let r = 0; r < rows; r++) {
        let line = ''
        let c = 0
        while (c < cols) {
          const v = field(c, r, t)

          /*
           * Almost everything is empty. This threshold is the single number
           * that decides whether the page has a field of text drifting behind
           * it or a wall of it — at half, nearly every cell fills and the tokens
           * run together into paragraphs; up here only the crests of the field
           * come through and the gaps do the drawing.
           */
          if (v < 0.68) {
            line += ' '
            c += 1
            continue
          }

          const band = TOKENS[Math.min(TOKENS.length - 1, Math.floor((v - 0.68) / 0.08))]
          /*
           * Hashed on the cell and on time, so neighbouring cells do not walk
           * the list in step — indexing by position alone printed the same two
           * tokens across a whole row — and so a cell that stays lit long
           * enough eventually says something else.
           */
          const h = (r * 2654435761 + c * 40503 + Math.floor(t * 4)) >>> 0
          const token = band[h % band.length]

          if (c + token.length > cols) break
          line += token
          c += token.length

          // A gap, so two tokens never run together into one unreadable word.
          if (c < cols) {
            line += ' '
            c += 1
          }
        }
        lines.push(line)
      }
      setGrid(lines.join('\n'))
    }

    measure()
    build()

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const id = setInterval(() => {
      t += DRIFT
      build()
    }, TICK)

    const ro = new ResizeObserver(() => {
      measure()
      build()
    })
    ro.observe(host)

    return () => {
      clearInterval(id)
      ro.disconnect()
    }
  }, [])

  return (
    <pre className={`tf ${className}`.trim()} ref={hostRef} aria-hidden="true">
      {grid}
    </pre>
  )
}
