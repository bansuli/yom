import { useId } from 'react'
import { Link } from 'react-router-dom'
import Pet from './Pet.jsx'
import './CreateYom.css'

/*
 * The way in: the character, with the words curving over it.
 *
 * A link, and only a link. It was a picker that sent four yoms out from behind
 * itself and carried the chosen one into onboarding — that is gone, and with it
 * four WebGL contexts the page was holding open for a control nobody had asked
 * for yet. It is recoverable from the history if the choice belongs here after
 * all.
 */
export default function CreateYom({ to = '/onboarding', label = 'CREATE YOUR YOM' }) {
  /* SVG ids are global, so the arc's has to be unique per instance. */
  const arcId = `cy-arc-${useId().replace(/:/g, '')}`

  return (
    <Link className="cy" to={to} aria-label={label}>
      {/*
        * The words ride an arc rather than sitting in a row, which is the one
        * thing CSS cannot set type on — a textPath follows the shape exactly,
        * and the shape is the top half of a circle a little wider than the
        * character beneath it.
        *
        * Written in capitals here rather than uppercased in CSS: text-transform
        * is unreliable on SVG text, and a control that reads correctly in one
        * browser and in sentence case in another is worse than slightly less
        * tidy source.
        */}
      <svg className="cy-arc" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <path id={arcId} d="M 8 52 A 42 42 0 0 1 92 52" fill="none" />
        </defs>
        <text>
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {label}
          </textPath>
        </text>
      </svg>

      <span className="cy-face">
        <Pet />
      </span>
    </Link>
  )
}
