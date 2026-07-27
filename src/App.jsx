import sneakerImg from './assets/product-sneaker.webp'
import shirtImg from './assets/product-shirt.webp'
import cardiganImg from './assets/product-cardigan.webp'
import tabiImg from './assets/product-tabi.jpg'
import tankImg from './assets/product-tank.jpg'
import pantsImg from './assets/PRECIOUS V3 PANTS BLUE & PINK BY COLD CULTURE.webp'
import './App.css'

const NAV = [
  { label: 'Shop', angle: -3 },
  { label: 'Lookbook', angle: 2 },
  { label: 'Archive', angle: -1 },
  { label: 'About', angle: 3 },
  { label: 'Contact', angle: -2 },
]

function App() {
  return (
    <div className="page">
      <section className="hero" aria-label="yom homepage">
        <div className="sticker prod-sneaker"><img src={sneakerImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply' }} /></div>
        <div className="sticker prod-shirt"><img src={shirtImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply' }} /></div>
        <div className="sticker prod-cardigan"><img src={cardiganImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply' }} /></div>
        <div className="sticker prod-tabi"><img src={tabiImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply' }} /></div>
        <div className="sticker prod-tank"><img src={tankImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply' }} /></div>
        <div className="sticker prod-pants"><img src={pantsImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply', filter: 'brightness(1.6)' }} /></div>

        <nav className="tilted-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={`#${item.label.toLowerCase()}`}
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
    </div>
  )
}

export default App
