import type {
  CandidateSessionId,
  ResumeTailoringState,
} from '@resume-tailoring/domain/resume-tailoring-state'

export type {
  CandidateSessionId,
  ResumeTailoringState,
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
