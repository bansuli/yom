import {
  TeePink,
  Trousers,
  Sneaker,
  PinkBag,
  Glasses,
  TrackJacket,
} from '../Stickers'
import { BrowserChrome, PageHeader, TiltedNav } from '../components/Layout'

const LOOKS = [
  { title: 'look 01', note: 'market run', pieces: [TeePink, Trousers, Sneaker] },
  { title: 'look 02', note: 'night out', pieces: [TrackJacket, PinkBag, Glasses] },
  { title: 'look 03', note: 'studio day', pieces: [Trousers, TeePink, PinkBag] },
]

export default function Lookbook() {
  return (
    <section className="lookbook page-screen">
      <BrowserChrome path="yom.studio/lookbook" />
      <TiltedNav />
      <PageHeader />

      <div className="shop-intro">
        <h1 className="page-title">
          <span className="tilt-down">look</span>
          <span className="tilt-up">book</span>
        </h1>
        <p className="page-sub">volume 04 · editorial scraps</p>
      </div>

      <div className="looks">
        {LOOKS.map(({ title, note, pieces }) => (
          <article key={title} className="look">
            <div className="look-collage">
              {pieces.map((Icon, i) => (
                <Icon
                  key={i}
                  className={`look-piece look-piece-${i}`}
                />
              ))}
            </div>
            <h2 className="look-title">{title}</h2>
            <p className="look-note">{note}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
