export type CandidateSessionId = `candidate-session-${string}`

export type ResumeTailoringState =
  | { readonly status: 'not-started' }
  | {
      readonly status: 'ready'
      readonly sessionId: CandidateSessionId
      readonly expiresAt: number
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
