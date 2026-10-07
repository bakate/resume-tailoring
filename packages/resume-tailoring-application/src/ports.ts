/**
 * Every port of the Resume Tailoring application. Adapters live in `apps/web/src/adapters/`, in-memory fakes in
 * `./testing`, and `apps/web/src/composition-root.ts` wires the adapters into `createCandidateJourney`.
 */
import type { CandidateFact as EngineCandidateFact } from '@resume-tailoring/matching-engine'
import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { JobRequirement } from '@resume-tailoring/domain/job-match'
import type { ProcessingPolicy } from '@resume-tailoring/domain/processing-policy'
import type { ResumeClaim } from '@resume-tailoring/domain/resume-claim'
import type { ExtractedJobPosting, JobPostingDocument, JobPostingDocumentFailure, MatchEvidenceProposal } from './job-match'
import type { PrivacySafeTelemetryEvent } from './privacy-safe-telemetry'
import type { ProposedResumeClaim, ResumeClaimValidationFeedback, ResumeClaimWritingInputs } from './resume-claims'
import type { ReadApiFailure } from './api-failure'
import type { ResumeRenderRequest, ResumeRenderResult } from './resume-export'
import type { ResumeCoherenceInput, ResumeDocumentCoherence, ResumeFieldValidation, ResumeFieldValidationInput,
  ResumeSectionContent, ResumeSectionModelResult, ResumeSectionWritingInput } from './resume-sections'
import type { SourceDocument, SourceDocumentFailure, StructuredSourceProfileExtraction } from './source-intake'
import type { ResumeDraft, ResumeLayoutAssessment } from './structured-resume-contract'

export type CandidateJourneyDependencies = Readonly<{
  resumeDocumentRenderer?: ResumeDocumentRenderer
  telemetry?: PrivacySafeTelemetry
  resumeDocumentPorts?: Partial<ResumeDocumentPorts>
  resumeSectionModels?: ResumeSectionModels
  createIdentifier: () => string
  jobPostingDocumentReader: JobPostingDocumentReader
  jobPostingExtractor: JobPostingExtractor
  languageModelGateway: Readonly<{ processingPolicy: ProcessingPolicy }>
  matchEvidenceMatcher: MatchEvidenceMatcher
  now: () => number
  persistence: CandidateSessionPersistence
  sourceDocumentReader: SourceDocumentReader
  sourceProfileExtractor: StructuredSourceProfileExtractor
}>

// Candidate Session

export type CandidateSessionNotice =
  | 'deleted'
  | 'expired-session-discarded'
  | 'incompatible-session-discarded'
  | null

export type CandidateSessionStorageFailure = 'candidate-session-storage-unavailable'

export type CandidateSessionStorageResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; error: CandidateSessionStorageFailure }>

/** Stores one Candidate Session; the application decides whether a restored session is still valid. */
export type CandidateSessionPersistence = Readonly<{
  delete: () => CandidateSessionStorageResult<null>
  /** Returns the stored session, or discards a stored value that is no longer readable as one. */
  restore: () => CandidateSessionStorageResult<Readonly<{
    notice: Extract<CandidateSessionNotice, 'incompatible-session-discarded'> | null
    session: CandidateSession | null
  }>>
  save: (request: Readonly<{ session: CandidateSession }>) =>
    CandidateSessionStorageResult<CandidateSession>
}>

// API Failures read by the browser adapters

export type { ApiFailureType, ReadApiFailure } from './api-failure'

// Source Intake

export type SourceDocumentReader = Readonly<{
  read: (document: SourceDocument) => Promise<
    | Readonly<{ ok: true; value: Readonly<{ pageCount: number | null; text: string }> }>
    | Readonly<{ ok: false; error: SourceDocumentFailure }>
  >
}>

export type StructuredSourceProfileExtractor = Readonly<{
  extract: (request: Readonly<{ professionalContent: string }>) => Promise<
    | Readonly<{ ok: true; value: StructuredSourceProfileExtraction }>
    | Readonly<{
        ok: false
        error: 'processing-consent-required' | 'source-profile-extraction-unavailable'
        apiFailure?: ReadApiFailure
      }>
  >
}>

// Job Match

export type JobPostingDocumentReader = Readonly<{
  read: (document: JobPostingDocument) => Promise<
    | Readonly<{ ok: true; value: Readonly<{ text: string }> }>
    | Readonly<{ ok: false; error: JobPostingDocumentFailure }>
  >
}>

export type JobPostingExtractor = Readonly<{
  extract: (request: Readonly<{ jobPostingContent: string }>) => Promise<
    | Readonly<{ ok: true; value: ExtractedJobPosting }>
    | Readonly<{ ok: false; error: 'job-posting-extraction-unavailable'; apiFailure?: ReadApiFailure }>
  >
}>

export type MatchEvidenceMatcher = Readonly<{
  match: (request: Readonly<{
    candidateFacts: readonly EngineCandidateFact[]
    requirements: readonly JobRequirement[]
  }>) => Promise<
    | Readonly<{ ok: true; value: MatchEvidenceProposal }>
    | Readonly<{ ok: false; error: 'match-evidence-unavailable'; apiFailure?: ReadApiFailure }>
  >
}>

