import { beforeAll, describe, expect, it } from 'vitest'
import type { JobMatch } from '@resume-tailoring/application/job-match'

import { validateServerEnvironment } from '../env'
import { checkDocumentLanguage } from './document-language'
import { readAuditedCoverage, replayAuditRun, type AuditRun } from './front-end-audit-evaluation'
import { countUnsupportedResumeClaims } from './unsupported-resume-claims'

// Live replay of the audited front-end run (BAK-139): the Source Document and Job Posting go through the production
// extraction, Match Analysis and section-by-section preparation, then each defect the audit saw is one case.
// The same run feeds the qualification runner (`front-end-audit` source).
describe('audited front-end run, replayed live', () => {
  let run: AuditRun

  beforeAll(async () => {
    const { languageModel } = readServerEnvironment()
    const apiKey = { value: languageModel.apiKey } as const
    const roles = { structured: { apiKey, configuration: languageModel.structured.active },
      writing: { apiKey, configuration: languageModel.writing.active } }
    run = await replayAuditRun({ intake: roles.structured, preparations: { fr: roles, en: roles } })
    console.info(JSON.stringify(run.report))
  }, 900_000)

  it('covers the unit and end-to-end testing requirement with the testing tools the Candidate lists', () => {
    expect(readCoverage({ jobMatch: run.jobMatch, requirement: /tests unitaires/iu })).toBe('covered')
  })

  it('covers the three-year React requirement from the dated experiences that use React', () => {
    expect(readCoverage({ jobMatch: run.jobMatch, requirement: /3 ans/iu })).toBe('covered')
  })

  // A resume is written without pronouns: neither "elle a développé" nor "j'ai développé".
  it.each(['fr', 'en'] as const)('writes the %s Value Proposition without a personal pronoun', (locale) => {
    const paragraphs = run.documents[locale].valueProposition.paragraphs.map(({ text }) => text).join(' ')

    expect(paragraphs.length).toBeGreaterThan(0)
    expect(paragraphs).not.toMatch(personalPronouns[locale])
  })

  it('heads the resume with a title agreeing with the Candidate\'s own, never the masculine Target Role', () => {
    const { fr } = run.documents
    const headline = fr.headline?.text ?? fr.targetRole?.value ?? ''

    expect(headline).toMatch(/développeuse/iu)
    expect(headline).not.toMatch(/développeur\b/iu)
  })

  it('keeps the contract type out of every job title', () => {
    const roles = run.documents.fr.experiences.flatMap(({ role }) => role === null ? [] : [role.text])

    expect(roles.length).toBeGreaterThan(0)
    expect(roles.filter((role) => contractTypePattern.test(role))).toEqual([])
  })

  it('never names a skills group after its only item', () => {
    const groups = run.documents.fr.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])

    expect(groups.length).toBeGreaterThan(0)
    expect(groups.filter(({ category, items }) => category !== null && items.length === 1
      && fold(items[0]?.text ?? '').includes(fold(category.text))).map(({ category }) => category?.text)).toEqual([])
  })

  it.each(['fr', 'en'] as const)('writes the %s document without an unsupported Resume Claim', (locale) => {
    expect(countUnsupportedResumeClaims({ candidateFacts: run.candidateFacts, document: run.documents[locale] })).toBe(0)
  })

  it.each(['fr', 'en'] as const)('writes every prose field of the %s document in its language', (locale) => {
    expect(checkDocumentLanguage({ document: run.documents[locale], locale }).filter(({ passed }) => !passed)).toEqual([])
  })

  it('keeps the education year the Source Document gives', () => {
    const education = run.documents.fr.sections.flatMap((section) => section.section === 'education' ? section.fields : [])

    expect(education.map(({ text }) => text).join(' ')).toContain('2018')
  })
})

function readCoverage({ jobMatch, requirement }: Readonly<{ jobMatch: JobMatch; requirement: RegExp }>) {
  const coverage = readAuditedCoverage({ jobMatch, requirement })
  expect(coverage, `No Job Requirement matches ${String(requirement)}`).not.toBeNull()
  return coverage
}

function readServerEnvironment() {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('A Language Model Provider key must be configured for live evaluation')
  return environment.value
}

function fold(value: string) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr')
}


const personalPronouns = {
  fr: /(?:^|[^\p{L}])(?:(?:il|elle|ils|elles|je|nous)(?![\p{L}])|j['’])/iu,
  en: /\b(?:he|she|his|her|hers|him|i|me|my|we|our)\b/iu,
} as const
const contractTypePattern = /(?:^|[^\p{L}])(?:cdi|cdd|freelance|free-lance|intérim|interim|alternance|apprentissage|stage|internship)(?![\p{L}])/iu
