import { describe, expect, it } from 'vitest'

import {
  isSupportedResumeFieldText,
  moveResumeField,
  readResumeFields,
  removeResumeField,
  restoreResumeField,
  updateResumeField,
} from './tailored-resume-editing'

describe('Tailored Resume field editing', () => {
  it('keeps provenance while editing supported wording', () => {
    const reference = readResumeFields({ resume }).at(0)
    if (reference === undefined) throw new Error('Expected a Resume Field')

    const editedResume = updateResumeField({
      field: { ...reference.field, text: 'TypeScript APIs' },
      location: reference.location,
      resume,
    })

    expect(editedResume.valueProposition.paragraphs[0]).toEqual({
      id: 'summary-typescript', factIds: ['source-fact-typescript'], text: 'TypeScript APIs',
    })
  })

  it('identifies unsupported professional wording at the field', () => {
    const field = resume.valueProposition.paragraphs[0]

    expect(isSupportedResumeFieldText({
      candidateFacts, field, text: 'Invented revenue growth',
    })).toBe(false)
  })

  it('removes, restores, and reorders individual fields', () => {
    const reference = readResumeFields({ resume }).at(0)
    if (reference === undefined) throw new Error('Expected a Resume Field')
    const hiddenResume = removeResumeField({ location: reference.location, resume })
    const restoredResume = restoreResumeField({
      hiddenField: { field: reference.field, location: reference.location },
      resume: hiddenResume,
    })
    const movedResume = moveResumeField({ direction: 'down', location: reference.location, resume })

    expect(hiddenResume.valueProposition.paragraphs).toHaveLength(1)
    expect(restoredResume.valueProposition.paragraphs).toContainEqual(reference.field)
    expect(movedResume.valueProposition.paragraphs[1]).toEqual(reference.field)
  })
})

const candidateFacts = [
  { id: 'source-fact-typescript', path: 'skills.0.name', status: 'attested', value: 'TypeScript' },
] as const

const resume = {
  purpose: 'tailored',
  contactDetails: [{ kind: 'email', value: 'candidate@example.com' }],
  experiences: [],
  identity: { kind: 'personal-information', value: 'Candidate' },
  locale: 'en',
  sections: [],
  targetRole: null,
  valueProposition: { kind: 'evidence-excerpts', paragraphs: [
    { id: 'summary-typescript', factIds: ['source-fact-typescript'], text: 'TypeScript' },
    { id: 'summary-apis', factIds: ['source-fact-typescript'], text: 'APIs' },
  ] },
} as const
