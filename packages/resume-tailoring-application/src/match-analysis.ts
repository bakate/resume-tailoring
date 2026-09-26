import type {
  JobRequirement,
  MatchAnalysis,
  MatchEvidence,
  JobRequirementId,
  ProposedFactMatch,
  ProposedMatchEvidence,
  SourceProfileFact,
} from '@resume-tailoring/domain/resume-tailoring-state'

export const generationThreshold = 50

export function createMatchAnalysis({
  proposedEvidence,
  requirements,
  verifiedFacts,
}: Readonly<{
  proposedEvidence: readonly ProposedMatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>): MatchAnalysis | null {
  const evidence = validateMatchEvidence({ proposedEvidence, requirements, verifiedFacts })
  if (evidence === null) return null
  return createAnalysisFromEvidence({ evidence, requirements, verifiedFacts })
}

export function restoreMatchAnalysis({ evidence, requirements, verifiedFacts }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>): MatchAnalysis | null {
  if (!hasValidStoredEvidence({ evidence, requirements, verifiedFacts })) return null
  return createAnalysisFromEvidence({ evidence, requirements, verifiedFacts })
}

function createAnalysisFromEvidence({ evidence, requirements, verifiedFacts }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>): MatchAnalysis {
  const coveredRequirementIds = new Set(evidence.map(({ requirementId }) => requirementId))
  const matchScore = calculateMatchScore({ coveredRequirementIds, requirements })
  return {
    evidence,
    gapAnalysis: {
      uncoveredRequiredRequirementIds: findUncoveredRequiredRequirementIds({
        coveredRequirementIds,
        requirements,
      }),
    },
    generationEligibility: verifiedFacts.length > 0 ? 'eligible' : 'denied',
    matchScore,
    warning: matchScore < generationThreshold ? 'below-generation-threshold' : null,
  }
}

function hasValidStoredEvidence({ evidence, requirements, verifiedFacts }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>) {
  const requirementIds = new Set(requirements.map(({ id }) => id))
  const factIds = new Set(verifiedFacts.map(({ id }) => id))
  const referencedRequirementIds = new Set<JobRequirementId>()
  return evidence.every((item) => {
    if (referencedRequirementIds.has(item.requirementId) || item.factIds.length === 0) return false
    referencedRequirementIds.add(item.requirementId)
    return requirementIds.has(item.requirementId)
      && new Set(item.factIds).size === item.factIds.length
      && item.factIds.every((factId) => factIds.has(factId))
  })
}

function findUncoveredRequiredRequirementIds({
  coveredRequirementIds,
  requirements,
}: Readonly<{
  coveredRequirementIds: ReadonlySet<JobRequirementId>
  requirements: readonly JobRequirement[]
}>) {
  return requirements
    .filter((requirement) => requirement.classification === 'required'
      && !coveredRequirementIds.has(requirement.id))
    .map(({ id }) => id)
}

function validateMatchEvidence({
  proposedEvidence,
  requirements,
  verifiedFacts,
}: Readonly<{
  proposedEvidence: readonly ProposedMatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const verifiedFactById = new Map(verifiedFacts.map((fact) => [fact.id, fact]))
  const referencedRequirementIds = new Set<JobRequirementId>()
  const evidence = proposedEvidence.map((proposal) => validateEvidenceProposal({
    proposal, referencedRequirementIds, requirementById, verifiedFactById,
  }))
  return evidence.includes(null) ? null : evidence.filter((item) => item !== null)
}

function validateEvidenceProposal({
  proposal,
  referencedRequirementIds,
  requirementById,
  verifiedFactById,
}: Readonly<{
  proposal: ProposedMatchEvidence
  referencedRequirementIds: Set<JobRequirementId>
  requirementById: ReadonlyMap<JobRequirementId, JobRequirement>
  verifiedFactById: ReadonlyMap<SourceProfileFact['id'], SourceProfileFact>
}>): MatchEvidence | null {
  const requirement = requirementById.get(proposal.requirementId)
  if (requirement === undefined || referencedRequirementIds.has(proposal.requirementId)) return null
  referencedRequirementIds.add(proposal.requirementId)
  if (!hasValidFactMatches({ factMatches: proposal.factMatches, requirement, verifiedFactById })) {
    return null
  }
  return { requirementId: proposal.requirementId,
    factIds: proposal.factMatches.map(({ factId }) => factId) }
}

function hasValidFactMatches({ factMatches, requirement, verifiedFactById }: Readonly<{
  factMatches: readonly ProposedFactMatch[]
  requirement: JobRequirement
  verifiedFactById: ReadonlyMap<SourceProfileFact['id'], SourceProfileFact>
}>) {
  if (factMatches.length === 0) return false
  const factIds = new Set(factMatches.map(({ factId }) => factId))
  if (factIds.size !== factMatches.length) return false
  return factMatches.every((factMatch) => {
    const fact = verifiedFactById.get(factMatch.factId)
    return fact !== undefined && provesRequirement({ factMatch, fact, requirement })
  })
}

function provesRequirement({ fact, factMatch, requirement }: Readonly<{
  fact: SourceProfileFact
  factMatch: ProposedFactMatch
  requirement: JobRequirement
}>) {
  if (!containsTerm({ content: fact.value, term: factMatch.factTerm })
    || !containsTerm({ content: requirement.value, term: factMatch.requirementTerm })) return false
  const factTerm = normalizeTerm({ value: factMatch.factTerm })
  const requirementTerm = normalizeTerm({ value: factMatch.requirementTerm })
  if (factMatch.relationship === 'exact') return factTerm === requirementTerm
  return controlledTermGroups.some((termGroup) => termGroup.has(factTerm)
    && termGroup.has(requirementTerm))
}

function containsTerm({ content, term }: Readonly<{ content: string; term: string }>) {
  const normalizedContent = ` ${normalizeTerm({ value: content })} `
  const normalizedTerm = normalizeTerm({ value: term })
  return normalizedTerm.length > 1 && normalizedContent.includes(` ${normalizedTerm} `)
}

function normalizeTerm({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en').replaceAll(/[^a-z0-9+#]+/gu, ' ').trim()
}

const controlledTermGroups = [
  ['typescript', 'ts'],
  ['javascript', 'js'],
  ['react', 'react js', 'reactjs'],
  ['french', 'francais'],
  ['english', 'anglais'],
  ['bilingual', 'bilingue'],
].map((terms) => new Set(terms))

function calculateMatchScore({
  coveredRequirementIds,
  requirements,
}: Readonly<{
  coveredRequirementIds: ReadonlySet<JobRequirementId>
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
