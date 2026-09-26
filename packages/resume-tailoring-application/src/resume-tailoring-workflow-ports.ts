import type {
  CandidateSessionId,
  ResumeTailoringState,
  SourceProfileFactContent,
  SourceProfileFactId,
  JobRequirementGroupId,
  JobRequirementId,
  JobRequirementContent,
  MatchEvidence,
  JobRequirement,
  SourceProfileFact,
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
  readonly match: (request: Readonly<{
    requirements: readonly JobRequirement[]
    verifiedFacts: readonly SourceProfileFact[]
  }>) => Promise<
    | { readonly ok: true; readonly value: readonly MatchEvidence[] }
    | {
        readonly ok: false
        readonly error: {
          readonly type: 'match-analysis-unavailable' | 'match-analysis-transport-unavailable'
        }
      }
  >
}
