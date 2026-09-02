import { useState } from 'react'
import Pet from './components/Pet.jsx'
import { EXPRESSION_NAMES } from './components/petFace.js'
import { VARIANT_NAMES, VARIANTS } from './components/petVariants.js'
import './PetPage.css'

/*
 * A room with nothing in it but the pet, so it can be judged on its own before
 * anyone decides where on the site it belongs.
 *
 * The controls are for looking, not for shipping — on the real page the variant
 * would be chosen once and the expression set by whatever the pet is reacting
 * to.
 */
export default function PetPage() {
  const [variant, setVariant] = useState('square')
  const [expression, setExpression] = useState('resting')

  return (
    <main className="pet-page">
      <div className="pet-stage">
        <Pet variant={variant} expression={expression} />
      </div>

      <div className="pet-kinds" role="group" aria-label="Which pet">
        {VARIANT_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            className={`pet-kind${name === variant ? ' is-on' : ''}`}
            aria-pressed={name === variant}
            onClick={() => setVariant(name)}
          >
            <span
              className="pet-swatch"
              style={{ background: `#${VARIANTS[name].color.toString(16).padStart(6, '0')}` }}
              aria-hidden="true"
            />
            {VARIANTS[name].label}
          </button>
        ))}
      </div>

      <div className="pet-moods" role="group" aria-label="Expression">
        {EXPRESSION_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            className={`pet-mood${name === expression ? ' is-on' : ''}`}
            aria-pressed={name === expression}
            onClick={() => setExpression(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="pet-hint">Move your cursor. Then poke it.</p>
    </main>
  )
}
