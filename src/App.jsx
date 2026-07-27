import { IllustBrowse, IllustFit, IllustShip, IllustWear } from './Stickers'
import { EditProvider, DraggableImg, EditButton } from './DragEditor'
import sneakerImg from './assets/product-sneaker.webp'
import shirtImg from './assets/product-shirt.webp'
import cardiganImg from './assets/product-cardigan.webp'
import tabiImg from './assets/product-tabi.jpg'
import tankImg from './assets/product-tank.jpg'
import './App.css'

const NAV = [
  { label: 'Shop', angle: -3 },
  { label: 'Lookbook', angle: 2 },
  { label: 'Archive', angle: -1 },
  { label: 'About', angle: 3 },
  { label: 'Contact', angle: -2 },
]

const STEPS = [
  { n: '01', Illust: IllustBrowse, text: 'browse the drop' },
  { n: '02', Illust: IllustFit, text: 'pick your fit' },
  { n: '03', Illust: IllustShip, text: 'we ship it strange' },
  { n: '04', Illust: IllustWear, text: 'wear it weirder' },
]

const INDEX = [
  { n: '01', label: 'SHOP', detail: 'all drops' },
  { n: '02', label: 'LOOKBOOK', detail: 'season visuals' },
  { n: '03', label: 'ARCHIVE', detail: 'past drops' },
  { n: '04', label: 'ABOUT', detail: 'the studio' },
  { n: '05', label: 'CONTACT', detail: 'say hello' },
]

function App() {
  return (
    <div className="page">
      {/* ── HERO ── */}
      <section className="hero" aria-label="yom homepage">
        <DraggableImg src={sneakerImg} prodClass="prod-sneaker" />
        <DraggableImg src={shirtImg} prodClass="prod-shirt" />
        <DraggableImg src={cardiganImg} prodClass="prod-cardigan" />
        <DraggableImg src={tabiImg} prodClass="prod-tabi" />
        <DraggableImg src={tankImg} prodClass="prod-tank" />

        <nav className="tilted-nav" aria-label="Primary">
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
          <h1 className="hero-line">
            let's see if we'd survive a shopping trip together
          </h1>
          <div className="cta-row">
            <a className="cta cta-primary" href="#shop">
              i'm in
            </a>
          </div>
        </div>

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
        <img src={sneakerImg} alt="" aria-hidden="true" className="sticker idx-sneaker" />
        <img src={cardiganImg} alt="" aria-hidden="true" className="sticker idx-cardigan" />
        <img src={tankImg} alt="" aria-hidden="true" className="sticker idx-tank" />
        <img src={tabiImg} alt="" aria-hidden="true" className="sticker idx-tabi" />

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

function AppWithEditor() {
  return (
    <EditProvider>
      <App />
      <EditButton />
    </EditProvider>
  )
}

export default AppWithEditor
