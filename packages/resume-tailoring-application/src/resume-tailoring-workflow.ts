import type {
  CandidateSessionId,
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileReview,
} from '@resume-tailoring/domain/resume-tailoring-state'

export type SourceDocument = Readonly<{
  bytes: Uint8Array
  mediaType: string
  name: string
}>

export const sourceProfileProcessingNoticeVersion = '2026-09-26'

export type ResumeTailoringCommand =
  | { readonly type: 'open-workflow' }
  | { readonly type: 'delete-session' }
  | { readonly type: 'import-source-document'; readonly document: SourceDocument }
  | { readonly type: 'update-source-content'; readonly outgoingContent: string }
  | { readonly type: 'confirm-processing-notice' }
  | { readonly type: 'extract-source-profile' }
  | { readonly type: 'confirm-source-fact'; readonly factId: SourceProfileFactId }
  | { readonly type: 'confirm-source-facts'; readonly factIds: readonly SourceProfileFactId[] }
  | { readonly type: 'reject-source-fact'; readonly factId: SourceProfileFactId }
  | {
      readonly type: 'correct-source-fact'
      readonly factId: SourceProfileFactId
      readonly correctedValue: string
    }
  | { readonly type: 'resolve-source-fact-conflict'; readonly selectedFactId: SourceProfileFactId }

export type ResumeTailoringView =
  | { readonly status: 'not-started' }
  | {
      readonly status: 'ready'
      readonly sessionId: CandidateSessionId
      readonly expiresAt: number
      readonly sourceProfile?: SourceProfileReview
    }

export type ResumeTailoringFailure =
  | { readonly type: 'workflow-already-open' }
  | { readonly type: 'candidate-session-unavailable' }
  | { readonly type: 'unsupported-source-document' }
  | { readonly type: 'unreadable-source-document' }
  | { readonly type: 'processing-notice-required' }
  | { readonly type: 'source-profile-extraction-unavailable' }
  | { readonly type: 'source-fact-unavailable' }
  | { readonly type: 'source-fact-conflict' }

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
