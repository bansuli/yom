import { createContext, useContext, useState } from 'react'

const Ctx = createContext(null)

export function EditProvider({ children }) {
  const [active, setActive] = useState(false)
  const [state, setState] = useState({})
  return (
    <Ctx.Provider value={{ active, setActive, state, setState }}>
      {children}
    </Ctx.Provider>
  )
}

export function DraggableImg({ src, prodClass }) {
  const { active, state, setState } = useContext(Ctx)
  const cur = state[prodClass] || {}

  function startDrag(e) {
    if (!active) return
    e.preventDefault()
    const hero = e.currentTarget.closest('.hero')
    const heroRect = hero.getBoundingClientRect()
    const elRect = e.currentTarget.getBoundingClientRect()
    const ox = e.clientX - (elRect.left - heroRect.left)
    const oy = e.clientY - (elRect.top - heroRect.top)

    function move(e) {
      setState(s => ({ ...s, [prodClass]: { ...s[prodClass], x: e.clientX - ox, y: e.clientY - oy } }))
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function startResize(e) {
    if (!active) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const el = e.currentTarget.parentElement
    const startW = el.offsetWidth

    function move(e) {
      setState(s => ({ ...s, [prodClass]: { ...s[prodClass], w: Math.max(60, startW + e.clientX - startX) } }))
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const override = {}
  if (cur.x != null) { override.left = cur.x + 'px'; override.right = 'auto' }
  if (cur.y != null) { override.top = cur.y + 'px'; override.bottom = 'auto' }
  if (cur.w != null) { override.width = cur.w + 'px' }

  return (
    <div
      className={`sticker ${prodClass}`}
      style={{
        ...override,
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'grab' : 'default',
        outline: active ? '2px dashed #c8f060' : 'none',
        outlineOffset: '2px',
      }}
      onMouseDown={startDrag}
    >
      <img src={src} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply' }} />
      {active && (
        <div
          onMouseDown={startResize}
          style={{
            position: 'absolute', bottom: -6, right: -6,
            width: 16, height: 16, background: '#c8f060',
            border: '1.5px solid #111', borderRadius: 3,
            cursor: 'nwse-resize',
          }}
        />
      )}
    </div>
  )
}

export function EditButton() {
  const { active, setActive, state } = useContext(Ctx)

  const css = Object.entries(state)
    .filter(([, v]) => v && (v.x != null || v.w != null))
    .map(([cls, v]) => {
      const parts = []
      if (v.x != null) parts.push(`left: ${Math.round(v.x)}px; top: ${Math.round(v.y)}px; right: auto; bottom: auto;`)
      if (v.w != null) parts.push(`width: ${Math.round(v.w)}px;`)
      return `.${cls} { ${parts.join(' ')} }`
    })
    .join('\n')

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      fontFamily: 'monospace', fontSize: 12,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {active && css && (
        <textarea
          readOnly value={css}
          onClick={e => e.target.select()}
          style={{ width: 440, height: 140, background: '#111', color: '#c8f060', padding: 10, border: 'none', borderRadius: 6, resize: 'none' }}
        />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {active && (
          <button
            onClick={() => navigator.clipboard?.writeText(css)}
            style={{ padding: '7px 14px', background: '#c8f060', border: 'none', borderRadius: 999, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 13 }}
          >
            copy css
          </button>
        )}
        <button
          onClick={() => setActive(v => !v)}
          style={{ padding: '7px 16px', background: active ? '#111' : '#fff', color: active ? '#fff' : '#111', border: '1.5px solid #111', borderRadius: 999, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700, fontSize: 13 }}
        >
          {active ? '✓ done' : '⚙ edit layout'}
        </button>
      </div>
    </div>
  )
}
