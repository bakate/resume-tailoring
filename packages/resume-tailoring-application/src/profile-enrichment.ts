import type { JobMatch, JobRequirementId } from '@resume-tailoring/domain/job-match'
import type { CandidateFact } from '@resume-tailoring/domain/source-intake'

import type { ProfileEnrichmentFactKind } from './job-match'

export type ProfileEnrichmentValidationFailure =
  | 'candidate-fact-duplicate'
  | 'candidate-fact-invalid'
  | 'profile-enrichment-unavailable'

type ProfileEnrichmentRequest = Readonly<{
  candidateFacts: readonly CandidateFact[]
  jobMatch: JobMatch
  kind: ProfileEnrichmentFactKind
  requirementId: JobRequirementId
  value: string
}>

export function createProfileEnrichment({
  candidateFacts, jobMatch, kind, requirementId, value: untrimmedValue,
}: ProfileEnrichmentRequest): Readonly<{ ok: true; value: CandidateFact }>
  | Readonly<{ ok: false; error: ProfileEnrichmentValidationFailure }> {
  const value = untrimmedValue.trim()
  if (value.length === 0) return { ok: false, error: 'candidate-fact-invalid' }
  if (!canEnrichRequirement({ jobMatch, requirementId })) return unavailableResult
  if (hasDuplicateCandidateFact({ candidateFacts, value })) {
    return { ok: false, error: 'candidate-fact-duplicate' }
  }
  return { ok: true, value: createCandidateFact({ candidateFacts, kind, value }) }
}

function canEnrichRequirement({ jobMatch, requirementId }: Readonly<{
  jobMatch: JobMatch
  requirementId: JobRequirementId
}>) {
  const requirement = jobMatch.requirements.find(({ id }) => id === requirementId)
  const group = jobMatch.analysis.requirementGroups.find(({ requirementIds }) =>
    requirementIds.includes(requirementId))
  return requirement !== undefined && requirement.importance !== 'complementary'
    && group !== undefined && group.coverage !== 'covered'
}

function hasDuplicateCandidateFact({ candidateFacts, value }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  value: string
}>) {
  const normalizedValue = normalizeCandidateFactValue(value)
  return candidateFacts.some((candidateFact) => candidateFact.status === 'attested'
    && normalizeCandidateFactValue(candidateFact.value) === normalizedValue)
}

function normalizeCandidateFactValue(value: string) {
  return value.trim().toLocaleLowerCase('en').replaceAll(/\s+/gu, ' ')
}

function createCandidateFact({ candidateFacts, kind, value }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  kind: ProfileEnrichmentFactKind
  value: string
}>): CandidateFact {
  const section = profileEnrichmentSections[kind]
  const nextIndex = readNextSectionIndex({ candidateFacts, section })
  const path = `${section}.${String(nextIndex)}.candidate-enrichment.0`
  return { id: `source-fact-${path.replaceAll('.', '-')}`, path, status: 'attested', value }
}

function readNextSectionIndex({ candidateFacts, section }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  section: string
}>) {
  const indexes = candidateFacts.flatMap(({ path }) => {
    const [candidateSection, indexText] = path.split('.')
    const index = Number(indexText)
    return candidateSection === section && Number.isInteger(index) ? [index] : []
  })
  return indexes.length === 0 ? 0 : Math.max(...indexes) + 1
}

const profileEnrichmentSections = {
  certification: 'certifications', education: 'education', experience: 'experiences',
  language: 'languages', project: 'projects', skill: 'skills',
} as const satisfies Readonly<Record<ProfileEnrichmentFactKind, string>>

const unavailableResult = { ok: false, error: 'profile-enrichment-unavailable' } as const
