import { describe, expect, it } from 'vitest'
import { groupedResumeDocument } from '@resume-tailoring/application/structured-resume-fixtures'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'

import { readEditorEntries } from './resume-editor-entries'

const resume: TailoredResume = groupedResumeDocument

describe('Resume editor entries', () => {
  it('groups each experience into one entry named after its role and employer, with a label per field kind', () => {
    const northwind = readEditorEntries({ resume }).find(({ id }) => id === 'experience:experiences.0')
    expect(northwind?.name).toBe('Frontend Engineer · Northwind')
    expect(northwind?.fields.map(({ label }) => label)).toEqual([
      { kind: 'role', position: null }, { kind: 'organization', position: null }, { kind: 'startDate', position: null },
      { kind: 'endDate', position: null }, { kind: 'context', position: null }, { kind: 'achievement', position: 1 },
    ])
  })

  it('lists the entries in the resume section order, one per experience and skill group', () => {
    const ordered = { ...resume, sectionOrder: ['skills', 'experiences', 'value-proposition'] } satisfies TailoredResume
    expect(readEditorEntries({ resume: ordered }).map(({ id }) => id)).toEqual(['skill-group:skills.0', 'experience:experiences.0',
      'experience:experiences.1', 'value-proposition', 'section:education', 'section:languages', 'section:projects', 'section:certifications'])
  })

  it('numbers the repeated fields of an entry and names a skill group after its category', () => {
    const skills = readEditorEntries({ resume }).find(({ id }) => id === 'skill-group:skills.0')
    expect(skills?.name).toBe('Front-end')
    expect(skills?.fields.map(({ label }) => label)).toEqual([
      { kind: 'category', position: null }, { kind: 'skill', position: 1 }, { kind: 'skill', position: 2 }])
  })

  it('names an experience without role or employer after its position', () => {
    const [first] = resume.experiences
    if (first === undefined) throw new Error('The fixture has an experience')
    const anonymous = { ...resume, experiences: [{ ...first, role: null, organization: null }] }
    expect(readEditorEntries({ resume: anonymous }).find(({ section }) => section === 'experiences')?.name).toBe('1')
  })

  it('gives every field a distinct label even when two experiences share a role and employer', () => {
    const [first] = resume.experiences
    if (first === undefined) throw new Error('The fixture has an experience')
    const repeated = { ...resume, experiences: [first, { ...first, id: 'experiences.2', achievements: first.achievements.map((field) => ({ ...field, id: `${field.id}-2` })) }] }
    const entries = readEditorEntries({ resume: repeated })
    const labels = entries.flatMap(({ name, section, fields }) => fields.map(({ label }) => JSON.stringify([section, name, label])))
    expect(new Set(labels).size).toBe(labels.length)
    expect(entries.filter(({ section }) => section === 'experiences').map(({ name }) => name))
      .toEqual(['Frontend Engineer · Northwind (1)', 'Frontend Engineer · Northwind (2)'])
  })
})
