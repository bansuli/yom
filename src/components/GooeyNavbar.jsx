import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './GooeyNavbar.css'

/*
 * PARKED, NOT DEAD. Nothing imports this today — the homepage is a blank
 * canvas — but it is kept whole and working so it can be put back in one
 * import. Do not delete it as unused code.
 * docs/NAVBARS.md has the edits that switch it back on.
 *
 * A row of separate pills that grow a waist to their neighbours when one is
 * hovered or marks the page being viewed. The shape is drawn, not blurred:
 * every pill is a rounded rectangle and every join is a fillet tangent to the
 * corner circles on either side of it. Deriving the join from a blur would tie
 * the softness of the waist to the blur radius and the blur radius to the gap,
 * so the join would coarsen into a welded bar as soon as the pills moved
 * apart. Drawn this way the waist, the corner radius and the gap stay three
 * independent numbers.
 */

const PAD_X = 14
const PAD_Y = 8
const GAP = 9
const PUSH = 8
const NECK_RATIO = 0.4
const RADIUS = 999
const HALO = 70

// Spring the joins open and shut on: stiffness 260, damping 30, mass 1.
const STIFFNESS = 260
const DAMPING = 30
const MASS = 1
const SETTLED = 0.001

function round(v) {
  return (Math.round(v * 100) / 100).toString()
}

/** A rounded rectangle drawn with arcs, so the corners stay true circles. */
function pillPath(rect, radius) {
  const r = Math.min(radius, rect.width / 2, rect.height / 2)
  const { x, y, width: w, height: h } = rect
  return [
    `M${round(x)} ${round(y + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + r)} ${round(y)}`,
    `L${round(x + w - r)} ${round(y)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + w)} ${round(y + r)}`,
    `L${round(x + w)} ${round(y + h - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + w - r)} ${round(y + h)}`,
    `L${round(x + r)} ${round(y + h)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x)} ${round(y + h - r)}`,
    'Z',
  ].join(' ')
}

/*
 * The waist joining two pills.
 *
 * The scoop on each side is a true fillet: a circle tangent to both pills'
 * corner circles, lowered until its underside just grazes the requested waist.
 * Because it meets each corner tangentially the pill's own rounding runs on
 * uninterrupted, and the join reads as growing out of the side of the pill
 * rather than being stretched between its corners.
 *
 * The fillet radius is not a free choice — solving for it is the whole trick.
 * A wider scoop and a thinner waist are the same statement about one circle,
 * so asking for a narrow waist automatically buys the long sweeping curve that
 * belongs with it.
 */
