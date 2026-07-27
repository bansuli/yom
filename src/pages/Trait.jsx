import { useNavigate } from 'react-router-dom'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'
import { usePersona } from '../persona'
import {
  TeePink,
  Glasses,
  PinkBag,
  Watch,
  Sock,
} from '../Stickers'

const TRAITS = [
  {
    id: 'sale',
    label: 'i buy it because it’s on sale',
    Icon: PinkBag,
    rotate: -4,
  },
  {
    id: 'white-tops',
    label: 'i own 14 white tops',
    Icon: TeePink,
    rotate: 5,
  },
  {
    id: 'someday',
    label: 'i’ll wear it someday',
    Icon: Sock,
    rotate: -6,
  },
  {
    id: 'investment',
    label: 'i convince myself it’s an investment',
    Icon: Watch,
    rotate: 3,
  },
  {
    id: 'committee',
    label: 'i ask 8 people before buying',
    Icon: Glasses,
    rotate: -2,
  },
]

export default function Trait() {
  const navigate = useNavigate()
  const { updatePersona } = usePersona()

  function pick(item) {
    updatePersona({
      trait: item.id,
      traitLabel: item.label,
    })
    navigate('/weakness')
  }

  return (
    <section className="trait page-screen">
      <BrowserChrome path="yom.studio/trait" />
      <TiltedNav />
      <PageHeader />

      <div className="shop-intro">
        <h1 className="page-title closet-title">your toxic shopping trait?</h1>
      </div>

      <ul className="trait-list">
        {TRAITS.map(({ id, label, Icon, rotate }, i) => (
          <li key={id} className="trait-item">
            <button
              type="button"
              className="trait-link"
              style={{ '--tilt': `${rotate}deg`, '--delay': `${i * 0.04}s` }}
              onClick={() => pick({ id, label })}
            >
              <span className="trait-icon-wrap" aria-hidden="true">
                <Icon className="trait-icon" />
              </span>
              <span className="trait-label">“{label}”</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
