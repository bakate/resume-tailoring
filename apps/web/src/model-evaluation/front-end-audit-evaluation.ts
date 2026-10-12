import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'
import type { JobMatch } from '@resume-tailoring/application/job-match'
import { prepareResumeSections } from '@resume-tailoring/application/resume-preparation'
import type { SourceIntake } from '@resume-tailoring/application/source-intake'

import type { ModelConnection } from '../adapters/server/language-model-request'
import type { ModelRole } from '../language-model-configuration'
import { checkDocumentLanguage } from './document-language'
import { frontEndAuditJobPosting, frontEndAuditResume } from './front-end-audit-corpus'
import { readLiveJobMatch, readLiveSourceIntake } from './live-candidate-journey'
import type { ModelTokenUsage } from './model-qualification'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'
import { createSectionModels } from './section-preparation-evaluation'
import { countUnsupportedResumeClaims } from './unsupported-resume-claims'

export type AuditRun = Readonly<{
  candidateFacts: SourceIntake['candidateFacts']
  jobMatch: JobMatch
  documents: Readonly<Record<'fr' | 'en', ProfessionalResumeDocument>>
  report: unknown
}>

/** The Job Requirements the audit saw left uncovered although the Candidate's listed tools and dated work cover them. */
export const auditedCoverage = [
  { name: 'unit and end-to-end testing', requirement: /tests unitaires/iu },
  { name: 'three years of React', requirement: /3 ans/iu },
] as const

type AuditLocale = 'fr' | 'en'
type RoleConnections = Readonly<{ structured: ModelConnection; writing: ModelConnection }>

/**
 * Replays the audited front-end run (BAK-139): the Source Document and Job Posting go through the production
 * extraction and Match Analysis once, then section-by-section preparation in French and in English, each on the
 * connections given for it.
 */
export async function replayAuditRun({ intake, preparations }: Readonly<{
  intake: ModelConnection
  preparations: Readonly<Record<AuditLocale, RoleConnections>>
}>): Promise<AuditRun> {
  const sourceIntake = await readLiveSourceIntake({ resume: frontEndAuditResume, structured: intake })
  const jobMatch = await readLiveJobMatch({ candidateFacts: sourceIntake.candidateFacts, jobPosting: frontEndAuditJobPosting,
    structured: intake })
  const [fr, en] = await Promise.all((['fr', 'en'] as const).map(async (locale) => {
    const models = createSectionModels(preparations[locale])
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
  return { candidateFacts: sourceIntake.candidateFacts, jobMatch, documents: { fr, en }, report: {
    requirements: jobMatch.requirements.map(({ id, value }) => ({ id, value,
      coverage: readAuditedCoverage({ jobMatch, requirement: new RegExp(escapeRegExp(value), 'u') }) })),
    headline: fr.headline?.text ?? null, targetRole: jobMatch.targetRole?.value ?? null,
    valueProposition: { fr: fr.valueProposition.paragraphs.map(({ text }) => text),
      en: en.valueProposition.paragraphs.map(({ text }) => text) },
    roles: fr.experiences.map(({ role }) => role?.text ?? null),
    skills: fr.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])
      .map(({ category, items }) => [category?.text ?? null, items.map(({ text }) => text)]),
    education: fr.sections.flatMap((section) => section.section === 'education' ? section.fields : []).map(({ text }) => text),
  } }
}

/** The best coverage of the Job Requirements a pattern names, or null when none does. */
export function readAuditedCoverage({ jobMatch, requirement }: Readonly<{ jobMatch: JobMatch; requirement: RegExp }>) {
  const ids = new Set<string>(jobMatch.requirements.filter(({ value }) => requirement.test(value)).map(({ id }) => id))
  if (ids.size === 0) return null
  const coverages = jobMatch.analysis.requirementGroups
    .filter(({ requirementIds }) => requirementIds.some((id) => ids.has(id))).map(({ coverage }) => coverage)
  return coverages.includes('covered') ? 'covered' : coverages[0] ?? 'uncovered'
}

/**
 * The one whole Tailored Resume the dataset measures, twice: the French and the English document each cost the shared
 * intake and Job Match plus their own preparation. Each document must be written in its language, with no unsupported
 * Resume Claim against the Candidate Facts the run extracted; the audited requirements must be covered. A preparation
 * that fails throws, which fails the recording.
 */
export const frontEndAuditSource: ModelObservationSource = {
  id: 'front-end-audit',
  roles: ['structured', 'writing'],
  observe: async ({ trackUsage }) => {
    const intake = trackUsage()
    const preparations = { fr: trackUsage(), en: trackUsage() }
    const run = await replayAuditRun({ intake: intake.connect('structured'), preparations: {
      fr: { structured: preparations.fr.connect('structured'), writing: preparations.fr.connect('writing') },
      en: { structured: preparations.en.connect('structured'), writing: preparations.en.connect('writing') },
    } })
    const covered = auditedCoverage.filter(({ requirement }) =>
      readAuditedCoverage({ jobMatch: run.jobMatch, requirement }) === 'covered')
    return [
      createModelEvaluationObservation({ fixtureId: 'audited-coverage', extractionExpectedCount: auditedCoverage.length,
        extractionMatchedCount: covered.length, observedValues: auditedCoverage.filter((audited) => !covered.includes(audited))
          .map(({ name }) => `uncovered:${name}`) }),
      ...(['fr', 'en'] as const).map((locale) => {
        const language = checkDocumentLanguage({ document: run.documents[locale], locale })
        return createModelEvaluationObservation({ fixtureId: `tailored-resume-${locale}`,
          multilingualCheckCount: language.length, multilingualPassedCount: language.filter(({ passed }) => passed).length,
          observedValues: language.filter(({ passed }) => !passed).map(({ name }) => `failed:${name}`),
          tailoredResumeUsage: addUsage(intake.readUsage(), preparations[locale].readUsage()),
          unsupportedResumeClaimCount: countUnsupportedResumeClaims({ candidateFacts: run.candidateFacts,
            document: run.documents[locale] }) })
      }),
    ]
  },
}

function addUsage(...usages: readonly Readonly<Record<ModelRole, ModelTokenUsage>>[]) {
  const add = (role: ModelRole) => ({ inputTokens: usages.reduce((total, usage) => total + usage[role].inputTokens, 0),
    outputTokens: usages.reduce((total, usage) => total + usage[role].outputTokens, 0) })
  return { structured: add('structured'), writing: add('writing') }
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
