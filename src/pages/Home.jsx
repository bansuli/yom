import { Link } from 'react-router-dom'
import {
  TeePink,
  TeeYellow,
  PlaidShirt,
  TrackJacket,
  Trousers,
  MiniSkirt,
  Sneaker,
  PinkBag,
  Watch,
  Sock,
  Glasses,
  Necklace,
} from '../Stickers'
import { BrowserChrome, TiltedNav } from '../components/Layout'

export default function Home() {
  return (
    <section className="hero" aria-label="yom homepage">
      <BrowserChrome path="yom.studio" />

      <div className="collage" aria-hidden="true">
        <TeePink className="fit fit-tee-pink float-slow" />
        <Trousers className="fit fit-trousers float-med" />
        <PlaidShirt className="fit fit-plaid bob" />
        <Sneaker className="fit fit-sneaker float-slow" />
        <PinkBag className="fit fit-bag float-med" />
        <TrackJacket className="fit fit-jacket" />
        <MiniSkirt className="fit fit-skirt bob" />
        <TeeYellow className="fit fit-tee-yel float-slow" />
        <Watch className="fit fit-watch" />
        <Sock className="fit fit-sock float-med" />
        <Glasses className="fit fit-glasses bob" />
        <Necklace className="fit fit-necklace" />
      </div>

      <aside className="edge-label edge-left">SS26 · LIMITED RUN</aside>
      <aside className="edge-label edge-right">MADE IN THE STUDIO</aside>

      <TiltedNav />

      <div className="hero-center">
        <p className="brand" aria-label="yom">
          <span className="brand-y">y</span>
          <span className="brand-o">o</span>
          <span className="brand-m">m</span>
        </p>
        <svg className="wavy-line" viewBox="0 0 280 12" aria-hidden="true">
          <path
            d="M2 6 Q40 0 70 7 T140 5 T210 8 T278 4"
            stroke="#111"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="hero-line">
          let’s see if we’d survive a shopping trip together
        </h1>
        <div className="cta-row">
          <Link className="cta cta-primary" to="/shop">
            i’m in
          </Link>
        </div>
      </div>

      <p className="welcome" aria-hidden="true">
        <span>W</span>
        <span className="thin">e</span>
        <span>l</span>
        <span className="thin">c</span>
        <span>o</span>
        <span className="thin">m</span>
        <span>e</span>
        <span className="bang">!</span>
      </p>
    </section>
  )
}
