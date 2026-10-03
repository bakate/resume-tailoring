import { describe, expect, it } from 'vitest'

import type { SourceIntake } from '@resume-tailoring/application/source-intake'
import type { Localization } from '../localization/localization'
import { formatNormalizedSourceResume } from './normalized-source-resume'

describe('normalized source resume', () => {
  it('renders structured source data as an explicitly non-tailored resume', () => {
    const resume = formatNormalizedSourceResume({ sourceIntake, translate: englishTranslate })

    expect(resume).toContain('NORMALIZED SOURCE RESUME – NOT TAILORED')
    expect(resume).toContain('Email: candidate@example.com')
    expect(resume).toContain('EXPERIENCE\nSenior Engineer – Example Corp\n2021 – 2025')
    expect(resume).toContain('- Led the platform migration')
    expect(resume).toContain('SKILLS\n- TypeScript – Programming')
    expect(resume).toContain('ADDITIONAL VERIFIED INFORMATION\n- Mentored six engineers')
  })

  it('renders document labels in the selected locale', () => {
    const resume = formatNormalizedSourceResume({ sourceIntake, translate: frenchTranslate })

    expect(resume).toContain('CV SOURCE NORMALISÉ – NON ADAPTÉ')
    expect(resume).toContain('COORDONNÉES\nE-mail: candidate@example.com')
    expect(resume).toContain('EXPÉRIENCE\nSenior Engineer – Example Corp')
    expect(resume).toContain('COMPÉTENCES\n- TypeScript – Programming')
    expect(resume).toContain('INFORMATIONS VÉRIFIÉES SUPPLÉMENTAIRES')
  })
})

const englishTranslate = createTranslate({
  'jobMatch.generation.contact.email': 'Email',
  'jobMatch.generation.normalizedAdditional': 'ADDITIONAL VERIFIED INFORMATION',
  'jobMatch.generation.normalizedCertifications': 'CERTIFICATIONS',
  'jobMatch.generation.normalizedContact': 'CONTACT',
  'jobMatch.generation.normalizedDocumentTitle': 'NORMALIZED SOURCE RESUME – NOT TAILORED',
  'jobMatch.generation.normalizedEducation': 'EDUCATION',
  'jobMatch.generation.normalizedExperience': 'EXPERIENCE',
  'jobMatch.generation.normalizedExperienceFallback': 'Experience',
  'jobMatch.generation.normalizedLanguages': 'LANGUAGES',
  'jobMatch.generation.normalizedProjects': 'PROJECTS',
  'jobMatch.generation.normalizedSkills': 'SKILLS',
})

const frenchTranslate = createTranslate({
  'jobMatch.generation.contact.email': 'E-mail',
  'jobMatch.generation.normalizedAdditional': 'INFORMATIONS VÉRIFIÉES SUPPLÉMENTAIRES',
  'jobMatch.generation.normalizedCertifications': 'CERTIFICATIONS',
  'jobMatch.generation.normalizedContact': 'COORDONNÉES',
  'jobMatch.generation.normalizedDocumentTitle': 'CV SOURCE NORMALISÉ – NON ADAPTÉ',
  'jobMatch.generation.normalizedEducation': 'FORMATION',
  'jobMatch.generation.normalizedExperience': 'EXPÉRIENCE',
  'jobMatch.generation.normalizedExperienceFallback': 'Expérience',
  'jobMatch.generation.normalizedLanguages': 'LANGUES',
  'jobMatch.generation.normalizedProjects': 'PROJETS',
  'jobMatch.generation.normalizedSkills': 'COMPÉTENCES',
})

function createTranslate(translations: Readonly<Record<string, string>>): Localization['translate'] {
  return (key) => translations[key] ?? key
}

const sourceIntake = {
  candidateFacts: [{
    id: 'source-fact-enrichment',
    path: 'experiences.1.candidate-enrichment.0',
    status: 'attested',
    value: 'Mentored six engineers',
  }],
  contactDetails: [{ kind: 'email', value: 'candidate@example.com' }],
  criticalAmbiguities: [],
  originalContent: 'Original resume',
  sourceDocument: { kind: 'pasted-text', name: 'resume.txt' },
  sourceProfile: {
    certifications: [],
    education: [],
    experiences: [{
      achievements: ['Led the platform migration'],
      context: null,
      endDate: '2025',
      organization: 'Example Corp',
      role: 'Senior Engineer',
      startDate: '2021',
    }],
    languages: [],
    projects: [],
    skills: [{ category: 'Programming', name: 'TypeScript' }],
  },
} as const satisfies SourceIntake
