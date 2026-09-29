import { describe, expect, it } from 'vitest'
import {
  hasValidTailoredResumeExport,
  hasValidTailoredResumeProvenance,
  renderTailoredResumeDocument,
} from './tailored-resume-document'

const source = { candidateFacts: [{ id: 'source-fact-1', path: 'skills.0.name', status: 'attested', value: 'TypeScript' }], tailoredResume: { contactDetails: [{ kind: 'email', value: 'candidate@example.com' }], experiences: [], identity: { kind: 'personal-information', value: 'Ada Lovelace' }, locale: 'en', sections: [{ fields: [{ factIds: ['source-fact-1'], text: 'TypeScript' }], section: 'skills' }], targetRole: null, valueProposition: [{ factIds: ['source-fact-1'], text: 'Builds reliable software' }] } } as const

describe('Tailored Resume export document', () => {
  it('requires an identity and one contact method while keeping optional details optional', () => {
    expect(hasValidTailoredResumeExport(source)).toBe(true)
    expect(hasValidTailoredResumeExport({ ...source, tailoredResume: { ...source.tailoredResume, identity: null } })).toBe(false)
  })

  it('validates professional provenance independently from local contact details', () => {
    expect(hasValidTailoredResumeProvenance({
      ...source,
      tailoredResume: { ...source.tailoredResume, contactDetails: [] },
    })).toBe(true)
    expect(hasValidTailoredResumeProvenance({
      ...source,
      tailoredResume: {
        ...source.tailoredResume,
        valueProposition: [{ factIds: ['source-fact-missing'], text: 'Unsupported' }],
      },
    })).toBe(false)
  })

  it('renders standard ATS-readable sections from provenance-backed fields', () => {
    const html = renderTailoredResumeDocument({ tailoredResume: source.tailoredResume })
    expect(html).toContain('<h1>Ada Lovelace</h1>')
    expect(html).toContain('<h2>Summary</h2>')
    expect(html).toContain('<h2>Skills</h2>')
    expect(html.indexOf('Builds reliable software')).toBeLessThan(html.indexOf('TypeScript'))
  })
})
