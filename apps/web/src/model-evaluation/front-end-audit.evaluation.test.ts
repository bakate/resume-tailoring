import { beforeAll, describe, expect, it } from 'vitest'
import { createJobMatch, type JobMatch } from '@resume-tailoring/application/job-match'
import { prepareResumeSections } from '@resume-tailoring/application/resume-preparation'
import { createSourceIntake, type SourceIntake } from '@resume-tailoring/application/source-intake'
import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'

import { createOpenAiJobMatchEvidenceMatcher } from '../adapters/server/openai-job-match-evidence-matcher'
import { createOpenAiJobPostingExtractor } from '../adapters/server/openai-job-posting-extractor'
import {
  createOpenAiResumeCoherenceChecker,
  createOpenAiResumeFieldValidator,
  createOpenAiResumeSectionWriter,
} from '../adapters/server/openai-resume-section-models'
import { createOpenAiStructuredSourceProfileExtractor } from '../adapters/server/openai-structured-source-profile-extractor'
import { validateServerEnvironment, type ServerEnvironment } from '../env'
import { frontEndAuditJobPosting, frontEndAuditResume } from './front-end-audit-corpus'

// Live replay of the audited front-end run (BAK-139): the Source Document and Job Posting go through the production
// extraction, Match Analysis and section-by-section preparation, then each defect the audit saw is one case.
describe('audited front-end run, replayed live', () => {
  let run: AuditRun

  beforeAll(async () => {
    run = await replayAuditRun({ environment: readServerEnvironment() })
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

  it('keeps the education year the Source Document gives', () => {
    const education = run.documents.fr.sections.flatMap((section) => section.section === 'education' ? section.fields : [])

    expect(education.map(({ text }) => text).join(' ')).toContain('2018')
  })
})

type AuditRun = Readonly<{
  jobMatch: JobMatch
  documents: Readonly<Record<'fr' | 'en', ProfessionalResumeDocument>>
  report: unknown
}>

async function replayAuditRun({ environment }: Readonly<{ environment: ServerEnvironment }>): Promise<AuditRun> {
  const structured = { apiKey: { source: 'operator', value: environment.openAiApiKey } as const, model: environment.openAiStructuredModel,
    reasoningEffort: environment.openAiStructuredReasoningEffort }
  const sourceIntake = await readSourceIntake({ structured })
  const jobMatchResult = await createJobMatch({
    candidateFacts: sourceIntake.candidateFacts,
    document: { bytes: new TextEncoder().encode(frontEndAuditJobPosting), mediaType: 'text/plain', name: 'pasted-job-posting.txt' },
    jobPostingDocumentReader: { read: () => Promise.resolve({ ok: true, value: { text: frontEndAuditJobPosting } }) },
    jobPostingExtractor: createOpenAiJobPostingExtractor(structured),
    matchEvidenceMatcher: createOpenAiJobMatchEvidenceMatcher(structured),
    now: Date.now,
  })
  if (!jobMatchResult.ok) throw new Error(`Job Match failed: ${jobMatchResult.error}`)
  const jobMatch = jobMatchResult.value
  const [fr, en] = await Promise.all((['fr', 'en'] as const).map(async (locale) => {
    const models = createSectionModels({ environment, structured })
    // The last coherence verdict and the document it judged explain a failed preparation.
    let lastCoherence: unknown = null
    const output = await prepareResumeSections({ now: Date.now, recordTelemetry: () => undefined,
      models: { ...models, checkCoherence: async (input) => {
        const result = await models.checkCoherence(input)
        lastCoherence = { result, document: input.document }
        return result
      } },
      request: { candidateFacts: sourceIntake.candidateFacts, jobMatch, locale, purpose: 'tailored' },
      revision: `front-end-audit:${locale}` })
    if (output.status !== 'prepared') {
      throw new Error(`The ${locale} preparation failed: ${output.reason} ${JSON.stringify(lastCoherence)}`)
    }
    return output.document
  }))
  if (fr === undefined || en === undefined) throw new Error('Both preparations must finish')
  return { jobMatch, documents: { fr, en }, report: {
    requirements: jobMatch.requirements.map(({ id, value }) => ({ id, value,
      coverage: readCoverage({ jobMatch, requirement: new RegExp(escapeRegExp(value), 'u') }) })),
    headline: fr.headline?.text ?? null, targetRole: jobMatch.targetRole?.value ?? null,
    valueProposition: { fr: fr.valueProposition.paragraphs.map(({ text }) => text),
      en: en.valueProposition.paragraphs.map(({ text }) => text) },
    roles: fr.experiences.map(({ role }) => role?.text ?? null),
    skills: fr.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])
      .map(({ category, items }) => [category?.text ?? null, items.map(({ text }) => text)]),
    education: fr.sections.flatMap((section) => section.section === 'education' ? section.fields : []).map(({ text }) => text),
  } }
}

async function readSourceIntake({ structured }: Readonly<{ structured: Parameters<typeof createOpenAiStructuredSourceProfileExtractor>[0] }>):
Promise<SourceIntake> {
  const result = await createSourceIntake({
    document: { bytes: new TextEncoder().encode(frontEndAuditResume), mediaType: 'text/plain', name: 'pasted-resume.txt' },
    sourceDocumentReader: { read: () => Promise.resolve({ ok: true, value: { pageCount: null, text: frontEndAuditResume } }) },
    sourceProfileExtractor: createOpenAiStructuredSourceProfileExtractor(structured),
  })
  if (!result.ok) throw new Error(`Source Intake failed: ${result.error}`)
  return result.value
}

/** The configured roles the section routes use: writing for sections, structured for validation and coherence. */
function createSectionModels({ environment, structured }: Readonly<{
  environment: ServerEnvironment; structured: Parameters<typeof createOpenAiResumeSectionWriter>[0]
}>) {
  const writer = createOpenAiResumeSectionWriter({ apiKey: { source: 'operator', value: environment.openAiApiKey } as const, model: environment.openAiWritingModel,
    reasoningEffort: environment.openAiWritingReasoningEffort })
  const validator = createOpenAiResumeFieldValidator(structured)
  return { writeSection: writer.write, validateFields: validator.validate,
    checkCoherence: createOpenAiResumeCoherenceChecker(structured).check }
}

function readCoverage({ jobMatch, requirement }: Readonly<{ jobMatch: JobMatch; requirement: RegExp }>) {
  const ids = new Set<string>(jobMatch.requirements.filter(({ value }) => requirement.test(value)).map(({ id }) => id))
  expect(ids.size, `No Job Requirement matches ${String(requirement)}`).toBeGreaterThan(0)
  const coverages = jobMatch.analysis.requirementGroups
    .filter(({ requirementIds }) => requirementIds.some((id) => ids.has(id))).map(({ coverage }) => coverage)
  return coverages.includes('covered') ? 'covered' : coverages[0] ?? 'uncovered'
}

function readServerEnvironment() {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('OPENAI_API_KEY must be configured for live evaluation')
  return environment.value
}

function fold(value: string) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr')
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

const personalPronouns = {
  fr: /(?:^|[^\p{L}])(?:(?:il|elle|ils|elles|je|nous)(?![\p{L}])|j['’])/iu,
  en: /\b(?:he|she|his|her|hers|him|i|me|my|we|our)\b/iu,
} as const
const contractTypePattern = /(?:^|[^\p{L}])(?:cdi|cdd|freelance|free-lance|intérim|interim|alternance|apprentissage|stage|internship)(?![\p{L}])/iu
