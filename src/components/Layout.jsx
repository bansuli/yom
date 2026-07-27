import { Link } from 'react-router-dom'
import { NAV } from '../data'

export function BrowserChrome({ path = 'yom.studio' }) {
  return (
    <div className="browser-chrome" aria-hidden="true">
      <div className="traffic">
        <span className="dot red" />
        <span className="dot yellow" />
        <span className="dot green" />
      </div>
      <div className="url-bar">{path}</div>
    </div>
  )
}

export function TiltedNav() {
  return (
    <nav className="tilted-nav" aria-label="Primary">
      <Link to="/" className="nav-close" aria-label="Home">
        ×
      </Link>
      <div className="sticky-lime" aria-hidden="true">
        <span>오늘의 드롭</span>
        <span>new today</span>
      </div>
      {NAV.map((item) => (
        <Link
          key={item.label}
          to={item.path}
          className="nav-pill"
          style={{ '--angle': `${item.angle}deg` }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export function PageHeader({ path }) {
  return (
    <header className="how-header">
      <Link to="/" className="how-logo">
        yom
      </Link>
      <nav className="how-nav">
        <Link to="/shop" className="boxed">
          Shop
        </Link>
        <Link to="/lookbook">Lookbook</Link>
        <Link to="/archive">Archive</Link>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      {path ? <span className="page-path">{path}</span> : null}
    </header>
  )
}
