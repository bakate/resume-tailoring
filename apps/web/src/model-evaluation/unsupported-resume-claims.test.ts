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
