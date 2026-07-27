import { IllustBrowse, IllustFit, IllustShip, IllustWear } from '../Stickers'
import { BrowserChrome, PageHeader } from '../components/Layout'

const STEPS = [
  {
    n: '01',
    Illust: IllustBrowse,
    text: 'Browse the drop — each piece is cut in short runs from leftover mill stock.',
  },
  {
    n: '02',
    Illust: IllustFit,
    text: 'Pick your fit. We grade every style in three bodies, no vanity sizing.',
  },
  {
    n: '03',
    Illust: IllustShip,
    text: 'We sew, press, and ship from the studio within five working days.',
  },
  {
    n: '04',
    Illust: IllustWear,
    text: 'Wear it weird. Send us a photo — the best ones join the lookbook.',
  },
]

export default function About() {
  return (
    <section className="how page-screen">
      <BrowserChrome path="yom.studio/about" />
      <PageHeader />

      <h1 className="how-title">
        <span className="tilt-down">How does</span>
        <span className="tilt-up">it work?</span>
      </h1>

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
  )
}
