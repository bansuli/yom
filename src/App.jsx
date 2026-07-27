import {
  GooglyEyes,
  FlamingHeart,
  FashionUFO,
  Dice,
  LuckPatch,
  Ladybugs,
  Hanger,
  Eye,
  Spiral,
  Crescent,
  HandPeace,
  Pencil,
  IllustBrowse,
  IllustFit,
  IllustShip,
  IllustWear,
  CrumpledPaper,
  Scissors,
  ThreadSpool,
} from './Stickers'
import './App.css'

const NAV = [
  { label: 'SHOP', angle: -8 },
  { label: 'LOOKBOOK', angle: -5 },
  { label: 'ARCHIVE', angle: -3 },
  { label: 'ABOUT', angle: -6 },
  { label: 'CART (0)', angle: -4 },
]

const INDEX = [
  { n: '1', label: 'SHOP', detail: 'NEW DROPS · SS26' },
  { n: '2', label: 'LOOKBOOK', detail: 'EDITORIAL · VOLUME 04' },
  { n: '3', label: 'ARCHIVE', detail: 'PAST SEASONS · RESTOCKS' },
  { n: '4', label: 'STUDIO', detail: 'VISITS BY APPOINTMENT' },
  { n: '5', label: 'CONTACT', detail: 'hello@yom.studio' },
]

const STEPS = [
  {
    n: '01',
    Illust: IllustBrowse,
    text: 'Browse the drop — each piece is cut in short runs from leftover mill stock.',
  },
  {
    n: '02',
    Illust: IllustFit,
    text: 'Pick your fit. We grade every style in three bodies, no vanity sizing.',
  },
  {
    n: '03',
    Illust: IllustShip,
    text: 'We sew, press, and ship from the studio within five working days.',
  },
  {
    n: '04',
    Illust: IllustWear,
    text: 'Wear it weird. Send us a photo — the best ones join the lookbook.',
  },
]

function App() {
  return (
    <div className="page">
      {/* ── HERO ── */}
      <section className="hero" aria-label="yom homepage">
        <div className="browser-chrome" aria-hidden="true">
          <div className="traffic">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <div className="url-bar">yom.studio</div>
        </div>

        <Spiral className="sticker sticker-spiral float-slow" />
        <Crescent className="sticker sticker-moon float-med" />
        <Ladybugs className="sticker sticker-bugs float-slow" />
        <GooglyEyes className="sticker sticker-eyes bob" />
        <FashionUFO className="sticker sticker-ufo float-med" />
        <FlamingHeart className="sticker sticker-heart pulse" />
        <Eye className="sticker sticker-eye float-slow" />
        <HandPeace className="sticker sticker-hand float-med" />
        <Pencil className="sticker sticker-pencil" />
        <Hanger className="sticker sticker-hanger float-slow" />
        <Scissors className="sticker sticker-scissors float-med" />
        <ThreadSpool className="sticker sticker-spool" />
        <Dice className="sticker sticker-dice" />
        <LuckPatch className="sticker sticker-luck spin-slow" />
        <CrumpledPaper className="sticker sticker-paper-a" />
        <CrumpledPaper className="sticker sticker-paper-b" />

        <aside className="edge-label edge-left">SS26 · LIMITED RUN</aside>
        <aside className="edge-label edge-right">MADE IN THE STUDIO</aside>

        <nav className="tilted-nav" aria-label="Primary">
          <button type="button" className="nav-close" aria-label="Close menu">
            ×
          </button>
          <div className="sticky-lime" aria-hidden="true">
            <span>오늘의 드롭</span>
            <span>new today</span>
          </div>
          {NAV.map((item) => (
            <a
              key={item.label}
              href={`#${item.label.toLowerCase().split(' ')[0]}`}
              className="nav-pill"
              style={{ '--angle': `${item.angle}deg` }}
            >
              {item.label}
            </a>
          ))}
        </nav>

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
            <a className="cta cta-primary" href="#shop">
              i’m in
            </a>
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

      {/* ── HOW IT WORKS ── */}
      <section className="how" id="about">
        <header className="how-header">
          <p className="how-logo">yom</p>
          <nav className="how-nav">
            <a href="#shop" className="boxed">
              Shop
            </a>
            <a href="#lookbook">Lookbook</a>
            <a href="#archive">Archive</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        <h2 className="how-title">
          <span className="tilt-down">How does</span>
          <span className="tilt-up">it work?</span>
        </h2>

        <ol className="steps">
          {STEPS.map(({ n, Illust, text }) => (
            <li key={n} className="step">
              <Illust className="step-illust" />
              <span className="step-n">{n}</span>
              <p className="step-text">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── INDEX / CONTACT COLLAGE ── */}
      <section className="index" id="shop">
        <Ladybugs className="sticker idx-bugs" />
        <GooglyEyes className="sticker idx-eyes bob" />
        <FashionUFO className="sticker idx-ufo float-med" />
        <FlamingHeart className="sticker idx-heart pulse" />
        <Dice className="sticker idx-dice" />
        <LuckPatch className="sticker idx-luck spin-slow" />
        <Hanger className="sticker idx-hanger" />

        <div className="index-grid">
          {INDEX.map((row) => (
            <a
              key={row.n}
              href={`#${row.label.toLowerCase()}`}
              className="index-row"
              id={row.label === 'SHOP' ? undefined : row.label.toLowerCase()}
            >
              <span className="index-label">
                <span className="index-n">({row.n})</span> {row.label}
              </span>
              <span className="index-detail">{row.detail}</span>
            </a>
          ))}
        </div>

        <footer className="index-foot">
          <p>© {new Date().getFullYear()} yom studio</p>
          <p className="hand">no returns on weird · wear with luck</p>
        </footer>
      </section>
    </div>
  )
}

export default App
