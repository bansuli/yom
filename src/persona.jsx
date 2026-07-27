import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'yom-persona'

const defaultPersona = {
  closet: null,
  closetLabel: null,
  trait: null,
  traitLabel: null,
  weakness: null,
  weaknessLabel: null,
  updatedAt: null,
}

const PersonaContext = createContext(null)

function loadPersona() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPersona
    return { ...defaultPersona, ...JSON.parse(raw) }
  } catch {
    return defaultPersona
  }
}

export function PersonaProvider({ children }) {
  const [persona, setPersona] = useState(loadPersona)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persona))
  }, [persona])

  const updatePersona = useCallback((patch) => {
    setPersona((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  const resetPersona = useCallback(() => {
    setPersona(defaultPersona)
  }, [])

  return (
    <PersonaContext.Provider value={{ persona, updatePersona, resetPersona }}>
      {children}
    </PersonaContext.Provider>
  )
}

export function usePersona() {
  const ctx = useContext(PersonaContext)
  if (!ctx) throw new Error('usePersona must be used within PersonaProvider')
  return ctx
}

/** Flat summary an AI agent can ingest */
export function personaPromptBlock(persona) {
  const lines = [
    'User shopping persona (from yom onboarding):',
    persona.closetLabel && `- Closet they’d steal: ${persona.closetLabel}`,
    persona.traitLabel && `- Toxic shopping trait: ${persona.traitLabel}`,
    persona.weaknessLabel && `- Biggest weakness / category: ${persona.weaknessLabel}`,
  ].filter(Boolean)
  return lines.join('\n')
}
