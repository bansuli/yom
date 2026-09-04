import { useId } from 'react'
import { Link } from 'react-router-dom'
import Doll from './Doll.jsx'
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

        {/*
          * An arrow down from the words to the character, so the two read as
          * one thing rather than as a caption sitting above a picture.
          *
          * The glyph, not a drawing of one. It was two hand-drawn paths, which
          * meant its weight and its proportions were mine to guess at and they
          * never quite sat with the type beside them. Set in the same face at
          * the same size, it matches by construction rather than by eye — and
          * being text in the same viewBox, it keeps its place between the words
          * and her at every size without a second set of units.
          */}
        <text className="cy-tick" x="50" y="21" textAnchor="middle">
          ↓
        </text>
      </svg>

      <span className="cy-face">
        <Doll />
      </span>
    </Link>
  )
}
