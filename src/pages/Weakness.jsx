import { useNavigate } from 'react-router-dom'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'
import { usePersona } from '../persona'
import {
  Sneaker,
  TrackJacket,
  PinkBag,
  TeeYellow,
  Necklace,
  Sock,
} from '../Stickers'

const WEAKNESSES = [
  { id: 'shoes', label: 'shoes', Icon: Sneaker, rotate: -5 },
  { id: 'jackets', label: 'jackets', Icon: TrackJacket, rotate: 4 },
  { id: 'bags', label: 'bags', Icon: PinkBag, rotate: -3 },
  { id: 'basics', label: 'basics', Icon: TeeYellow, rotate: 6 },
  { id: 'jewelry', label: 'jewelry', Icon: Necklace, rotate: -4 },
  { id: 'workout', label: 'workout clothes', Icon: Sock, rotate: 3 },
]

export default function Weakness() {
  const navigate = useNavigate()
  const { updatePersona } = usePersona()

  function pick(item) {
    updatePersona({
      weakness: item.id,
      weaknessLabel: item.label,
    })
    navigate('/lookbook')
  }

  return (
    <section className="trait page-screen">
      <BrowserChrome path="yom.studio/weakness" />
      <TiltedNav />
      <PageHeader />

      <div className="shop-intro">
        <h1 className="page-title closet-title">what’s your biggest weakness?</h1>
      </div>

      <ul className="weakness-grid">
        {WEAKNESSES.map(({ id, label, Icon, rotate }, i) => (
          <li key={id}>
            <button
              type="button"
              className="weakness-card"
              style={{ '--tilt': `${rotate}deg`, '--delay': `${i * 0.04}s` }}
              onClick={() => pick({ id, label })}
            >
              <span className="weakness-icon-wrap" aria-hidden="true">
                <Icon className="weakness-icon" />
              </span>
              <span className="weakness-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
