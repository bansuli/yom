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
} from '../Stickers'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'

const PRODUCTS = [
  { name: 'star tee', price: '48', Icon: TeeYellow, rotate: -8 },
  { name: 'graphic tee', price: '48', Icon: TeePink, rotate: 6 },
  { name: 'plaid shirt', price: '78', Icon: PlaidShirt, rotate: -4 },
  { name: 'track jacket', price: '120', Icon: TrackJacket, rotate: 10 },
  { name: 'wide trousers', price: '98', Icon: Trousers, rotate: -6 },
  { name: 'mini skirt', price: '62', Icon: MiniSkirt, rotate: 8 },
  { name: 'court sneaker', price: '110', Icon: Sneaker, rotate: -12 },
  { name: 'shoulder bag', price: '85', Icon: PinkBag, rotate: 5 },
]

export default function Shop() {
  return (
    <section className="shop page-screen">
      <BrowserChrome path="yom.studio/shop" />
      <TiltedNav />
      <PageHeader />

      <div className="shop-intro">
        <h1 className="page-title">
          <span className="tilt-down">the</span>
          <span className="tilt-up">drop</span>
        </h1>
        <p className="page-sub">SS26 · short runs · leftover mill stock</p>
      </div>

      <ul className="product-grid">
        {PRODUCTS.map(({ name, price, Icon, rotate }) => (
          <li key={name} className="product">
            <Link to="/cart" className="product-link">
              <span
                className="product-icon-wrap"
                style={{ transform: `rotate(${rotate}deg)` }}
              >
                <Icon className="product-icon" />
              </span>
              <span className="product-name">{name}</span>
              <span className="product-price">${price}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
