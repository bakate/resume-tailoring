export type ResumeTailoringCommand = {
  readonly type: 'open-workflow'
}

export type ResumeTailoringView = {
  readonly status: 'not-started' | 'ready'
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
}
