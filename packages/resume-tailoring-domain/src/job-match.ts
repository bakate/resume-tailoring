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
export type JobRequirementId = `job-requirement-${string}`

export type TargetRole = Readonly<{
  sourceExcerpt: string
  value: string
}>

export type PracticalConstraint = Readonly<{
  sourceExcerpt: string
  value: string
}>

export type JobRequirement = Readonly<{
  capability: Readonly<{
    dimension: CapabilityDimension
    name: string
  }>
  id: JobRequirementId
  importance: RequirementImportance
  importanceRationale: string
  sourceExcerpt: string
  substitutableGroup?: string
  value: string
}>

export type MatchEvidence = Readonly<{
  coverage: RequirementCoverage
  factIds: readonly string[]
  requirementId: JobRequirementId
}>

export type RequirementGroupAnalysis = Readonly<{
  capabilities: readonly JobRequirement['capability'][]
  coverage: RequirementCoverage | 'uncovered'
  effectiveWeight: number
  importance: RequirementImportance
  requirementIds: readonly JobRequirementId[]
}>

export type ExplainableMatchAnalysis = Readonly<{
  criticalRequirementReserve: Readonly<{
    requirementIds: readonly JobRequirementId[]
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

export type JobMatch = Readonly<{
  analysis: ExplainableMatchAnalysis
  jobPosting: Readonly<{
    kind: 'pasted-text' | 'pdf' | 'txt'
    name: string
    originalContent: string
  }>
  practicalConstraints: readonly PracticalConstraint[]
  priorityGapRequirementIds: readonly JobRequirementId[]
  requirements: readonly JobRequirement[]
  strengthRequirementIds: readonly JobRequirementId[]
  targetRole: TargetRole | null
}>
