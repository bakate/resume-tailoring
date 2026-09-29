import { validateMatchEvidence } from './evidence-validation'
import { canonicalizeKnownTerm } from './text-normalization'

export const capabilityDimensions = [
  'technical-expertise',
  'execution',
  'ownership',
  'leadership',
  'strategy',
  'stakeholder-communication',
  'operational-risk',
] as const

export const requirementImportances = ['critical', 'central', 'complementary'] as const
export const requirementCoverages = ['covered', 'partially-covered'] as const
export const matchBands = ['ambitious', 'credible', 'strong'] as const

export type CapabilityDimension = typeof capabilityDimensions[number]
export type RequirementImportance = typeof requirementImportances[number]
export type RequirementCoverage = typeof requirementCoverages[number]
export type MatchBand = typeof matchBands[number]

export type CandidateFact = Readonly<{
  id: string
  kind: 'education' | 'experience' | 'language' | 'project' | 'skill'
  value: string
}>

export type JobRequirement = Readonly<{
  capability: Readonly<{
    dimension: CapabilityDimension
    name: string
  }>
  id: string
  importance: RequirementImportance
  sourceExcerpt: string
  substitutableGroup?: string
  value: string
}>

export type ProposedFactMatch = Readonly<{
  factId: string
  factTerm: string
  relationship: 'controlled' | 'exact'
  requirementTerm: string
}>

export type ProposedMatchEvidence = Readonly<{
  coverage: RequirementCoverage
  factMatches: readonly ProposedFactMatch[]
  requirementId: string
}>

export type MatchEvidence = Readonly<{
  coverage: RequirementCoverage
  factIds: readonly string[]
  requirementId: string
}>

export type RequirementGroupAnalysis = Readonly<{
  capabilities: readonly JobRequirement['capability'][]
  coverage: RequirementCoverage | 'uncovered'
  effectiveWeight: number
  importance: RequirementImportance
  requirementIds: readonly string[]
}>

export type MatchAnalysis = Readonly<{
  criticalRequirementReserve: Readonly<{
    requirementIds: readonly string[]
    status: 'clear' | 'present'
  }>
  evidence: readonly MatchEvidence[]
  generationEligibility: 'denied' | 'eligible'
  matchBand: MatchBand
  matchBandQualification: 'critical-requirement-reserve' | null
  matchScore: number
  relevantFactIds: readonly string[]
  requirementGroups: readonly RequirementGroupAnalysis[]
}>

export type MatchAnalysisFailure = Readonly<{
  type: 'invalid-match-input'
}>

export type MatchAnalysisResult =
  | Readonly<{ ok: true; value: MatchAnalysis }>
  | Readonly<{ error: MatchAnalysisFailure; ok: false }>

export function analyzeResumeMatch({
  candidateFacts,
  proposedEvidence,
  relevantFactIds,
  requirements,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  proposedEvidence: readonly ProposedMatchEvidence[]
  relevantFactIds: readonly string[]
  requirements: readonly JobRequirement[]
}>): MatchAnalysisResult {
  const evidence = validateMatchEvidence({
    candidateFacts,
    proposedEvidence,
    requirements,
  })
  if (evidence === null || !hasValidRelevantFacts({ candidateFacts, evidence, relevantFactIds })) {
    return { error: { type: 'invalid-match-input' }, ok: false }
  }
  return createSuccessfulResult({ evidence, relevantFactIds, requirements })
}

export function restoreResumeMatch({
  candidateFacts,
  evidence,
  relevantFactIds,
  requirements,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  evidence: readonly MatchEvidence[]
  relevantFactIds: readonly string[]
  requirements: readonly JobRequirement[]
}>): MatchAnalysisResult {
  if (!hasValidStoredEvidence({ candidateFacts, evidence, requirements })
    || !hasValidRelevantFacts({ candidateFacts, evidence, relevantFactIds })) {
    return { error: { type: 'invalid-match-input' }, ok: false }
  }
  return createSuccessfulResult({ evidence, relevantFactIds, requirements })
}

