import { describe, expect, it } from 'vitest'

import { createTailoredResume, readExperienceFields, readSectionFields } from '@resume-tailoring/application/tailored-resume'

describe('Tailored Resume generation', () => {
  it('creates a complete structured resume with field-level Candidate Fact provenance', () => {
    const tailoredResume = createTailoredResume({ jobMatch, sourceIntake })

    expect(tailoredResume).toMatchObject({
      contactDetails: [{ kind: 'email', value: 'bakate@example.com' }],
      identity: null,
      locale: 'fr',
      targetRole: { value: 'Développeur Full Stack' },
    })
    expect(tailoredResume.valueProposition.paragraphs[0]).toMatchObject({
      factIds: ['source-fact-experiences-0-achievements-0'],
    })
    expect(tailoredResume.valueProposition.paragraphs).toHaveLength(4)
    expect(tailoredResume.experiences[0]?.chronology).toBe('relevant')
    expect(tailoredResume.experiences[0]?.role).toMatchObject({
      factIds: ['source-fact-experiences-0-role-0'], text: 'Développeur Full Stack',
    })
    expect(tailoredResume.sections.map(({ section }) => section)).toEqual([
      'skills', 'education', 'languages', 'projects', 'certifications',
    ])
    expect(readFields({ tailoredResume }).every((field) => field.factIds.length > 0)).toBe(true)
  })

  it('uses the Candidate-selected language without translating qualifications or proper nouns', () => {
    const tailoredResume = createTailoredResume({ jobMatch, locale: 'en', sourceIntake })

    expect(tailoredResume.locale).toBe('en')
    expect(readFields({ tailoredResume }).map(({ text }) => text))
      .toContain('Certification AWS Solutions Architect')
  })
})

function readFields({ tailoredResume }: Readonly<{ tailoredResume: ReturnType<typeof createTailoredResume> }>) {
  return [
    ...tailoredResume.valueProposition.paragraphs,
    ...tailoredResume.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...tailoredResume.sections.flatMap((section) => readSectionFields({ section })),
  ]
}

const sourceIntake = {
  candidateFacts: [
    { id: 'source-fact-experiences-0-role-0', path: 'experiences.0.role.0', status: 'attested', value: 'Développeur Full Stack' },
    { id: 'source-fact-experiences-0-achievements-0', path: 'experiences.0.achievements.0', status: 'attested', value: 'Livré des APIs TypeScript' },
    { id: 'source-fact-skills-0-name-0', path: 'skills.0.name.0', status: 'attested', value: 'TypeScript' },
    { id: 'source-fact-education-0-qualification-0', path: 'education.0.qualification.0', status: 'attested', value: 'Master Informatique' },
    { id: 'source-fact-languages-0-name-0', path: 'languages.0.name.0', status: 'attested', value: 'Français' },
    { id: 'source-fact-projects-0-name-0', path: 'projects.0.name.0', status: 'attested', value: 'Resume Generator' },
    { id: 'source-fact-certifications-0-name-0', path: 'certifications.0.name.0', status: 'attested', value: 'Certification AWS Solutions Architect' },
  ],
  contactDetails: [
    { kind: 'personal-information', value: 'Bakate' },
    { kind: 'email', value: 'bakate@example.com' },
  ],
  criticalAmbiguities: [],
  originalContent: 'Source profile',
  sourceDocument: { kind: 'pasted-text', name: 'source.txt' },
  sourceProfile: {
    certifications: [], education: [], experiences: [], languages: [], projects: [], skills: [],
  },
} as const

const jobMatch = {
  analysis: {
    adjacentEvidence: [],
    criticalRequirementReserve: { requirementIds: [], status: 'clear' },
    evidence: [],
    generationEligibility: 'eligible',
    matchBand: 'strong',
    matchBandQualification: null,
    matchScore: 100,
    relevantFactIds: ['source-fact-experiences-0-achievements-0'],
    requirementGroups: [],
  },
  jobPosting: { kind: 'pasted-text', name: 'role.txt', originalContent: 'Poste avec des compétences TypeScript.' },
  practicalConstraints: [],
  priorityGapRequirementIds: [],
  requirements: [],
  strengthRequirementIds: [],
  targetRole: { sourceExcerpt: 'Poste : Développeur Full Stack', value: 'Développeur Full Stack' },
} as const
