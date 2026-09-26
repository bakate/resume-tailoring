import type {
  JobRequirement,
  MatchAnalysis,
  MatchEvidence,
  SourceProfileFact,
} from '@resume-tailoring/domain/resume-tailoring-state'

export const generationThreshold = 50

export function createMatchAnalysis({
  proposedEvidence,
  requirements,
  verifiedFacts,
}: Readonly<{
  proposedEvidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>): MatchAnalysis | null {
  if (!hasValidEvidence({ proposedEvidence, requirements, verifiedFacts })) return null
  const coveredRequirementIds = new Set(proposedEvidence.map(({ requirementId }) => requirementId))
  const matchScore = calculateMatchScore({ coveredRequirementIds, requirements })
  return {
    evidence: proposedEvidence,
    gapAnalysis: {
      uncoveredRequiredRequirementIds: findUncoveredRequiredRequirementIds({
        coveredRequirementIds,
        requirements,
      }),
    },
    generationEligibility: proposedEvidence.length > 0 ? 'eligible' : 'denied',
    matchScore,
    warning: matchScore < generationThreshold ? 'below-generation-threshold' : null,
  }
}

function findUncoveredRequiredRequirementIds({
  coveredRequirementIds,
  requirements,
}: Readonly<{
  coveredRequirementIds: ReadonlySet<string>
  requirements: readonly JobRequirement[]
}>) {
  return requirements
    .filter((requirement) => requirement.classification === 'required'
      && !coveredRequirementIds.has(requirement.id))
    .map(({ id }) => id)
}

function hasValidEvidence({
  proposedEvidence,
  requirements,
  verifiedFacts,
}: Readonly<{
  proposedEvidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>) {
  const requirementIds = new Set(requirements.map(({ id }) => id))
  const verifiedFactIds = new Set(verifiedFacts.map(({ id }) => id))
  const referencedRequirementIds = new Set<string>()
  return proposedEvidence.every((evidence) => {
    if (referencedRequirementIds.has(evidence.requirementId)) return false
    referencedRequirementIds.add(evidence.requirementId)
    return requirementIds.has(evidence.requirementId)
      && evidence.factIds.length > 0
      && new Set(evidence.factIds).size === evidence.factIds.length
      && evidence.factIds.every((factId) => verifiedFactIds.has(factId))
  })
}

function calculateMatchScore({
  coveredRequirementIds,
  requirements,
}: Readonly<{
  coveredRequirementIds: ReadonlySet<string>
  requirements: readonly JobRequirement[]
}>) {
  const totalWeight = requirements.reduce(sumRequirementWeight, 0)
  if (totalWeight === 0) return 0
  const coveredWeight = requirements
    .filter(({ id }) => coveredRequirementIds.has(id))
    .reduce(sumRequirementWeight, 0)
  return Math.round((coveredWeight / totalWeight) * 100)
}

function sumRequirementWeight(total: number, requirement: JobRequirement) {
  return total + (requirement.classification === 'required' ? 2 : 1)
}
