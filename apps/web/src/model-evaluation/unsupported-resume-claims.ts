import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'
import { validateProposedResumeClaim } from '@resume-tailoring/application/resume-claims'
import { readExperienceFields, readSectionFields } from '@resume-tailoring/application/tailored-resume'
import type { TailoredResumeField } from '@resume-tailoring/application/tailored-resume'

/** A Candidate Fact, with the Source Profile path a Source Intake attests it at when the source gives one. */
type CandidateFact = Readonly<{ id: string; path?: string; value: string }>

/**
 * Unsupported Resume Claims of a document: professional fields citing no Candidate Fact or an unknown one, education
 * and certification entries renaming the qualification they cite, and fields the field validator rejected that still
 * reached the document. Each field counts once, whatever made it unsupported.
 */
export function countUnsupportedResumeClaims({ candidateFacts, document, rejectedFieldIds = [] }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  document: ProfessionalResumeDocument
  rejectedFieldIds?: readonly string[]
}>) {
  const rejected = new Set(rejectedFieldIds)
  const unsupported = new Set(findUnsupportedResumeFieldIds({ candidateFacts, document }))
  return readProfessionalFields({ document }).filter(({ id }) => unsupported.has(id) || rejected.has(id)).length
}

/**
 * Fields whose text and cited Candidate Facts the application claim validator refuses, and education and certification
 * entries renaming the qualification they cite.
 */
export function findUnsupportedResumeFieldIds({ candidateFacts, document }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  document: ProfessionalResumeDocument
}>) {
  const verifiedFacts = candidateFacts.map(({ id, value }) => ({ id: toCandidateFactId(id), value }))
  const refused = readProfessionalFields({ document }).filter((field) => !validateProposedResumeClaim({
    claimId: `resume-claim-${field.id}`, proposal: { segments: [{ text: field.text, factIds: field.factIds }] }, verifiedFacts,
  }).ok).map(({ id }) => id)
  return [...new Set([...refused, ...findRenamedQualificationFieldIds({ candidateFacts, document })])]
}

/**
 * Education and certification entries that drop the official name of a qualification they cite: a translation may
 * follow that name, but an equivalent degree or level written in its place is a qualification the Candidate never
 * stated, such as "Professional Bachelor's Degree" for "Licence professionnelle".
 */
function findRenamedQualificationFieldIds({ candidateFacts, document }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  document: ProfessionalResumeDocument
}>) {
  const qualifications = new Map(candidateFacts.filter(({ path }) => path !== undefined && qualificationPath.test(path))
    .map(({ id, value }) => [toCandidateFactId(id), foldQualification(value)]))
  return document.sections.filter(({ section }) => section === 'education' || section === 'certifications')
    .flatMap((section) => readSectionFields({ section })).filter(({ factIds, text }) => factIds.some((factId) => {
      const name = qualifications.get(toCandidateFactId(factId))
      return name !== undefined && !foldQualification(text).includes(name)
    })).map(({ id }) => id)
}

/** The Source Profile paths holding a qualification's official name. */
const qualificationPath = /^(?:education\.\d+\.qualification|certifications\.\d+\.name)\.\d+$/u

/** A qualification name compared whatever its case, accents and punctuation. */
function foldQualification(value: string) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr')
    .replaceAll(/[^\p{Letter}\p{Number}]+/gu, ' ').trim()
}

export function readProfessionalFields({ document }: Readonly<{ document: ProfessionalResumeDocument }>): readonly TailoredResumeField[] {
  return [...document.valueProposition.paragraphs,
    ...document.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...document.sections.flatMap((section) => readSectionFields({ section }))]
}

function toCandidateFactId(id: string) {
  return id.startsWith('source-fact-') ? id as `source-fact-${string}` : `source-fact-${id}` as const
}