// Tailored Resume Preparation

export type ResumeSectionModels = Readonly<{
  writeSection: (input: ResumeSectionWritingInput) => Promise<ResumeSectionModelResult<ResumeSectionContent>>
  validateFields: (input: ResumeFieldValidationInput) => Promise<ResumeSectionModelResult<ResumeFieldValidation>>
  checkCoherence: (input: ResumeCoherenceInput) => Promise<ResumeSectionModelResult<ResumeDocumentCoherence>>
}>

/** The model operations behind `ResumeSectionModels`, shared by the browser fetch clients and the server OpenAI adapters. */
export type ResumeSectionWriter = Readonly<{
  write: (input: ResumeSectionWritingInput) => Promise<ResumeSectionModelResult<ResumeSectionContent>>
}>
export type ResumeFieldValidator = Readonly<{
  validate: (input: ResumeFieldValidationInput) => Promise<ResumeSectionModelResult<ResumeFieldValidation>>
}>
export type ResumeCoherenceChecker = Readonly<{
  check: (input: ResumeCoherenceInput) => Promise<ResumeSectionModelResult<ResumeDocumentCoherence>>
}>

export type ResumeClaimModelFailure = 'processing-consent-required' | 'unavailable'

export type ResumeClaimModelResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; error: ResumeClaimModelFailure; apiFailure?: ReadApiFailure }>

/** Model operations on one Resume Claim; the application decides which claims to send and what the answers mean. */
export type ResumeDocumentPorts = Readonly<{
  /** Judges whether the claim's meaning is supported by the verified facts it is given. */
  validateClaim: (request: Readonly<{
    claim: ResumeClaim
    verifiedFacts: ResumeClaimWritingInputs['verifiedFacts']
  }>) => Promise<ResumeClaimModelResult<Readonly<{ supported: boolean }>>>
  /** Proposes shorter wording for the claim, citing fact references as the model chooses. */
  condenseClaim: (request: Readonly<{
    claim: ProposedResumeClaim
    locale: ResumeClaimWritingInputs['locale']
    verifiedFacts: ResumeClaimWritingInputs['verifiedFacts']
  }>) => Promise<ResumeClaimModelResult<ProposedResumeClaim>>
  assessLayout: (request: Readonly<{
    draft: ResumeDraft
    photoDataUrl?: string
    unsupportedFieldIds: readonly string[]
  }>) => Promise<ResumeLayoutAssessment>
}>

export type ResumeClaimReformulator = Readonly<{
  reformulate: (request: ResumeClaimWritingInputs & Readonly<{
    claim: ProposedResumeClaim
    feedback: readonly ResumeClaimValidationFeedback[]
    request?: string
  }>) => Promise<
    | { readonly ok: true; readonly value: ProposedResumeClaim }
    | { readonly ok: false; readonly error: { readonly type: 'resume-claim-writing-unavailable'; readonly apiFailure?: ReadApiFailure } }
  >
}>

export type ResumeClaimSemanticValidator = Readonly<{
  validate: (request: Readonly<{
    claim: ResumeClaim
    verifiedFacts: ResumeClaimWritingInputs['verifiedFacts']
  }>) => Promise<
    | {
        readonly ok: true
        readonly value: Readonly<{
          supported: boolean
          feedback: readonly ResumeClaimValidationFeedback[]
        }>
      }
    | { readonly ok: false; readonly error: {
      readonly type: 'resume-claim-validation-unavailable'
      readonly apiFailure?: ReadApiFailure
    } }
  >
}>

export type ResumeDocumentRenderer = Readonly<{
  render: (request: ResumeRenderRequest) => Promise<ResumeRenderResult>
}>

// Telemetry

export type AdapterFailure = {
  readonly type: 'adapter-unavailable' | 'candidate-session-inactive'
}

export type AdapterResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: AdapterFailure }

export type PrivacySafeTelemetry = {
  readonly record: (event: PrivacySafeTelemetryEvent) => Promise<AdapterResult<undefined>>
}

// Language Model Gateway: the application binds Processing Consent around this adapter.

export type LanguageModelFailure = Readonly<{
  /** The API Failure the browser adapter read, kept so the application can tell the Candidate why. */
  apiFailure?: ReadApiFailure
  type: 'language-model-unavailable' | 'processing-consent-required'
}>

export type LanguageModelResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; error: LanguageModelFailure }>

export type LanguageModelRole<TRequest, TValue> = Readonly<{
  process: (request: TRequest) => Promise<LanguageModelResult<TValue>>
}>

export type LanguageModelGatewayAdapter<
  TStructuredRequest,
  TStructuredValue,
  TWritingRequest = TStructuredRequest,
  TWritingValue = TStructuredValue,
> = Readonly<{
  processingPolicy: ProcessingPolicy
  structured: LanguageModelRole<TStructuredRequest, TStructuredValue>
  writing: LanguageModelRole<TWritingRequest, TWritingValue>
}>
