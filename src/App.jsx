import { Link } from 'react-router-dom'
import sneakerImg from './assets/product-sneaker.webp'
import shirtImg from './assets/product-shirt.webp'
import cardiganImg from './assets/product-cardigan.webp'
import tabiImg from './assets/product-tabi.jpg'
import tankImg from './assets/product-tank.jpg'
import pantsImg from './assets/PRECIOUS V3 PANTS BLUE & PINK BY COLD CULTURE.webp'
import bagImg from './assets/Isabel Marant Maia Large Cognac Shoulder Bag & Authentic.jpg'
import extraImg from './assets/8e33e8051d690d5d76801ad0d826fdc8.jpg'
import './App.css'

const NAV = [
  { label: 'about', angle: -3 },
  { label: 'how it works', angle: 2 },
  { label: 'sign up', angle: -1 },
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
        <div className="sticker prod-bag"><img src={bagImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply', filter: 'brightness(1.4)' }} /></div>
        <div className="sticker prod-extra"><img src={extraImg} alt="" aria-hidden="true" style={{ width: '100%', display: 'block', mixBlendMode: 'multiply', filter: 'brightness(1.4)' }} /></div>

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
            <Link className="cta cta-primary" to="/survey">
              i'm in
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
