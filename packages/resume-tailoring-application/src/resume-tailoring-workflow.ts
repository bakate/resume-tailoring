import type { CandidateSessionId } from '@resume-tailoring/domain/resume-tailoring-state'

export type ResumeTailoringCommand =
  | { readonly type: 'open-workflow' }
  | { readonly type: 'delete-session' }

export type ResumeTailoringView =
  | { readonly status: 'not-started' }
  | {
      readonly status: 'ready'
      readonly sessionId: CandidateSessionId
      readonly expiresAt: number
    }

export type ResumeTailoringFailure =
  | { readonly type: 'workflow-already-open' }
  | { readonly type: 'candidate-session-unavailable' }

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
