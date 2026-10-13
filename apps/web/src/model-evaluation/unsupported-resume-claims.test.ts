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

  it.each([
    { label: 'alone', text: 'Licence professionnelle Développement Web, Université de Lille, 2018' },
    { label: 'followed by its translation',
      text: 'Licence professionnelle Développement Web (professional degree in web development), Université de Lille, 2018' },
    { label: 'with other case and punctuation', text: 'LICENCE PROFESSIONNELLE – DEVELOPPEMENT WEB, Université de Lille' },
  ])('counts nothing for an education entry keeping its qualification\'s own name $label', ({ text }) => {
    const document = createDocument({ sections: [{ section: 'education', fields: [qualificationField(text)] }] })

    const count = countUnsupportedResumeClaims({ candidateFacts: qualificationFacts, document })

    expect(count).toBe(0)
  })

  it('counts an education entry that renames its qualification into an equivalent level', () => {
    const document = createDocument({ sections: [{ section: 'education',
      fields: [qualificationField('Professional Bachelor\'s Degree in Web Development, Université de Lille, 2018')] }] })

    const count = countUnsupportedResumeClaims({ candidateFacts: qualificationFacts, document })

    expect(count).toBe(1)
  })

  it('counts a certification that renames its official name', () => {
    const document = createDocument({ sections: [{ section: 'certifications', fields: [{ id: 'certification',
      text: 'Certification Architecte Solutions AWS – Professionnel', factIds: ['source-fact-certifications-0-name-0'] }] }] })

    const count = countUnsupportedResumeClaims({ candidateFacts: certificationFacts, document })

    expect(count).toBe(1)
  })

  it('counts nothing for a Value Proposition paragraph describing a qualification it cites', () => {
    const document = createDocument({ paragraphs: [{ id: 'paragraph', text: 'Front-end developer with a web development degree',
      factIds: ['source-fact-education-0-qualification-0'] }] })

    const count = countUnsupportedResumeClaims({ candidateFacts: qualificationFacts, document })

    expect(count).toBe(0)
  })

  it('counts a field the field validator rejected that still reached the document, once', () => {
    const document = createDocument({})
    const rejectedFieldIds = ['achievement', 'achievement', 'field-not-in-the-document']

    const count = countUnsupportedResumeClaims({ candidateFacts, document, rejectedFieldIds })

    expect(count).toBe(1)
  })
})

const candidateFacts = [{ id: 'source-fact-billing', kind: 'experience', value: 'Built a billing platform' }] as const

const qualificationFacts = [
  ...candidateFacts,
  { id: 'source-fact-education-0-qualification-0', path: 'education.0.qualification.0',
    value: 'Licence professionnelle Développement Web' },
  { id: 'source-fact-education-0-institution-0', path: 'education.0.institution.0', value: 'Université de Lille' },
  { id: 'source-fact-education-0-dates-0', path: 'education.0.dates.0', value: '2018' },
] as const

const certificationFacts = [
  ...candidateFacts,
  { id: 'source-fact-certifications-0-name-0', path: 'certifications.0.name.0',
    value: 'AWS Certified Solutions Architect – Professional' },
] as const

function qualificationField(text: string) {
  return { id: 'education', text, factIds: ['source-fact-education-0-qualification-0',
    'source-fact-education-0-institution-0', 'source-fact-education-0-dates-0'] as const }
}

function createDocument({
  achievements = [{ id: 'achievement', text: 'Built a billing platform', factIds: ['source-fact-billing'] }],
  paragraphs = [],
  sections = [],
}: Readonly<{
  achievements?: ProfessionalResumeDocument['experiences'][number]['achievements']
  paragraphs?: ProfessionalResumeDocument['valueProposition']['paragraphs']
  sections?: ProfessionalResumeDocument['sections']
}>): ProfessionalResumeDocument {
  return {
    purpose: 'tailored', locale: 'en', targetRole: null,
    valueProposition: { kind: 'prose', paragraphs },
    experiences: [{ id: 'experiences.0', chronology: 'relevant', role: null, organization: null, startDate: null,
      endDate: null, context: null, achievements }],
    sections,
  }
}
