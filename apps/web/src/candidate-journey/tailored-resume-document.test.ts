import { createTailoredResume } from '@resume-tailoring/application/tailored-resume'
import { structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { describe, expect, it } from 'vitest'
import {
  hasValidTailoredResumeExport,
  hasValidTailoredResumeProvenance,
  renderTailoredResumeDocument,
} from './tailored-resume-document'

const source = { candidateFacts: [{ id: 'source-fact-1', path: 'skills.0.name', status: 'attested', value: 'TypeScript' }], tailoredResume: { purpose: 'tailored', contactDetails: [{ kind: 'email', value: 'candidate@example.com' }], experiences: [], identity: { kind: 'personal-information', value: 'Ada Lovelace' }, locale: 'en', sections: [{ groups: [{ id: 'skills.0', category: null, items: [{ id: 'skill-1', factIds: ['source-fact-1'], text: 'TypeScript' }] }], section: 'skills' }], targetRole: null, valueProposition: { kind: 'evidence-excerpts', paragraphs: [{ id: 'summary-1', factIds: ['source-fact-1'], text: 'Builds reliable software' }] } } } as const

describe('Tailored Resume export document', () => {
  it('renders roles, employers, and dates together instead of metadata bullets', () => {
    const tailoredResume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('<h3>Frontend Engineer</h3>')
    expect(html).toContain('<p class="experience-organization">Northwind</p>')
    expect(html).toContain('<p class="experience-dates">2021 – 2024</p>')
    expect(html).toContain('<li>Built accessible billing screens</li>')
    expect(html).not.toContain('<li>Northwind</li>')
    expect(html.indexOf('2021 – 2024')).toBeLessThan(html.indexOf('<h3>Software Developer</h3>'))
  })

  it('renders one category heading and unique skill items', () => {
    const tailoredResume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('<h3>Front-end</h3><p>React · TypeScript</p>')
    expect(html).not.toContain('<li>Front-end</li>')
    expect(html.match(/<h3>Front-end<\/h3>/gu)).toHaveLength(1)
  })

  it('renders a written Value Proposition as prose with its provenance', () => {
    const tailoredResume = { ...source.tailoredResume,
      valueProposition: { kind: 'prose', paragraphs: [
        { id: 'summary-prose', factIds: ['source-fact-1'], text: 'Builds reliable software.' },
      ] },
    } as const

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('<p>Builds reliable software.</p>')
    expect(html).not.toContain('<li>Builds reliable software.</li>')
    expect(hasValidTailoredResumeProvenance({ ...source, tailoredResume })).toBe(true)
  })

  it('labels a Normalized Resume explicitly without claiming a Target Role', () => {
    const tailoredResume = { ...source.tailoredResume, purpose: 'normalized',
      targetRole: { value: 'Frontend Engineer', sourceExcerpt: 'Frontend Engineer' } } as const

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('Normalized Resume — not tailored')
    expect(html).not.toContain('<p>Frontend Engineer</p>')
  })

  it('rejects professional fields linked to excluded Candidate Facts', () => {
    const candidateFacts = source.candidateFacts.map((fact) => ({ ...fact,
      status: 'excluded-critical-ambiguity' as const }))

    const canExport = hasValidTailoredResumeExport({ ...source, candidateFacts })

    expect(canExport).toBe(false)
  })

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
        valueProposition: { kind: 'prose', paragraphs: [{ id: 'summary-1', factIds: ['source-fact-missing'], text: 'Unsupported' }] },
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
