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

  it('writes an en dash wherever the content carries an em dash', () => {
    const resume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })
    const tailoredResume = { ...resume, locale: 'fr' as const, purpose: 'normalized' as const,
      sections: [{ section: 'projects' as const, fields: [{ id: 'project-1', factIds: ['source-fact-projects-0-name-0' as const],
        text: 'Parent Up — Plateforme de co-parentalité' }] }] }

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).not.toContain('—')
    expect(html).toContain('Parent Up – Plateforme de co-parentalité')
    expect(html).toContain('CV général – non adapté à une offre')
  })

  it('ends the dates line of an experience with its location', () => {
    const resume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })
    const [experience] = resume.experiences
    if (experience === undefined) throw new Error('The fixture has an experience')
    const location = { id: 'location-northwind', factIds: ['source-fact-experiences-0-location-0' as const], text: 'Paris' }

    const html = renderTailoredResumeDocument({ tailoredResume: { ...resume,
      experiences: [{ ...experience, location }, { ...experience, id: 'experiences.9', startDate: null, endDate: null, location }] } })

    expect(html).toContain('<p class="experience-dates"><span>2021 – 2024</span><span class="experience-location">Paris</span></p>')
    expect(html).toContain('<p class="experience-dates"><span></span><span class="experience-location">Paris</span></p>')
  })

  it('renders an Earlier Experience as one line of role, organization and dates, without achievements', () => {
    const resume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })
    const [experience] = resume.experiences
    if (experience === undefined) throw new Error('The fixture has an experience')

    const html = renderTailoredResumeDocument({ tailoredResume: { ...resume, experiences: [{ ...experience, chronology: 'earlier' }] } })

    expect(html).toContain('<article class="resume-experience earlier-experience"><p class="experience-line">'
      + '<span class="experience-role">Frontend Engineer</span> · <span class="experience-organization">Northwind</span>'
      + '<span class="experience-dates">2021 – 2024</span></p></article>')
    const experiences = html.slice(html.indexOf('<h2>Experience</h2>'), html.indexOf('</section>', html.indexOf('<h2>Experience</h2>')))
    expect(experiences).not.toContain('Built accessible billing screens')
    expect(experiences).not.toContain('Customer billing team')
  })

  it('names an Earlier Experience without role or organization by its context on its one line', () => {
    const resume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })
    const [experience] = resume.experiences
    if (experience === undefined) throw new Error('The fixture has an experience')

    const html = renderTailoredResumeDocument({ tailoredResume: { ...resume, experiences: [{ ...experience,
      chronology: 'earlier', role: null, organization: null }] } })

    expect(html).toContain('<p class="experience-line"><span class="experience-role">Customer billing team</span>'
      + '<span class="experience-dates">2021 – 2024</span></p>')
  })

  it('places the photo in its own header column, beside contact details that never break inside', () => {
    const tailoredResume = createTailoredResume({ jobMatch: structuredResumeJobMatch, sourceIntake: structuredResumeSource })
    const photoDataUrl = 'data:image/png;base64,iVBORw0KGgo='

    const html = renderTailoredResumeDocument({ tailoredResume, photoDataUrl })

    expect(html).toMatch(/<header class="with-photo"><div class="resume-identity"><h1>.*<\/address><\/div><img class="resume-photo"/u)
    expect(html).toContain('<span class="contact-detail">alex@example.com</span>')
    expect(renderTailoredResumeDocument({ tailoredResume })).toContain('<header><div class="resume-identity">')
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

  it('heads a Tailored Resume with its headline, never the Target Role, and checks the headline provenance', () => {
    const tailoredResume = { ...source.tailoredResume,
      targetRole: { value: 'Développeur Front-end React', sourceExcerpt: 'Développeur Front-end React (H/F)' },
      headline: { id: 'headline', factIds: ['source-fact-1'], text: 'Développeuse Front-end' } } as const

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('<p>Développeuse Front-end</p>')
    expect(html).not.toContain('Développeur Front-end React')
    expect(hasValidTailoredResumeProvenance({ ...source, tailoredResume: { ...tailoredResume,
      headline: { ...tailoredResume.headline, factIds: ['source-fact-unknown'] } } })).toBe(false)
  })

  it('heads a Tailored Resume prepared before headlines existed with its Target Role', () => {
    const tailoredResume = { ...source.tailoredResume,
      targetRole: { value: 'Frontend Engineer', sourceExcerpt: 'Frontend Engineer' } } as const

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('<p>Frontend Engineer</p>')
  })

  it('labels a Normalized Resume explicitly without claiming a Target Role', () => {
    const tailoredResume = { ...source.tailoredResume, purpose: 'normalized',
      targetRole: { value: 'Frontend Engineer', sourceExcerpt: 'Frontend Engineer' } } as const

    const html = renderTailoredResumeDocument({ tailoredResume })

    expect(html).toContain('General resume – not tailored to a job')
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
