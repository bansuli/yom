import { Link } from 'react-router-dom'
import './HowItWorks.css'

const STEPS = [
  {
    num: '1.',
    title: 'create your yom',
    lead: 'answer a few questions about yourself.',
    body: 'your style, sizes, wardrobe, favorite brands, budget, and upcoming events.',
    footer: 'the more yom knows you, the better it can help.',
  },
  {
    num: '2.',
    title: 'shop like normal',
    lead: 'browse your favorite stores.',
    list: [
      'no new marketplace.',
      'no new app.',
      'just shop the way you already do.',
    ],
  },
  {
    num: '3.',
    title: 'yom researches for you',
    lead: "while you're looking at a product, yom gets to work.",
    body: "it reads reviews from reddit, amazon, tiktok, the brand, and sizing forums, then checks fit, alternatives, and shipping—automatically.",
    footer: 'no extra tabs.',
  },
  {
    num: '4.',
    title: 'get personalized advice',
    lead: 'instead of generic reviews, yom tells you what matters to you.',
    list: [
      'will it fit?',
      'do you already own something similar?',
      'will it arrive before your trip?',
      'is there a better option?',
      'is it actually worth buying?',
    ],
  },
  {
    num: '5.',
    title: 'decide with confidence',
    lead: 'buy it. save it. skip it.',
    body: 'save shipped. anything yom flags — or anything you like — can go to your list for later.',
    footer: 'whatever you choose, yom remembers and gets smarter for next time.',
  },
  {
    num: '6.',
    title: 'soon…',
    lead: 'your yom will shop with other yoms.',
    list: [
      'find gifts together.',
      'plan trips.',
      'compare wishlists.',
      'help friends make better decisions.',
    ],
    footer: "shopping has always been social. we're bringing that back.",
  },
]

export default function HowItWorks() {
  return (
    <div className="hiw-page">
      <Link to="/" className="hiw-back">&larr; yom</Link>
      <div className="hiw-wrap">
        <h1 className="hiw-title">How yom Works</h1>

        <div className="hiw-steps">
          {STEPS.map((step, i) => (
            <div key={step.num} className="hiw-step">
              <div className="hiw-step-header">
                <span className="hiw-step-num">{step.num}</span>
                <h2 className="hiw-step-title">{step.title}</h2>
              </div>
              <p className="hiw-step-lead">{step.lead}</p>
              {step.list && (
                <ul className="hiw-step-list">
                  {step.list.map(item => <li key={item}>{item}</li>)}
                </ul>
              )}
              {step.body && <p className="hiw-step-body">{step.body}</p>}
              {step.footer && <p className="hiw-step-footer">{step.footer}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