function waistPath(left, right, radius, neck, openness) {
  if (openness <= 0.02) return null
  const h = left.height
  const cy = left.y + h / 2
  const r = Math.min(radius, h / 2, left.width / 2, right.width / 2)
  if (r <= 0) return null

  const xa = left.x + left.width
  const xb = right.x
  const gap = xb - xa
  if (gap < 0) return null

  const waistHalf = Math.min((neck / 2) * openness, h / 2 - 0.5)

  // Distance from a corner circle's centre to the fillet's, measured across;
  // and where the waist sits relative to that corner centre.
  const across = gap / 2 + r
  const drop = waistHalf - h / 2 + r
  const denom = 2 * (drop - r)
  if (Math.abs(denom) < 1e-4) return null

  const fillet = (r * r - across * across - drop * drop) / denom
  if (!(fillet > 0) || r + fillet < across) return null

  const rise = Math.sqrt(Math.max(0, (r + fillet) * (r + fillet) - across * across))
  const midX = (xa + xb) / 2

  // Tangent point where the fillet meets the left pill's top corner.
  const cornerX = xa - r
  const cornerY = left.y + r
  const vx = midX - cornerX
  const vy = -rise
  const len = Math.hypot(vx, vy) || 1
  const tax = cornerX + (r * vx) / len
  const tay = cornerY + (r * vy) / len
  const tbx = 2 * midX - tax

  return [
    `M${round(tax)} ${round(tay)}`,
    `A${round(fillet)} ${round(fillet)} 0 0 0 ${round(tbx)} ${round(tay)}`,
    `L${round(tbx)} ${round(2 * cy - tay)}`,
    `A${round(fillet)} ${round(fillet)} 0 0 0 ${round(tax)} ${round(2 * cy - tay)}`,
    'Z',
  ].join(' ')
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * @param {object} props
 * @param {Array<{label: string, to?: string, onSelect?: () => void}>} props.items
 * @param {string} [props.activePath] Route currently being viewed; marks its item with a dot.
 */
export default function GooeyNavbar({ items, activePath }) {
  const navRef = useRef(null)
  const labelRefs = useRef([])
  const [metrics, setMetrics] = useState(null)
  const [hovered, setHovered] = useState(-1)
  const [cursor, setCursor] = useState(null)

  const activeIndex = items.findIndex(
    (item) => item.to && activePath && item.to === activePath,
  )

  // Natural pill widths come from the laid-out labels, so the text metrics are
  // the browser's own and the row survives a late webfont swap.
  const measure = useCallback(() => {
    const nodes = labelRefs.current.slice(0, items.length)
    if (nodes.length !== items.length || nodes.some((n) => !n)) return
    const widths = nodes.map((n) => Math.ceil(n.offsetWidth) + PAD_X * 2)
    const height = Math.ceil(nodes[0].offsetHeight) + PAD_Y * 2
    setMetrics((prev) => {
      if (
        prev &&
        prev.height === height &&
        prev.widths.length === widths.length &&
        prev.widths.every((w, i) => w === widths[i])
      ) {
        return prev
      }
      return { widths, height }
    })
  }, [items.length])

  useLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    labelRefs.current.forEach((n) => n && ro.observe(n))
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    if (!document.fonts?.ready) return
    document.fonts.ready.then(measure).catch(() => {})
  }, [measure])

  // One spring per pill, driving how far its joins have opened.
  const springs = useRef([])
  if (springs.current.length !== items.length) {
    springs.current = items.map((_, i) => springs.current[i] || { value: 0, velocity: 0 })
  }

  const [, forceRender] = useState(0)

  useEffect(() => {
    const targets = items.map((_, i) => (i === hovered || i === activeIndex ? 1 : 0))

    if (prefersReducedMotion()) {
      springs.current.forEach((s, i) => {
        s.value = targets[i]
        s.velocity = 0
      })
      forceRender((n) => n + 1)
      return undefined
    }

    let frame = 0
    let last = performance.now()
    const tick = (now) => {
      // Clamped so a backgrounded tab does not resume with one huge step.
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      let moving = false
      springs.current.forEach((s, i) => {
        const force = -STIFFNESS * (s.value - targets[i]) - DAMPING * s.velocity
        s.velocity += (force / MASS) * dt
        s.value += s.velocity * dt
        if (Math.abs(s.value - targets[i]) > SETTLED || Math.abs(s.velocity) > SETTLED) {
          moving = true
        } else {
          s.value = targets[i]
          s.velocity = 0
        }
      })
      forceRender((n) => n + 1)
      if (moving) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [hovered, activeIndex, items])

  const open = items.map((_, i) => springs.current[i]?.value ?? 0)

  let rects = []
  let shape = ''
  let width = 0
  let height = 0

  if (metrics) {
    height = metrics.height

    // Opening a join needs room, so the row widens. The opened pill itself
    // stays put and its neighbours slide aside; the row is then re-centred so
    // its visual weight, rather than an outer edge, is what holds still.
    const offsets = items.map((_, k) =>
      open.reduce((sum, amount, i) => {
        if (i === k || amount === 0) return sum
        return sum + PUSH * amount * Math.sign(k - i)
      }, 0),
    )
    const mean = offsets.reduce((a, b) => a + b, 0) / (offsets.length || 1)

    // The row breathes outward by PUSH on each side, so it starts inset by it.
    let x = PUSH
    rects = metrics.widths.map((w, i) => {
      const rect = { x: x + offsets[i] - mean, y: 0, width: w, height }
      x += w + GAP
      return rect
    })
    width = x - GAP + PUSH

    const pills = rects.map((r) => pillPath(r, RADIUS))
    const waists = rects
      .slice(0, -1)
      .map((r, i) =>
        waistPath(
          r,
          rects[i + 1],
          RADIUS,
          height * NECK_RATIO,
          Math.max(open[i], open[i + 1]),
        ),
      )
      .filter(Boolean)

    shape = [...pills, ...waists].join(' ')
  }

  const handleMove = (e) => {
    const box = navRef.current?.getBoundingClientRect()
    if (!box) return
    setCursor({ x: e.clientX - box.left, y: e.clientY - box.top })
  }

  return (
    <nav
      className="gooey-nav"
      aria-label="Primary"
      ref={navRef}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        setHovered(-1)
        setCursor(null)
      }}
      style={metrics ? { width, height } : undefined}
    >
      {metrics && (
        <>
          {/*
           * What is behind the row, blurred and clipped to its exact outline.
           * A DOM element rather than an SVG filter because backdrop-filter is
           * the only thing that can reach the page behind an element, and the
           * clip is the same path the shape is drawn from, so the blur ends
           * precisely where the glass does — waists included.
           */}
          <div className="gooey-nav-blur" style={{ clipPath: 'url(#gooey-nav-clip)' }} />

          {/*
           * The colour. Soft blobs bled into one another and cropped to the
           * row, so each pill shows whatever part of the field it happens to
           * be sitting over and no two are the same. Kept as blurred CSS
           * gradients rather than filtered SVG because it never changes: only
           * the clip moves as the joins open, so the field is painted once and
           * the compositor does the rest.
           *
           * The blur is on an oversized inner layer. Blurring the clipped one
           * would sample transparency past its own edge and fade the colour
           * out exactly where the rim needs it most.
           */}
          <div className="gooey-nav-tint" style={{ clipPath: 'url(#gooey-nav-clip)' }}>
            <span className="gooey-nav-tint-field" />
          </div>

          <svg
            className="gooey-nav-shape"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <clipPath id="gooey-nav-clip">
                <path d={shape} />
              </clipPath>
              <radialGradient id="gooey-nav-halo">
                {/* White, not lime. This was the last of the pastel palette
                    left in here — it only shows under the pill you are on, so
                    it survived the field going neutral and read as a green
                    stain on hover. */}
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              {/*
               * The bevel: light gathered hard against the top and bottom
               * edges and nothing across the middle, which is what a lens does
               * to the light passing through its rim. The middle staying clear
               * is the whole point — a wash over the full height would be a
               * tint, and a tint is the thing this is not.
               *
               * It is a second fill of the same union path, not a stroke.
               * Stroking would outline every subpath, and the waists run
               * through the pills, so their outlines would be drawn as lines
               * across the inside of the shape. Filling twice cannot do that.
               */}
              <linearGradient id="gooey-nav-sheen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                <stop offset="11%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="46%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="88%" stopColor="#ffffff" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path d={shape} fill="var(--nav-glass)" />
            <path d={shape} fill="url(#gooey-nav-sheen)" />
            {cursor && (
              <g clipPath="url(#gooey-nav-clip)">
                <circle cx={cursor.x} cy={cursor.y} r={HALO} fill="url(#gooey-nav-halo)" />
              </g>
            )}
          </svg>
        </>
      )}

      <ul className="gooey-nav-items">
        {items.map((item, i) => {
          const rect = rects[i]
          const style = rect
            ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
            : undefined
          const inner = (
            <>
              <span
                className="gooey-nav-label"
                ref={(n) => {
                  labelRefs.current[i] = n
                }}
              >
                {item.label}
              </span>
              {i === activeIndex && <span className="gooey-nav-dot" aria-hidden="true" />}
            </>
          )
          return (
            <li key={item.label} className="gooey-nav-item" style={style}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="gooey-nav-link"
                  aria-current={i === activeIndex ? 'page' : undefined}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(-1)}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="gooey-nav-link"
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(-1)}
                  onClick={item.onSelect}
                >
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
