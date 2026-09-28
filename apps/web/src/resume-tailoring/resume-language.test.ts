import { describe, expect, it } from 'vitest'

import { readPreferredResumeLocale } from './resume-language'

describe('preferred Tailored Resume language', () => {
  it('uses French when the Job Posting contains more French signals', () => {
    expect(readPreferredResumeLocale({
      fallbackLocale: 'en',
      jobPostingContent: 'Poste avec des missions et compétences frontend.',
    })).toBe('fr')
  })

  it('recognizes ordinary French prose without relying on a tiny keyword list', () => {
    expect(readPreferredResumeLocale({
      fallbackLocale: 'en',
      jobPostingContent: 'Développeur frontend, maîtrise de TypeScript, conception '
        + "d’interfaces accessibles et amélioration continue.",
    })).toBe('fr')
  })

  it('uses English when the Job Posting contains more English signals', () => {
    expect(readPreferredResumeLocale({
      fallbackLocale: 'fr',
      jobPostingContent: 'Frontend role with React skills and product experience.',
    })).toBe('en')
  })

  it('uses the interface locale when the Job Posting language is ambiguous', () => {
    expect(readPreferredResumeLocale({
      fallbackLocale: 'fr',
      jobPostingContent: 'React TypeScript',
    })).toBe('fr')
  })
})
