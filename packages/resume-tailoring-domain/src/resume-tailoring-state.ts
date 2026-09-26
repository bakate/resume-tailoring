export type ResumeTailoringState =
  | { readonly status: 'not-started' }
  | { readonly status: 'ready' }

export type DomainResult<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError }

export type ResumeTailoringDomainError = {
  readonly type: 'workflow-already-open'
}

export const initialResumeTailoringState = {
  status: 'not-started',
} as const satisfies ResumeTailoringState

export function openResumeTailoringWorkflow({
  currentState,
}: Readonly<{
  currentState: ResumeTailoringState
}>): DomainResult<ResumeTailoringState, ResumeTailoringDomainError> {
  if (currentState.status === 'ready') {
    return {
      ok: false,
      error: { type: 'workflow-already-open' },
    }
  }

  return {
    ok: true,
    value: { status: 'ready' },
  }
}
