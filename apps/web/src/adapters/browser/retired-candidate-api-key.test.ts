import { describe, expect, it } from 'vitest'

import { eraseRetiredCandidateApiKey } from './retired-candidate-api-key'

describe('Retired Candidate API Key', () => {
  it('erases a key an earlier version left in tab storage', () => {
    const tab = createMemoryStorage({ 'resume-studio.candidate-api-key': '{"apiKey":"sk-proj-left-behind"}',
      'honest-resume:candidate-session': '{}' })

    eraseRetiredCandidateApiKey({ readStorage: () => tab })

    expect(tab.getItem('resume-studio.candidate-api-key')).toBeNull()
    expect(tab.getItem('honest-resume:candidate-session')).toBe('{}')
  })

  it('starts even when tab storage is unavailable', () => {
    expect(() => { eraseRetiredCandidateApiKey({ readStorage: () => { throw new Error('Storage is disabled') } }) })
      .not.toThrow()
  })
})

function createMemoryStorage(initial: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => { values.clear() },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}
