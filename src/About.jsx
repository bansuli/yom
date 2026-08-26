import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './About.css'

/** Phones get their own coordinates — the desktop ones are wider than the screen. */
function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = (e) => setPhone(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}

const SECTIONS = [
  {
    id: 'who',
    title: 'who we are',
    initialPos: { x: 80, y: 210 },
    phonePos: { x: 14, y: 150 },
    rotation: -2,
  },
  {
    id: 'love',
    title: 'things we love',
    initialPos: { x: 420, y: 180 },
    phonePos: { x: 96, y: 250 },
    rotation: 1.5,
  },
  {
    id: 'dont',
    title: "things we don't",
    initialPos: { x: 200, y: 430 },
    phonePos: { x: 20, y: 390 },
    rotation: -1,
  },
  {
    id: 'manifesto',
    title: 'our manifesto',
    initialPos: { x: 620, y: 370 },
    phonePos: { x: 88, y: 505 },
    rotation: 2,
  },
]

function WindowContent({ id }) {
  if (id === 'who') return (
    <>
      <p className="about-names">ban + mal</p>
      <p className="about-body">friends. builders. professional overthinkers.</p>
    </>
  )
  if (id === 'love') return (
    <ul className="about-list">
      <li>beautiful products.</li>
      <li>thoughtful design.</li>
      <li>the perfect white t-shirt.</li>
      <li>buying gifts.</li>
      <li>people who leave detailed reviews.</li>
    </ul>
  )
  if (id === 'dont') return (
    <ul className="about-list">
      <li>&ldquo;true to size.&rdquo;</li>
      <li>twenty open tabs.</li>
      <li>surprise customs fees.</li>
      <li>affiliate links pretending to be recommendations.</li>
      <li>returning packages.</li>
    </ul>
  )
  if (id === 'manifesto') return (
    <>
      <p className="about-body">technology shouldn&rsquo;t pressure people into buying more.</p>
      <p className="about-body">it should help them buy better.</p>
      <p className="about-body">the future of shopping isn&rsquo;t another store.</p>
      <p className="about-body">it&rsquo;s having someone you trust by your side.</p>
      <p className="about-body about-closer">that&rsquo;s what we&rsquo;re building.</p>
    </>
  )
  return null
}

export default function About() {
  const isPhone = useIsPhone()
  const [windows, setWindows] = useState(() =>
    SECTIONS.map((s, i) => ({
      id: s.id,
      title: s.title,
      pos: isPhone ? s.phonePos : s.initialPos,
      rotation: s.rotation,
      z: i + 1,
    }))
  )
  const moved = useRef(false)

  // Rotating the phone, or opening this on a laptop after a phone, should lay
  // them out for the screen she is actually on — unless she has already moved
  // one, in which case they are hers and nothing is allowed to shuffle them.
  useEffect(() => {
    if (moved.current) return
    setWindows(ws =>
      ws.map((w) => {
        const s = SECTIONS.find((sec) => sec.id === w.id)
        return { ...w, pos: isPhone ? s.phonePos : s.initialPos }
      })
    )
  }, [isPhone])

  const zCounter = useRef(SECTIONS.length)
  const dragging = useRef(null)
  const windowEls = useRef({})

  const bringToFront = (id) => {
    zCounter.current += 1
    const newZ = zCounter.current
    setWindows(ws => ws.map(w => w.id === id ? { ...w, z: newZ } : w))
    return newZ
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      e.preventDefault()
      const { id, startX, startY, startPosX, startPosY } = dragging.current
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const x = startPosX + clientX - startX
      const y = startPosY + clientY - startY
      dragging.current.lastX = x
      dragging.current.lastY = y
      const el = windowEls.current[id]
      if (el) {
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        el.style.transform = 'rotate(0deg)'
      }
    }

    const onUp = () => {
      if (!dragging.current) return
      const { id, lastX, lastY } = dragging.current
      if (lastX != null) {
        moved.current = true
        setWindows(ws => ws.map(w =>
          w.id === id ? { ...w, pos: { x: lastX, y: lastY }, rotation: 0 } : w
        ))
      }
      dragging.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const onDragStart = (e, id) => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const win = windows.find(w => w.id === id)
    bringToFront(id)
    dragging.current = {
      id,
      startX: clientX,
      startY: clientY,
      startPosX: win.pos.x,
      startPosY: win.pos.y,
      lastX: null,
      lastY: null,
    }
  }

  return (
    <div className="about-page">
      <div className="about-bg" />
      <Link to="/" className="about-back">← yom</Link>
      <h1 className="about-title">about us</h1>

      {windows.map(win => (
        <div
          key={win.id}
          ref={el => { windowEls.current[win.id] = el }}
          className="about-window"
          style={{
            left: win.pos.x,
            top: win.pos.y,
            zIndex: win.z,
            transform: `rotate(${win.rotation}deg)`,
          }}
          onMouseDown={e => onDragStart(e, win.id)}
          onTouchStart={e => onDragStart(e, win.id)}
        >
          <div className="about-window-bar">
            <span className="about-window-title">{win.title}</span>
          </div>
          <div className="about-window-body">
            <WindowContent id={win.id} />
          </div>
        </div>
      ))}
    </div>
  )
}
