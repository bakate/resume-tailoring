import { describe, expect, it } from 'vitest'

import { matchesExpectedLocale } from './writing-language-fidelity'

describe('writing language fidelity', () => {
  it('accepts the expected French and English outputs', () => {
    expect(matchesExpectedLocale({
      locale: 'fr', value: 'Développement d’une plateforme de facturation en TypeScript',
    })).toBe(true)
    expect(matchesExpectedLocale({
      locale: 'en', value: 'Built a billing platform with TypeScript.',
    })).toBe(true)
  })

  it('rejects mixed-language writing in either target locale', () => {
    expect(matchesExpectedLocale({
      locale: 'en', value: 'Développement d’une billing platform avec TypeScript',
    })).toBe(false)
    expect(matchesExpectedLocale({
      locale: 'fr', value: 'Built a billing platform avec TypeScript',
    })).toBe(false)
  })
})
