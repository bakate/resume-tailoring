/**
 * Every port of the Resume Tailoring application. Adapters live in `apps/web/src/adapters/`, in-memory fakes in
 * `./testing`, and `apps/web/src/composition-root.ts` wires the adapters into `createCandidateJourney`.
 */
import type { CandidateFact as EngineCandidateFact } from '@resume-tailoring/matching-engine'
import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { JobRequirement } from '@resume-tailoring/domain/job-match'
import type { ProcessingPolicy } from '@resume-tailoring/domain/processing-policy'
import type { ResumeClaim } from '@resume-tailoring/domain/resume-claim'
import type { CandidateFact } from '@resume-tailoring/domain/source-intake'
import type { ExtractedJobPosting, JobPostingDocument, JobPostingDocumentFailure, MatchEvidenceProposal } from './job-match'
import type { PrivacySafeTelemetryEvent } from './privacy-safe-telemetry'
import type { ProposedResumeClaim, ResumeClaimValidationFeedback, ResumeClaimWritingInputs } from './resume-claims'
import type { ResumeRenderRequest, ResumeRenderResult } from './resume-export'
import type { ResumeCoherenceInput, ResumeDocumentCoherence, ResumeFieldValidation, ResumeFieldValidationInput,
  ResumeSectionContent, ResumeSectionModelResult, ResumeSectionWritingInput } from './resume-sections'
import type { SourceDocument, SourceDocumentFailure, StructuredSourceProfileExtraction } from './source-intake'
import type { ProfessionalResumeDocument, ResumeCondensationOutcome, ResumeDraft, ResumeLayoutAssessment,
  ResumeSectionChange, ResumeSectionChangeOutcome } from './structured-resume-contract'

export type CandidateJourneyDependencies = Readonly<{
  resumeDocumentRenderer?: ResumeDocumentRenderer
  telemetry?: PrivacySafeTelemetry
  resumeDocumentPorts?: Partial<ResumeDocumentPorts>
  resumeSectionModels?: ResumeSectionModels
  createSessionId: () => string
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

export type CandidateSessionPersistence = Readonly<{
  delete: () => CandidateSessionStorageResult<null>
  restore: (request: Readonly<{ now: number }>) => CandidateSessionStorageResult<Readonly<{
    notice: CandidateSessionNotice
    session: CandidateSession | null
  }>>
  save: (request: Readonly<{ session: CandidateSession }>) =>
    CandidateSessionStorageResult<CandidateSession>
}>

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
    | Readonly<{ ok: false; error: 'job-posting-extraction-unavailable' }>
  >
}>

export type MatchEvidenceMatcher = Readonly<{
  match: (request: Readonly<{
    candidateFacts: readonly EngineCandidateFact[]
    requirements: readonly JobRequirement[]
  }>) => Promise<
    | Readonly<{ ok: true; value: MatchEvidenceProposal }>
    | Readonly<{ ok: false; error: 'match-evidence-unavailable' }>
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

export type ResumeDocumentPorts = Readonly<{
  validateSectionChange: (request: Readonly<{
    candidateFacts: readonly CandidateFact[]
    currentDocument: ProfessionalResumeDocument
    change: ResumeSectionChange
  }>) => Promise<ResumeSectionChangeOutcome>
  assessLayout: (request: Readonly<{
    draft: ResumeDraft
    photoDataUrl?: string
    unsupportedFieldIds: readonly string[]
  }>) => Promise<ResumeLayoutAssessment>
  proposeCondensation: (request: Readonly<{
    baseRevision: string
    candidateFacts: readonly CandidateFact[]
    document: ProfessionalResumeDocument
    maximumPages: 2
  }>) => Promise<ResumeCondensationOutcome>
}>

export type ResumeClaimReformulator = Readonly<{
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
    | {
        readonly ok: true
        readonly value: Readonly<{
          supported: boolean
          feedback: readonly ResumeClaimValidationFeedback[]
        }>
      }
    | { readonly ok: false; readonly error: { readonly type: 'resume-claim-validation-unavailable' } }
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
  transient?: boolean
  /** Distinguishes a timeout, which is never retried, from other unavailability. */
  cause?: 'transient' | 'timeout' | 'permanent'
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
