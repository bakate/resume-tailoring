import { describe, expect, it } from 'vitest'
import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'

import { countUnsupportedResumeClaims } from './unsupported-resume-claims'

describe('unsupported Resume Claims of a prepared document', () => {
  it('counts nothing when every professional field cites a known Candidate Fact', () => {
    const document = createDocument({})

    const count = countUnsupportedResumeClaims({ candidateFacts, document })

    expect(count).toBe(0)
  })

  it('counts a field citing no Candidate Fact and a field citing an unknown one', () => {
    const document = createDocument({ achievements: [
      { id: 'uncited', text: 'Led the platform team', factIds: [] },
      { id: 'unknown', text: 'Built a billing platform', factIds: ['source-fact-invented'] },
    ] })

    const count = countUnsupportedResumeClaims({ candidateFacts, document })

    expect(count).toBe(2)
  })

  it.each([
    { label: 'a percent sign for "percent"', text: 'Reduced cloud spend by 31%', fact: 'Reduced cloud spend by 31 percent' },
    { label: 'a percent sign for "pour cent"', text: 'Reduced cloud spend by 31%', fact: 'Réduction des coûts de 31 pour cent' },
    { label: 'English digit grouping for a French one', text: 'Used by 2,000 clients', fact: 'Utilisée par 2 000 clients' },
    { label: 'a narrow no-break space grouping', text: 'Used by 2,000 clients', fact: 'Utilisée par 2 000 clients' },
    { label: 'a percent sign after a space', text: 'Cut loading time by 40%', fact: 'Réduction du temps de chargement de 40 %' },
  ])('counts nothing for a number its cited fact writes with $label', ({ fact, text }) => {
    const document = createDocument({ achievements: [{ id: 'achievement', text, factIds: ['source-fact-number'] }] })

    const count = countUnsupportedResumeClaims({ candidateFacts: [{ id: 'source-fact-number', value: fact }], document })

    expect(count).toBe(0)
  })

  it.each([
    { label: 'another amount', text: 'Used by 2,500 clients', fact: 'Utilisée par 2 000 clients' },
    { label: 'one group of a grouped number', text: 'Led 2 teams', fact: 'Utilisée par 2 000 clients' },
    { label: 'a percentage the fact states as a count', text: 'Grew revenue by 31%', fact: 'Mentored 31 engineers' },
  ])('counts a number its cited fact does not state: $label', ({ fact, text }) => {
    const document = createDocument({ achievements: [{ id: 'achievement', text, factIds: ['source-fact-number'] }] })

    const count = countUnsupportedResumeClaims({ candidateFacts: [{ id: 'source-fact-number', value: fact }], document })

    expect(count).toBe(1)
  })

  it('counts a field the field validator rejected that still reached the document, once', () => {
    const document = createDocument({})
    const rejectedFieldIds = ['achievement', 'achievement', 'field-not-in-the-document']

    const count = countUnsupportedResumeClaims({ candidateFacts, document, rejectedFieldIds })

    expect(count).toBe(1)
  })
})

const candidateFacts = [{ id: 'source-fact-billing', kind: 'experience', value: 'Built a billing platform' }] as const

function createDocument({ achievements = [{ id: 'achievement', text: 'Built a billing platform', factIds: ['source-fact-billing'] }] }:
Readonly<{ achievements?: ProfessionalResumeDocument['experiences'][number]['achievements'] }>): ProfessionalResumeDocument {
  return {
    purpose: 'tailored', locale: 'en', targetRole: null,
    valueProposition: { kind: 'prose', paragraphs: [] },
    experiences: [{ id: 'experiences.0', chronology: 'relevant', role: null, organization: null, startDate: null,
      endDate: null, context: null, achievements }],
    sections: [],
  }
}
