import { useNavigate } from 'react-router-dom'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'
import { usePersona } from '../persona'

const CLOSETS = [
  {
    id: 'polish',
    label: 'the polish',
    note: 'coats, bags, nowhere to be late',
    src: '/closets/minimal.jpg',
    rotate: -3,
  },
  {
    id: 'loud',
    label: 'the loud one',
    note: 'graphic tees & bad decisions',
    src: '/closets/street.jpg',
    rotate: 4,
  },
  {
    id: 'boardroom',
    label: 'the boardroom',
    note: 'blazers that mean business',
    src: '/closets/tailored.jpg',
    rotate: -2,
  },
  {
    id: 'soft-launch',
    label: 'the soft launch',
    note: 'florals, slits, sea air',
    src: '/closets/romantic.jpg',
    rotate: 3,
  },
  {
    id: 'track-star',
    label: 'the track star',
    note: 'athleisure that still turns up',
    src: '/closets/utility.jpg',
    rotate: -4,
  },
  {
    id: 'festival',
    label: 'the festival',
    note: 'lace, chains, yellow walls',
    src: '/closets/vintage.jpg',
    rotate: 5,
  },
]

export default function Shop() {
  const navigate = useNavigate()
  const { updatePersona } = usePersona()

  function pick(closet) {
    updatePersona({
      closet: closet.id,
      closetLabel: `${closet.label} — ${closet.note}`,
    })
    navigate('/trait')
  }

  return (
    <section className="shop page-screen">
      <BrowserChrome path="yom.studio/shop" />
      <TiltedNav />
      <PageHeader />

      <div className="shop-intro">
        <h1 className="page-title closet-title">
          pick the closet you’d steal
        </h1>
      </div>

      <ul className="closet-grid">
        {CLOSETS.map((closet) => (
          <li key={closet.id} className="closet">
            <button
              type="button"
              className="closet-link"
              style={{ '--tilt': `${closet.rotate}deg` }}
              onClick={() => pick(closet)}
            >
              <figure className="closet-frame">
                <img src={closet.src} alt="" className="closet-img" />
              </figure>
              <span className="closet-label">{closet.label}</span>
              <span className="closet-note">{closet.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
