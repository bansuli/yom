import { Link } from 'react-router-dom'
import { Sneaker, TeePink } from '../Stickers'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'

export default function Cart() {
  return (
    <section className="cart page-screen">
      <BrowserChrome path="yom.studio/cart" />
      <TiltedNav />
      <PageHeader />

      <div className="cart-body">
        <h1 className="page-title">
          <span className="tilt-down">your</span>
          <span className="tilt-up">bag</span>
        </h1>

        <div className="cart-empty">
          <Sneaker className="cart-icon" />
          <TeePink className="cart-icon cart-icon-2" />
          <p className="page-sub">nothing in here yet — go survive a shopping trip</p>
          <Link className="cta cta-primary" to="/shop">
            shop the drop
          </Link>
        </div>
      </div>
    </section>
  )
}