function createSuccessfulResult({ evidence, relevantFactIds, requirements }: Readonly<{
  evidence: readonly MatchEvidence[]
  relevantFactIds: readonly string[]
  requirements: readonly JobRequirement[]
}>): MatchAnalysisResult {
  const matchScore = calculateMatchScore({ evidence, requirements })
  const criticalRequirementReserve = readCriticalRequirementReserve({ evidence, requirements })
  const requirementGroups = createRequirementGroupAnalyses({ evidence, requirements })
  return { ok: true, value: {
    criticalRequirementReserve,
    evidence,
    generationEligibility: relevantFactIds.length > 0 ? 'eligible' : 'denied',
    matchBand: readMatchBand({ matchScore }),
    matchBandQualification: criticalRequirementReserve.status === 'present'
      ? 'critical-requirement-reserve' : null,
    matchScore,
    relevantFactIds,
    requirementGroups,
  } }
}

function hasValidStoredEvidence({ candidateFacts, evidence, requirements }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
}>) {
  const factIds = new Set(candidateFacts.map(({ id }) => id))
  const requirementIds = new Set(requirements.map(({ id }) => id))
  const referencedRequirementIds = new Set<string>()
  return evidence.every((item) => {
    if (referencedRequirementIds.has(item.requirementId) || item.factIds.length === 0) return false
    referencedRequirementIds.add(item.requirementId)
    return requirementIds.has(item.requirementId)
      && new Set(item.factIds).size === item.factIds.length
      && item.factIds.every((factId) => factIds.has(factId))
  })
}

export function readMatchBand({ matchScore }: Readonly<{ matchScore: number }>): MatchBand {
  if (matchScore >= 75) return 'strong'
  if (matchScore >= 50) return 'credible'
  return 'ambitious'
}

function hasValidRelevantFacts({ candidateFacts, evidence, relevantFactIds }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  evidence: readonly MatchEvidence[]
  relevantFactIds: readonly string[]
}>) {
  const factIds = new Set(candidateFacts.map(({ id }) => id))
  const relevantIds = new Set(relevantFactIds)
  return relevantIds.size === relevantFactIds.length
    && relevantFactIds.every((factId) => factIds.has(factId))
    && evidence.every((item) => item.factIds.every((factId) => relevantIds.has(factId)))
}

function calculateMatchScore({ evidence, requirements }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
}>) {
  const evidenceByRequirementId = new Map(evidence.map((item) => [item.requirementId, item]))
  const weightedGroups = createWeightedGroups({ groups: groupRequirements({ requirements }) })
  const totalWeight = readScoreWeightCapacity({ weightedGroups })
  if (totalWeight === 0) return 0
  const coveredWeight = weightedGroups.reduce((total, { group, weight }) => {
    const coverage = readGroupCoverage({ evidenceByRequirementId, group })
    return total + weight * readCoverageMultiplier({ coverage })
  }, 0)
  return Math.round(coveredWeight / totalWeight * 100)
}

function readScoreWeightCapacity({ weightedGroups }: Readonly<{
  weightedGroups: readonly Readonly<{ group: readonly JobRequirement[]; weight: number }>[]
}>) {
  const totalWeight = weightedGroups.reduce((total, { weight }) => total + weight, 0)
  const hasCoreRequirement = weightedGroups.some(({ group }) =>
    readGroupImportance({ group }) !== 'complementary')
  return hasCoreRequirement ? totalWeight : totalWeight * 4
}

function createRequirementGroupAnalyses({ evidence, requirements }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
}>): readonly RequirementGroupAnalysis[] {
  const evidenceByRequirementId = new Map(evidence.map((item) => [item.requirementId, item]))
  const weightedGroups = createWeightedGroups({ groups: groupRequirements({ requirements }) })
  return weightedGroups.flatMap(({ group, weight }) => {
    const representative = group[0]
    if (representative === undefined) return []
    return [{
      capabilities: readGroupCapabilities({ group }),
      coverage: readGroupCoverage({ evidenceByRequirementId, group }) ?? 'uncovered',
      effectiveWeight: weight,
      importance: readGroupImportance({ group }),
      requirementIds: group.map(({ id }) => id),
    }]
  })
}

