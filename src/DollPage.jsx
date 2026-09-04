import { useState } from 'react'
import Doll from './components/Doll.jsx'
import { EXPRESSION_NAMES } from './components/petFace.js'
import {
  HAIRSTYLES,
  HAIRSTYLE_NAMES,
  HAIR_COLORS,
  HAIR_COLOR_NAMES,
  SKIN_TONES,
  SKIN_TONE_NAMES,
} from './components/dollLooks.js'
import './DollPage.css'

/*
 * A room with nothing in it but her, so she can be judged on her own before
 * anyone decides where on the site she belongs — the same arrangement the pet
 * page uses.
 *
 * The controls are for looking, not for shipping. On a real page the look would
 * be chosen once during onboarding and the expression set by whatever she is
 * reacting to.
 */
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`

export default function DollPage() {
  const [hair, setHair] = useState('bob')
  const [hairColor, setHairColor] = useState('pink')
  const [skinTone, setSkinTone] = useState('sand')
  const [expression, setExpression] = useState('resting')

  return (
    <main className="doll-page">
      <div className="doll-stage">
        <Doll hair={hair} hairColor={hairColor} skinTone={skinTone} expression={expression} />
      </div>

      <div className="doll-rows">
        <div className="doll-row" role="group" aria-label="Hairstyle">
          <span className="doll-row-label">hair</span>
          {HAIRSTYLE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`doll-chip${name === hair ? ' is-on' : ''}`}
              aria-pressed={name === hair}
              onClick={() => setHair(name)}
            >
              {HAIRSTYLES[name].label}
            </button>
          ))}
        </div>

        <div className="doll-row" role="group" aria-label="Hair colour">
          <span className="doll-row-label">colour</span>
          {HAIR_COLOR_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`doll-chip${name === hairColor ? ' is-on' : ''}`}
              aria-pressed={name === hairColor}
              onClick={() => setHairColor(name)}
            >
              <span
                className="doll-swatch"
                style={{ background: hex(HAIR_COLORS[name].hex) }}
                aria-hidden="true"
              />
              {HAIR_COLORS[name].label}
            </button>
          ))}
        </div>

        <div className="doll-row" role="group" aria-label="Skin tone">
          <span className="doll-row-label">skin</span>
          {SKIN_TONE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`doll-chip${name === skinTone ? ' is-on' : ''}`}
              aria-pressed={name === skinTone}
              onClick={() => setSkinTone(name)}
            >
              <span
                className="doll-swatch"
                style={{ background: hex(SKIN_TONES[name].hex) }}
                aria-hidden="true"
              />
              {SKIN_TONES[name].label}
            </button>
          ))}
        </div>

        <div className="doll-row" role="group" aria-label="Expression">
          <span className="doll-row-label">mood</span>
          {EXPRESSION_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={`doll-chip${name === expression ? ' is-on' : ''}`}
              aria-pressed={name === expression}
              onClick={() => setExpression(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <p className="doll-hint">Move your cursor. Then poke her.</p>
    </main>
  )
}
