import { Link } from 'react-router-dom'
import { TeeYellow, MiniSkirt, Watch, Sock, Necklace, PlaidShirt } from '../Stickers'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'

const ARCHIVED = [
  { season: 'FW25', label: 'cold storage', Icon: PlaidShirt },
  { season: 'SS25', label: 'heat wave', Icon: TeeYellow },
  { season: 'FW24', label: 'night market', Icon: MiniSkirt },
  { season: 'SS24', label: 'first drop', Icon: Sock },
  { season: 'FW23', label: 'prototype', Icon: Watch },
  { season: 'SS23', label: 'beads only', Icon: Necklace },
]

export default function Archive() {
  return (
    <section className="archive page-screen">
      <BrowserChrome path="yom.studio/archive" />
      <TiltedNav />
      <PageHeader />

      <div className="shop-intro">
        <h1 className="page-title">
          <span className="tilt-down">past</span>
          <span className="tilt-up">seasons</span>
        </h1>
        <p className="page-sub">restocks · rarely · maybe</p>
      </div>

      <ul className="archive-list">
        {ARCHIVED.map(({ season, label, Icon }) => (
          <li key={season} className="archive-row">
            <Icon className="archive-icon" />
            <div>
              <p className="archive-season">{season}</p>
              <p className="archive-label">{label}</p>
            </div>
            <Link to="/contact" className="archive-cta">
              inquire
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
