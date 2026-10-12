import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'
import { validateProposedResumeClaim } from '@resume-tailoring/application/resume-claims'
import { readExperienceFields, readSectionFields } from '@resume-tailoring/application/tailored-resume'
import type { TailoredResumeField } from '@resume-tailoring/application/tailored-resume'

type CandidateFact = Readonly<{ id: string; value: string }>

/**
 * Unsupported Resume Claims of a document: professional fields citing no Candidate Fact or an unknown one, and fields
 * the field validator rejected that still reached the document. Each field counts once, whatever made it unsupported.
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

/** Fields whose text and cited Candidate Facts the application claim validator refuses. */
export function findUnsupportedResumeFieldIds({ candidateFacts, document }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  document: ProfessionalResumeDocument
}>) {
  const verifiedFacts = candidateFacts.map(({ id, value }) => ({ id: toCandidateFactId(id), value }))
  return readProfessionalFields({ document }).filter((field) => !validateProposedResumeClaim({
    claimId: `resume-claim-${field.id}`, proposal: { segments: [{ text: field.text, factIds: field.factIds }] }, verifiedFacts,
  }).ok).map(({ id }) => id)
}

function readProfessionalFields({ document }: Readonly<{ document: ProfessionalResumeDocument }>): readonly TailoredResumeField[] {
  return [...document.valueProposition.paragraphs,
    ...document.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...document.sections.flatMap((section) => readSectionFields({ section }))]
}

function toCandidateFactId(id: string) {
  return id.startsWith('source-fact-') ? id as `source-fact-${string}` : `source-fact-${id}` as const
}
