import { describe, expect, it } from 'vitest'

import { readCondensableResumeFields, replaceCondensableResumeFields } from '../src/tailored-resume'
import type { TailoredResume, TailoredResumeExperience, TailoredResumeField } from '../src/tailored-resume'

describe('Tailored Resume condensation', () => {
  it('offers Value Proposition paragraphs and experience context and achievements for condensation', () => {
    const resume = createResume()

    const fields = readCondensableResumeFields({ resume })

    expect(fields.map(({ id }) => id)).toEqual(['summary', 'billing-context', 'billing', 'support'])
  })

  it('keeps roles, organizations and dates out of condensation', () => {
    const resume = createResume()

    const fields = readCondensableResumeFields({ resume })

    expect(fields.map(({ id }) => id)).not.toEqual(expect.arrayContaining(['billing-role', 'billing-organization', 'billing-start']))
  })

  it('replaces condensed prose by identity and leaves every other value unchanged', () => {
    const resume = createResume()

    const condensed = replaceCondensableResumeFields({ resume, replacements: new Map([
      ['summary', field({ id: 'summary', text: 'Accessible billing' })],
      ['billing', field({ id: 'billing', text: 'Built billing UI' })],
    ]) })

    expect(condensed).toEqual({ ...resume,
      valueProposition: { ...resume.valueProposition, paragraphs: [field({ id: 'summary', text: 'Accessible billing' })] },
      experiences: [{ ...billingExperience, achievements: [field({ id: 'billing', text: 'Built billing UI' })] },
        supportExperience],
    })
  })
})

function field({ id, text = id }: Readonly<{ id: string; text?: string }>): TailoredResumeField {
  return { id, text, factIds: [`source-fact-${id}`] }
}

const billingExperience = {
  id: 'experiences.0', chronology: 'relevant', role: field({ id: 'billing-role' }),
  organization: field({ id: 'billing-organization' }), startDate: field({ id: 'billing-start' }), endDate: null,
  context: field({ id: 'billing-context' }), achievements: [field({ id: 'billing' })],
} as const satisfies TailoredResumeExperience

const supportExperience = {
  id: 'experiences.1', chronology: 'context', role: field({ id: 'support-role' }), organization: null,
  startDate: null, endDate: null, context: null, achievements: [field({ id: 'support' })],
} as const satisfies TailoredResumeExperience

function createResume(): TailoredResume {
  return {
    purpose: 'tailored', locale: 'en', targetRole: null, identity: null, contactDetails: [],
    valueProposition: { kind: 'prose', paragraphs: [field({ id: 'summary' })] },
    experiences: [billingExperience, supportExperience],
    sections: [{ section: 'skills', groups: [{ id: 'skills.0', category: null, items: [field({ id: 'react' })] }] }],
  }
}
