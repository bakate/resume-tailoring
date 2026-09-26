import type {
  CandidateSessionId,
  ResumeTailoringState,
  SourceProfileFactContent,
  SourceProfileFactId,
  JobRequirementGroupId,
  JobRequirementId,
  JobRequirementContent,
  JobRequirement,
  SourceProfileFact,
  ResumeClaim,
  ResumeClaimId,
} from '@resume-tailoring/domain/resume-tailoring-state'

export {
  sensitiveContentKinds,
  sourceProfileFactKinds,
  sourceProfileFactStatuses,
  sourceProfileReviewStatuses,
  jobRequirementClassifications,
  jobRequirementMaximumCount,
} from '@resume-tailoring/domain/resume-tailoring-state'

export type {
  CandidateSessionId,
  ResumeTailoringState,
  SourceProfileFact,
  SourceProfileFactContent,
  SourceProfileFactId,
  SourceProfileFactKind,
  SourceProfileFactStatus,
  SourceProfilePropositionKey,
  SourceProfileReview,
  SourceProfileReviewStatus,
  JobPostingReview,
  JobRequirement,
  JobRequirementClassification,
  JobRequirementContent,
  JobRequirementGroupId,
  JobRequirementId,
  MatchAnalysis,
  MatchEvidence,
  MatchScore,
  ResumeClaim,
  ResumeClaimId,
  ResumeClaimSegment,
  TailoredResume,
} from '@resume-tailoring/domain/resume-tailoring-state'

export type AdapterFailure = {
  readonly type: 'adapter-unavailable' | 'candidate-session-inactive'
}

export type AdapterResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: AdapterFailure }

export type CandidateSessionPersistence = {
  readonly read: () => Promise<AdapterResult<ResumeTailoringState>>
  readonly create: (
    state: Extract<ResumeTailoringState, { readonly status: 'ready' }>,
  ) => Promise<AdapterResult<ResumeTailoringState>>
  readonly update: (request: Readonly<{
    sessionId: CandidateSessionId
    state: Extract<ResumeTailoringState, { readonly status: 'ready' }>
  }>) => Promise<AdapterResult<ResumeTailoringState>>
  readonly erase: (request: Readonly<{
    sessionId: CandidateSessionId
  }>) => Promise<AdapterResult<ResumeTailoringState>>
  readonly subscribe: (listener: () => void) => () => void
}

export type CandidateSessionClock = {
  readonly now: () => number
  readonly scheduleExpiration: (request: Readonly<{
    expiresAt: number
    onExpire: () => Promise<void>
  }>) => () => void
}

export type CandidateSessionIdentity = {
  readonly create: () => AdapterResult<CandidateSessionId>
}

export type PrivacySafeTelemetry = {
  readonly record: (
    event:
      | 'resume-tailoring-opened'
      | 'candidate-session-deleted'
      | 'candidate-session-expired',
  ) => Promise<AdapterResult<undefined>>
}

export type SourceDocumentReader = {
  readonly read: (document: Readonly<{
    bytes: Uint8Array
    mediaType: string
    name: string
  }>) => Promise<
    | { readonly ok: true; readonly value: string }
    | {
        readonly ok: false
        readonly error: { readonly type: 'unsupported-source-document' | 'unreadable-source-document' }
      }
  >
}

export type SourceProfileExtractor = {
  readonly extract: (request: Readonly<{
    professionalContent: string
  }>) => Promise<
    | {
        readonly ok: true
        readonly value: readonly SourceProfileFactContent[]
      }
    | { readonly ok: false; readonly error: { readonly type: 'source-profile-extraction-unavailable' } }
  >
}

export type SourceProfileFactIdentity = {
  readonly create: () => AdapterResult<SourceProfileFactId>
}

export type JobRequirementExtractor = {
  readonly extract: (request: Readonly<{
    jobPostingContent: string
  }>) => Promise<
    | { readonly ok: true; readonly value: readonly JobRequirementContent[] }
    | {
        readonly ok: false
        readonly error: {
          readonly type:
            | 'job-requirement-extraction-unavailable'
            | 'job-requirement-transport-unavailable'
        }
      }
  >
}

export type JobRequirementIdentity = {
  readonly create: () => AdapterResult<JobRequirementId>
}

export type JobRequirementGroupIdentity = {
  readonly create: () => AdapterResult<JobRequirementGroupId>
}

export type MatchEvidenceMatcher = {
  readonly match: (request: MatchInputs) => Promise<
    | { readonly ok: true; readonly value: ProposedMatchAnalysis }
    | {
        readonly ok: false
        readonly error: {
          readonly type: 'match-analysis-unavailable' | 'match-analysis-transport-unavailable'
        }
      }
  >
}

export type ProposedFactMatch = Readonly<{
  factId: SourceProfileFactId
  factTerm: string
  relationship: 'exact' | 'controlled'
  requirementTerm: string
}>

export type ProposedMatchEvidence = Readonly<{
  requirementId: JobRequirementId
  factMatches: readonly ProposedFactMatch[]
}>

export type ProposedMatchAnalysis = Readonly<{
  evidence: readonly ProposedMatchEvidence[]
  relevantFactIds: readonly SourceProfileFactId[]
}>

export type MatchInputs = Readonly<{
  requirements: readonly Pick<JobRequirement, 'classification' | 'id' | 'value'>[]
  verifiedFacts: readonly Pick<SourceProfileFact, 'id' | 'kind' | 'value'>[]
}>

export type ProposedResumeClaim = Readonly<{
  segments: readonly Readonly<{
    text: string
    factIds: readonly SourceProfileFactId[]
  }>[]
}>

export type ResumeClaimValidationFeedback = Readonly<{
  code:
    | 'invalid-fact-reference'
    | 'missing-segment-provenance'
    | 'unsupported-number-or-date'
    | 'unsupported-meaning'
  segmentIndex?: number
}>

export type ResumeClaimWritingInputs = Readonly<{
  evidence: readonly Readonly<{
    requirementId: JobRequirementId
    factIds: readonly SourceProfileFactId[]
  }>[]
  requirements: readonly Pick<JobRequirement, 'classification' | 'id' | 'value'>[]
  verifiedFacts: readonly Pick<SourceProfileFact, 'id' | 'kind' | 'value'>[]
}>

export type ResumeClaimWriter = Readonly<{
  write: (request: ResumeClaimWritingInputs) => Promise<
    | { readonly ok: true; readonly value: readonly ProposedResumeClaim[] }
    | { readonly ok: false; readonly error: { readonly type: 'resume-claim-writing-unavailable' } }
  >
  reformulate: (request: ResumeClaimWritingInputs & Readonly<{
    claim: ProposedResumeClaim
    feedback: readonly ResumeClaimValidationFeedback[]
    request?: string
  }>) => Promise<
    | { readonly ok: true; readonly value: ProposedResumeClaim }
    | { readonly ok: false; readonly error: { readonly type: 'resume-claim-writing-unavailable' } }
  >
}>

export type ResumeClaimSemanticValidator = Readonly<{
  validate: (request: Readonly<{
    claim: ResumeClaim
    verifiedFacts: ResumeClaimWritingInputs['verifiedFacts']
  }>) => Promise<
    | { readonly ok: true; readonly value: boolean }
    | { readonly ok: false; readonly error: { readonly type: 'resume-claim-validation-unavailable' } }
  >
}>

export type ResumeClaimIdentity = Readonly<{
  create: () => AdapterResult<ResumeClaimId>
}>
