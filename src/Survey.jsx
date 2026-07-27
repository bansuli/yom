import { useState, useRef } from 'react'
import './App.css'
import './Survey.css'

const modules = import.meta.glob('./assets/outfit-*.{jpg,webp,png}', { eager: true })
const OUTFITS = Object.values(modules).map(m => m.default)

export default function Survey() {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(null)
  const [dragX, setDragX] = useState(0)
  const startX = useRef(null)
  const dragging = useRef(false)

  function swipe(dir) {
    setDirection(dir)
    setDragX(0)
    setTimeout(() => {
      setDirection(null)
      setIndex(i => i + 1)
    }, 350)
  }

  function onPointerDown(e) {
    startX.current = e.clientX
    dragging.current = true
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    setDragX(e.clientX - startX.current)
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    if (dragX > 80) swipe('right')
    else if (dragX < -80) swipe('left')
    else setDragX(0)
  }

  const done = index >= OUTFITS.length
  const rotate = dragX * 0.05

  return (
    <div className="page">
      <section className="survey-hero">
        {!done ? (
          <>
            <p className="survey-q">swipe right to steal, left to skip</p>
            <div className="swipe-stage">
              <span className="side-hint left">✕</span>
              <div
                className={`swipe-card ${direction === 'left' ? 'swipe-left' : ''} ${direction === 'right' ? 'swipe-right' : ''}`}
                style={!direction ? { transform: `translateX(${dragX}px) rotate(${rotate}deg)` } : {}}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <img src={OUTFITS[index]} alt="" draggable={false} />
              </div>
              <span className="side-hint right">✓</span>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
