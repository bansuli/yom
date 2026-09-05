import './ShopPage.css'

/*
 * The listing, as it actually is.
 *
 * Ban's call, made with the copyright position on the photograph spelled out —
 * it is their page and their risk to take. The wordmark is set in type rather
 * than traced or embedded: it reads as the brand at this size without a copy of
 * anyone's artwork living in the repository.
 *
 * Lifted out of the section that used to own it so there is one of it. It was
 * inlined in AboutSection, and the moment a second section needed the same
 * shop the choice was one component or two copies that drift.
 *
 * Entirely decorative and hidden from readers: it is a picture of a shop, and a
 * screen reader working through a fake size chart is the opposite of helpful.
 */

const NAV = ["what's new", 'men', 'women', 'denim', 'signature', 'sale']
const SIZES = ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40']
const TAGS = ['best seller', 'signature', 'jeans/ regular', 'daicock']
const PICKED = '34'

export default function ShopPage() {
  return (
    <div className="sp" aria-hidden="true">
      {/* The chrome across the top, which is most of what makes a page
          recognisable as somewhere you have been. */}
      <div className="sp-top">
        <span className="sp-logo">EVISU</span>
        <nav className="sp-nav">
          {NAV.map((n) => (
            <span key={n} className={n === 'sale' ? 'is-sale' : undefined}>
              {n}
            </span>
          ))}
        </nav>
        <span className="sp-icons">
          <i /> <i /> <i /> <i />
        </span>
      </div>

      <div className="sp-body">
        <div className="sp-shot">
          <div className="sp-thumbs">
            <span className="is-on" />
            <span />
            <span />
            <span />
          </div>
          <div className="sp-hero">
            <img className="sp-item" src="/pinkjeans.jpg" alt="" />
            <span className="sp-count">1/9</span>
          </div>
        </div>

        <div className="sp-side">
          <p className="sp-crumb">
            <span>home</span> › <span>all products</span> › daicock print baggy-fit jeans
            #2000
          </p>

          <div className="sp-panel">
            <h3 className="sp-name">Daicock Print Baggy-Fit Jeans #2000</h3>
            <p className="sp-price">$375 USD</p>
            <p className="sp-pay">
              4 interest-free installments, or from $33.85/mo with <b>shop</b>
            </p>

            <p className="sp-label">Color: INDIGO</p>
            <span className="sp-swatch" />

            <p className="sp-label sp-sizerow">
              Size: {PICKED}
              <span className="sp-guide">View Size Guide</span>
            </p>
            <ul className="sp-sizes">
              {SIZES.map((z) => (
                <li key={z} className={z === PICKED ? 'is-on' : undefined}>
                  {z}
                </li>
              ))}
            </ul>
            <p className="sp-model">- Model is 180cm tall and wears size 32</p>

            <p className="sp-cart">add to cart</p>

            <p className="sp-style">STYLE: 2EAECM2JE99500CT</p>
            <p className="sp-tags">
              {TAGS.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
