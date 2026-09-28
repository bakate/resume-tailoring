import type {
  CandidateSessionId,
  JobPostingReview,
  MatchAnalysis,
  OutcomeFeedback,
  ResumeClaimId,
  SourceProfileFact,
  SourceProfileFactKind,
  SourceProfileFactId,
  SourceProfileReview,
  TailoredResume,
} from '@resume-tailoring/domain/resume-tailoring-state'

export type SourceDocument = Readonly<{
  bytes: Uint8Array
  mediaType: string
  name: string
}>

export const sourceProfileProcessingNoticeVersion = '2026-09-28'
export const jobPostingProcessingNoticeVersion = '2026-09-26'
export const jobPostingProcessingPolicy = {
  provider: 'OpenAI',
  retentionPolicy: 'standard-abuse-monitoring',
  transmittedDataCategories: ['job-posting-content'],
} as const

export function hasCurrentJobPostingProcessingConsent({
  jobPosting,
}: Readonly<{ jobPosting: JobPostingReview }>) {
  const notice = jobPosting.processingNotice
  return notice?.version === jobPostingProcessingNoticeVersion
    && notice.provider === jobPostingProcessingPolicy.provider
    && notice.retentionPolicy === jobPostingProcessingPolicy.retentionPolicy
    && notice.transmittedDataCategories.length
      === jobPostingProcessingPolicy.transmittedDataCategories.length
    && notice.transmittedDataCategories.every(
      (category, categoryIndex) => category
        === jobPostingProcessingPolicy.transmittedDataCategories[categoryIndex],
    )
}

export type ResumeTailoringCommand =
  | { readonly type: 'open-workflow' }
  | { readonly type: 'delete-session' }
  | { readonly type: 'import-source-document'; readonly document: SourceDocument }
  | { readonly type: 'update-source-content'; readonly outgoingContent: string }
  | { readonly type: 'confirm-processing-notice' }
  | { readonly type: 'confirm-processing-and-extract-source-profile' }
  | { readonly type: 'extract-source-profile' }
  | { readonly type: 'reject-source-fact'; readonly factId: SourceProfileFactId }
  | {
      readonly type: 'correct-source-fact'
      readonly factId: SourceProfileFactId
      readonly correctedValue: string
    }
  | { readonly type: 'resolve-source-fact-conflict'; readonly selectedFactId: SourceProfileFactId }
  | {
      readonly type: 'enrich-source-profile'
      readonly kind: SourceProfileFactKind
      readonly value: string
    }
  | { readonly type: 'review-job-posting'; readonly content: string }
  | { readonly type: 'update-job-posting-content'; readonly outgoingContent: string }
  | { readonly type: 'update-target-role'; readonly value: string }
  | { readonly type: 'confirm-job-posting-processing-notice' }
  | { readonly type: 'extract-job-requirements' }
  | { readonly type: 'analyze-match' }
  | { readonly type: 'generate-resume-claims'; readonly locale: 'en' | 'fr' }
  | { readonly type: 'remove-resume-claim'; readonly claimId: ResumeClaimId }
  | {
      readonly type: 'move-resume-claim'
      readonly claimId: ResumeClaimId
      readonly direction: 'up' | 'down'
    }
  | {
      readonly type: 'reformulate-resume-claim'
      readonly claimId: ResumeClaimId
      readonly request: string
    }
  | {
      readonly type: 'edit-resume-claim'
      readonly claimId: ResumeClaimId
      readonly text: string
    }
  | {
      readonly type: 'confirm-resume-claim-edit'
      readonly claimId: ResumeClaimId
      readonly kind: SourceProfileFactKind
      readonly text: string
    }
  | {
      readonly type: 'rate-tailored-resume-fidelity'
      readonly assessment: 'faithful' | 'needs-correction'
    }
  | {
      readonly type: 'rate-tailored-resume-relevance'
      readonly assessment: 'relevant' | 'needs-improvement'
    }
  | { readonly type: 'record-tailored-resume-download' }

export type ResumeTailoringView =
  | { readonly status: 'not-started' }
  | {
      readonly status: 'ready'
      readonly sessionId: CandidateSessionId
      readonly expiresAt: number
      readonly sourceProfile?: SourceProfileReview
      readonly jobPosting?: JobPostingReview
      readonly matchAnalysis?: MatchAnalysis
      readonly outcomeFeedback?: OutcomeFeedback
      readonly tailoredResume?: TailoredResume
    }

export type SourceDocumentReadFailure =
  | { readonly type: 'unsupported-source-document' }
  | {
      readonly type: 'unreadable-source-document'
      readonly reason:
        | 'encrypted-pdf'
        | 'invalid-pdf'
        | 'pdf-read-failure'
        | 'text-empty'
    }
  | {
      readonly type: 'incompatible-source-document-reader'
      readonly reason:
        | 'missing-worker-capability'
        | 'pdf-reader-load-failure'
        | 'pdf-reader-runtime-failure'
        | 'unsupported-browser-version'
    }

export type ResumeTailoringFailure =
  | { readonly type: 'workflow-already-open' }
  | { readonly type: 'candidate-session-unavailable' }
  | SourceDocumentReadFailure
  | { readonly type: 'processing-notice-required' }
  | { readonly type: 'source-profile-extraction-unavailable' }
  | { readonly type: 'source-fact-unavailable' }
  | { readonly type: 'source-fact-conflict' }
  | { readonly type: 'candidate-fact-duplicate' }
  | { readonly type: 'candidate-fact-invalid' }
  | { readonly type: 'job-requirement-extraction-unavailable' }
  | { readonly type: 'job-requirement-transport-unavailable' }
  | { readonly type: 'match-analysis-unavailable' }
  | { readonly type: 'match-analysis-transport-unavailable' }
  | { readonly type: 'resume-claim-writing-unavailable' }
  | { readonly type: 'resume-claim-validation-unavailable' }
  | { readonly type: 'resume-claim-new-fact-confirmation-required' }
  | { readonly type: 'resume-claim-unavailable' }

export type ResumeTailoringResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: ResumeTailoringFailure }

export type ResumeTailoringWorkflow = {
  readonly execute: (
    command: ResumeTailoringCommand,
  ) => Promise<ResumeTailoringResult<ResumeTailoringView>>
  readonly readView: () => Promise<ResumeTailoringResult<ResumeTailoringView>>
  readonly subscribe: (
    listener: (result: ResumeTailoringResult<ResumeTailoringView>) => void,
  ) => () => void
}

export function hasSourceProfileFactConflict({
  fact,
  facts,
}: Readonly<{
  fact: SourceProfileFact
  facts: readonly SourceProfileFact[]
}>) {
  if (isClosedSourceProfileFact({ fact })) return false
  return facts.some((candidateFact) => candidateFact.id !== fact.id
    && candidateFact.propositionKey === fact.propositionKey
    && candidateFact.value !== fact.value
    && !isClosedSourceProfileFact({ fact: candidateFact }))
}

function isClosedSourceProfileFact({ fact }: Readonly<{ fact: SourceProfileFact }>) {
  return fact.status === 'rejected' || fact.status === 'superseded'
}
