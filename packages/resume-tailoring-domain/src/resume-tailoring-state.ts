export type CandidateSessionId = `candidate-session-${string}`
export type SourceProfileFactId = `source-fact-${string}`
export type SourceProfilePropositionKey = `proposition-${string}`
export type JobRequirementId = `job-requirement-${string}`
export type JobRequirementGroupId = `job-requirement-group-${string}`
export type ResumeClaimId = `resume-claim-${string}`

export const sensitiveContentKinds = [
  'email',
  'phone',
  'url',
  'address',
  'date-of-birth',
  'personal-information',
] as const

export type SensitiveContentKind = typeof sensitiveContentKinds[number]

export type SensitiveContent = Readonly<{
  id: `sensitive-${string}`
  kind: SensitiveContentKind
  value: string
}>

export const sourceProfileFactKinds = [
  'experience',
  'skill',
  'education',
  'language',
  'project',
] as const

export type SourceProfileFactKind = typeof sourceProfileFactKinds[number]

export const sourceProfileFactStatuses = [
  'extracted',
  'verified',
  'rejected',
  'superseded',
] as const

export type SourceProfileFactStatus = typeof sourceProfileFactStatuses[number]

export const sourceProfileReviewStatuses = [
  'reviewing-document',
  'reviewing-facts',
] as const

export type SourceProfileReviewStatus = typeof sourceProfileReviewStatuses[number]

export type SourceProfileFactContent = Readonly<{
  kind: SourceProfileFactKind
  propositionKey: SourceProfilePropositionKey
  value: string
}>

export type SourceProfileFact = SourceProfileFactContent & Readonly<{
  id: SourceProfileFactId
  status: SourceProfileFactStatus
  supersedesFactId?: SourceProfileFactId
}>

export type SourceProfileReview = Readonly<{
  status: SourceProfileReviewStatus
  documentName: string
  detectedSensitiveContent: readonly SensitiveContent[]
  outgoingContent: string
  processingNotice: Readonly<{
    version: string
    confirmedAt: number
  }> | null
  facts: readonly SourceProfileFact[]
}>

export const jobRequirementClassifications = ['required', 'preferred'] as const
export const jobRequirementMaximumCount = 200

export type JobRequirementClassification = typeof jobRequirementClassifications[number]

export type JobRequirementContent = Readonly<{
  classification: JobRequirementClassification
  sourceExcerpt: string
  value: string
}>

export type JobRequirement = JobRequirementContent & Readonly<{
  id: JobRequirementId
  groupId: JobRequirementGroupId
}>

export type MatchEvidence = Readonly<{
  requirementId: JobRequirementId
  factIds: readonly SourceProfileFactId[]
}>

declare const matchScoreBrand: unique symbol
export type MatchScore = number & Readonly<{ [matchScoreBrand]: true }>

export type MatchAnalysis = Readonly<{
  evidence: readonly MatchEvidence[]
  gapAnalysis: Readonly<{
    uncoveredRequiredRequirementIds: readonly JobRequirementId[]
  }>
  generationEligibility: 'eligible' | 'denied'
  matchScore: MatchScore
  relevantFactIds: readonly SourceProfileFactId[]
  warning: 'below-generation-threshold' | null
}>

export type ResumeClaimSegment = Readonly<{
  text: string
  factIds: readonly SourceProfileFactId[]
}>

export type ResumeClaim = Readonly<{
  id: ResumeClaimId
  segments: readonly ResumeClaimSegment[]
}>

export type TailoredResume = Readonly<{
  claims: readonly ResumeClaim[]
  exclusions: readonly Readonly<{
    reason: 'unsupported-after-regeneration'
  }>[]
}>

export type JobPostingReview = Readonly<{
  status: 'reviewing-posting' | 'reviewing-requirements'
  detectedSensitiveContent: readonly SensitiveContent[]
  outgoingContent: string
  processingNotice: Readonly<{
    version: string
    confirmedAt: number
    provider: string
    retentionPolicy: string
    transmittedDataCategories: readonly string[]
  }> | null
  requirements: readonly JobRequirement[]
}>

export type ResumeTailoringState =
  | { readonly status: 'not-started' }
  | {
      readonly status: 'ready'
      readonly sessionId: CandidateSessionId
      readonly expiresAt: number
      readonly sourceProfile?: SourceProfileReview
      readonly jobPosting?: JobPostingReview
      readonly matchAnalysis?: MatchAnalysis
      readonly tailoredResume?: TailoredResume
    }

export type DomainResult<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError }

export type ResumeTailoringDomainError = {
  readonly type: 'workflow-already-open'
}

export const candidateSessionDurationMilliseconds = 24 * 60 * 60 * 1_000

export const initialResumeTailoringState = {
  status: 'not-started',
} as const satisfies ResumeTailoringState

export function openResumeTailoringWorkflow({
  currentState,
  sessionId,
  startedAt,
}: Readonly<{
  currentState: ResumeTailoringState
  sessionId: CandidateSessionId
  startedAt: number
}>): DomainResult<ResumeTailoringState, ResumeTailoringDomainError> {
  if (currentState.status === 'ready') {
    return { ok: false, error: { type: 'workflow-already-open' } }
  }

  return {
    ok: true,
    value: {
      status: 'ready',
      sessionId,
      expiresAt: startedAt + candidateSessionDurationMilliseconds,
    },
  }
}

export function hasCandidateSessionExpired({
  currentState,
  now,
}: Readonly<{ currentState: ResumeTailoringState; now: number }>): boolean {
  return currentState.status === 'ready' && currentState.expiresAt <= now
}
