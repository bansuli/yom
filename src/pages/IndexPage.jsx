import { Link } from 'react-router-dom'
import {
  TeeYellow,
  Trousers,
  Sneaker,
  PinkBag,
  Glasses,
  Sock,
  MiniSkirt,
} from '../Stickers'
import { BrowserChrome } from '../components/Layout'
import { INDEX } from '../data'

export default function IndexPage() {
  return (
    <section className="index page-screen">
      <BrowserChrome path="yom.studio/index" />

      <div className="collage collage-index" aria-hidden="true">
        <TeeYellow className="fit idx-tee float-slow" />
        <Trousers className="fit idx-pants" />
        <Sneaker className="fit idx-shoe bob" />
        <PinkBag className="fit idx-bag float-med" />
        <Glasses className="fit idx-glasses" />
        <Sock className="fit idx-sock" />
        <MiniSkirt className="fit idx-skirt float-slow" />
      </div>

      <div className="index-grid">
        {INDEX.map((row) => (
          <Link key={row.n} to={row.path} className="index-row">
            <span className="index-label">
              <span className="index-n">({row.n})</span> {row.label}
            </span>
            <span className="index-detail">{row.detail}</span>
          </Link>
        ))}
      </div>

      <footer className="index-foot">
        <p>© {new Date().getFullYear()} yom studio</p>
        <p className="hand">no returns on weird · wear with luck</p>
      </footer>
    </section>
  )
}