function createWeightedGroups({ groups }: Readonly<{
  groups: readonly (readonly JobRequirement[])[]
}>) {
  const complementaryWeight = sumGroupsWithImportance({ groups, importance: 'complementary' })
  const coreWeight = groups.reduce((total, group) => {
    const importance = readGroupImportance({ group })
    return importance === 'complementary'
      ? total : total + readImportanceWeight({ importance })
  }, 0)
  const complementaryMultiplier = coreWeight === 0
    ? 0.25 : complementaryWeight === 0
      ? 1 : Math.min(1, coreWeight / (3 * complementaryWeight))
  return groups.map((group) => ({
    group,
    weight: readGroupImportance({ group }) === 'complementary'
      ? complementaryMultiplier : readImportanceWeight({ importance: readGroupImportance({ group }) }),
  }))
}

function sumGroupsWithImportance({ groups, importance }: Readonly<{
  groups: readonly (readonly JobRequirement[])[]
  importance: RequirementImportance
}>) {
  return groups.filter((group) => readGroupImportance({ group }) === importance)
    .reduce((total) => total + readImportanceWeight({ importance }), 0)
}

function groupRequirements({ requirements }: Readonly<{
  requirements: readonly JobRequirement[]
}>) {
  const groupsByCapability = new Map<string, JobRequirement[]>()
  for (const requirement of requirements) {
    const groupKey = readRequirementGroupKey({ requirement })
    groupsByCapability.set(groupKey, [...(groupsByCapability.get(groupKey) ?? []), requirement])
  }
  return [...groupsByCapability.values()]
}

function readRequirementGroupKey({ requirement }: Readonly<{ requirement: JobRequirement }>) {
  if (requirement.substitutableGroup !== undefined) {
    return `substitute:${canonicalizeKnownTerm({ value: requirement.substitutableGroup })}`
  }
  return `capability:${requirement.capability.dimension}:${canonicalizeKnownTerm({
    value: requirement.capability.name,
  })}`
}

function readGroupCapabilities({ group }: Readonly<{ group: readonly JobRequirement[] }>) {
  const capabilityByIdentity = new Map(group.map(({ capability }) => [
    `${capability.dimension}:${canonicalizeKnownTerm({ value: capability.name })}`,
    capability,
  ]))
  return [...capabilityByIdentity.values()]
}

function readGroupImportance({ group }: Readonly<{ group: readonly JobRequirement[] }>) {
  return group.reduce<RequirementImportance>((highestImportance, requirement) =>
    readImportanceWeight({ importance: requirement.importance })
      > readImportanceWeight({ importance: highestImportance })
      ? requirement.importance : highestImportance, 'complementary')
}

function readGroupCoverage({ evidenceByRequirementId, group }: Readonly<{
  evidenceByRequirementId: ReadonlyMap<string, MatchEvidence>
  group: readonly JobRequirement[]
}>): RequirementCoverage | undefined {
  const coverages = group.flatMap(({ id }) => {
    const coverage = evidenceByRequirementId.get(id)?.coverage
    return coverage === undefined ? [] : [coverage]
  })
  if (coverages.includes('covered')) return 'covered'
  return coverages.includes('partially-covered') ? 'partially-covered' : undefined
}

function readCoverageMultiplier({ coverage }: Readonly<{
  coverage: RequirementCoverage | undefined
}>) {
  if (coverage === 'covered') return 1
  if (coverage === 'partially-covered') return 0.5
  return 0
}

function readCriticalRequirementReserve({ evidence, requirements }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
}>): MatchAnalysis['criticalRequirementReserve'] {
  const evidenceByRequirementId = new Map(evidence.map((item) => [item.requirementId, item]))
  const requirementIds = groupRequirements({ requirements })
    .filter((group) => readGroupImportance({ group }) === 'critical'
      && readGroupCoverage({ evidenceByRequirementId, group }) !== 'covered')
    .flatMap((group) => group
      .filter(({ importance }) => importance === 'critical')
      .map(({ id }) => id))
  return { requirementIds, status: requirementIds.length > 0 ? 'present' : 'clear' }
}

function readImportanceWeight({ importance }: Readonly<{ importance: RequirementImportance }>) {
  if (importance === 'critical') return 3
  if (importance === 'central') return 2
  return 1
}
