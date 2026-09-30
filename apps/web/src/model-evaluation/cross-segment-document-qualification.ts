import type { ResumeRenderRequest, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import { validateProposedResumeClaim } from '@resume-tailoring/application/resume-claims'
import { readExperienceFields, readSectionFields } from '@resume-tailoring/application/tailored-resume'
import type { TailoredResume, TailoredResumeField } from '@resume-tailoring/application/tailored-resume'

import {
  qualificationRoleFamilies,
  type QualificationCorpus,
  type QualificationFixture,
  type QualificationGate,
  type QualificationRoleFamily,
  type QualificationSplit,
} from './cross-segment-qualification'

export type DocumentQualificationThresholds = Readonly<{
  pdfExportValidity: number
  provenanceSafety: number
}>

export const crossSegmentDocumentQualificationThresholds = {
  pdfExportValidity: 1,
  provenanceSafety: 1,
} as const satisfies DocumentQualificationThresholds

export type DocumentQualificationOutcome = Readonly<{
  fixtureId: string
  language: QualificationFixture['language']
  pageCount: number | null
  purpose: TailoredResume['purpose']
  roleFamily: QualificationRoleFamily
  exportBlockers: readonly string[]
  unsupportedFieldIds: readonly string[]
}>

type DocumentGates = Readonly<Record<keyof DocumentQualificationThresholds, QualificationGate>>

export type DocumentQualificationReport = Readonly<{
  corpusId: string
  outcomes: readonly DocumentQualificationOutcome[]
  overall: DocumentGates
  passed: boolean
  roleFamilies: Readonly<Record<QualificationRoleFamily, DocumentGates>>
  split: QualificationSplit
}>

/**
 * Renders one reference document per scenario through the production PDF renderer and checks every
 * professional field against the scenario's Candidate Facts with the application claim validator.
 * Writing quality is not measured here: live writer output and human document review cover it.
 */
export async function qualifyCrossSegmentDocuments({ corpus, renderDocument, split,
  thresholds = crossSegmentDocumentQualificationThresholds }: Readonly<{
  corpus: QualificationCorpus
  renderDocument: (request: ResumeRenderRequest) => Promise<ResumeRenderResult>
  split: QualificationSplit
  thresholds?: DocumentQualificationThresholds
}>): Promise<DocumentQualificationReport> {
  const outcomes: DocumentQualificationOutcome[] = []
  for (const fixture of corpus.fixtures.filter((candidate) => candidate.split === split)) {
    outcomes.push(await qualifyFixtureDocument({ fixture, renderDocument }))
  }
  const overall = createDocumentGates({ outcomes, thresholds })
  const roleFamilies = Object.fromEntries(qualificationRoleFamilies.map((roleFamily) => [roleFamily,
    createDocumentGates({ outcomes: outcomes.filter((outcome) => outcome.roleFamily === roleFamily), thresholds })],
  )) as DocumentQualificationReport['roleFamilies']
  return { corpusId: corpus.id, outcomes, overall, roleFamilies, split,
    passed: [overall, ...Object.values(roleFamilies)].every((gates) => Object.values(gates).every(({ passed }) => passed)) }
}

export function createQualificationResume({ fixture }: Readonly<{ fixture: QualificationFixture }>): TailoredResume {
  const facts = fixture.candidateFacts.map((fact) => ({ ...fact, id: toCandidateFactId(fact.id) }))
  const relevantFactIds = new Set(fixture.relevantFactIds.map(toCandidateFactId))
  const relevant = facts.filter(({ id }) => relevantFactIds.has(id))
  const field = (fact: typeof facts[number]) => ({ id: `field-${fact.id}`, text: fact.value, factIds: [fact.id] })
  const experiences = facts.filter(({ kind }) => kind === 'experience')
  const skills = facts.filter(({ kind }) => kind === 'skill')
  return {
    purpose: relevant.length > 0 ? 'tailored' : 'normalized', locale: fixture.language, targetRole: null,
    identity: { kind: 'personal-information', value: 'Qualification Candidate' },
    contactDetails: [{ kind: 'email', value: 'candidate@example.com' }],
    valueProposition: relevant.length > 0
      ? { kind: 'prose', paragraphs: [{ id: 'summary', text: relevant.map(({ value }) => value).join(' '),
        factIds: relevant.map(({ id }) => id) }] }
      : { kind: 'evidence-excerpts', paragraphs: [] },
    experiences: experiences.length === 0 ? [] : [{ id: 'experiences.0', chronology: 'relevant', role: null,
      organization: null, startDate: null, endDate: null, context: null, achievements: experiences.map(field) }],
    sections: [
      ...(skills.length === 0 ? [] : [{ section: 'skills' as const, groups: [{ id: 'skills.0', category: null, items: skills.map(field) }] }]),
      ...(['education', 'languages', 'projects', 'certifications'] as const).flatMap((section) => {
        const sectionFacts = facts.filter(({ kind }) => sectionKinds[section] === kind)
        return sectionFacts.length === 0 ? [] : [{ section, fields: sectionFacts.map(field) }]
      }),
    ],
  }
}

async function qualifyFixtureDocument({ fixture, renderDocument }: Readonly<{
  fixture: QualificationFixture
  renderDocument: (request: ResumeRenderRequest) => Promise<ResumeRenderResult>
}>): Promise<DocumentQualificationOutcome> {
  const document = createQualificationResume({ fixture })
  const unsupportedFieldIds = findUnsupportedFields({ document, fixture })
  const result = await renderDocument({ draft: { document, revision: `qualification:${fixture.id}` }, unsupportedFieldIds })
  const eligibility = result.assessment.exportEligibility
  return {
    fixtureId: fixture.id, language: fixture.language, purpose: document.purpose, roleFamily: fixture.roleFamily,
    pageCount: result.assessment.layout.status === 'unavailable' ? null : result.assessment.layout.pageCount,
    exportBlockers: eligibility.status === 'eligible' && result.pdf !== null ? [] : eligibility.status === 'blocked'
      ? eligibility.reasons : ['missing-pdf'],
    unsupportedFieldIds,
  }
}

export function findUnsupportedFields({ document, fixture }: Readonly<{
  document: TailoredResume; fixture: QualificationFixture
}>) {
  const verifiedFacts = fixture.candidateFacts.map(({ id, value }) => ({ id: toCandidateFactId(id), value }))
  return readProfessionalFields({ document }).filter((field) => !validateProposedResumeClaim({
    claimId: `resume-claim-${field.id}`, proposal: { segments: [{ text: field.text, factIds: field.factIds }] }, verifiedFacts,
  }).ok).map(({ id }) => id)
}

function readProfessionalFields({ document }: Readonly<{ document: TailoredResume }>): readonly TailoredResumeField[] {
  return [...document.valueProposition.paragraphs,
    ...document.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...document.sections.flatMap((section) => readSectionFields({ section }))]
}

function createDocumentGates({ outcomes, thresholds }: Readonly<{
  outcomes: readonly DocumentQualificationOutcome[]; thresholds: DocumentQualificationThresholds
}>): DocumentGates {
  return {
    pdfExportValidity: createGate({ threshold: thresholds.pdfExportValidity,
      value: rate(outcomes.map(({ exportBlockers }) => exportBlockers.length === 0)) }),
    provenanceSafety: createGate({ threshold: thresholds.provenanceSafety,
      value: rate(outcomes.map(({ unsupportedFieldIds }) => unsupportedFieldIds.length === 0)) }),
  }
}

function createGate({ threshold, value }: Readonly<{ threshold: number; value: number }>): QualificationGate {
  return { passed: value >= threshold, threshold, value }
}

function rate(values: readonly boolean[]) {
  return values.length === 0 ? 0 : values.filter(Boolean).length / values.length
}

function toCandidateFactId(id: string) { return id.startsWith('source-fact-') ? id as `source-fact-${string}` : `source-fact-${id}` as const }

const sectionKinds = { education: 'education', languages: 'language', projects: 'project', certifications: 'certification' } as const
