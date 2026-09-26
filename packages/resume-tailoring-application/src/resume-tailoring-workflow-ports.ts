import type { ResumeTailoringState } from '@resume-tailoring/domain/resume-tailoring-state'

export type AdapterResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: { readonly type: 'adapter-unavailable' } }

export type CandidateSessionPersistence = {
  readonly read: () => Promise<AdapterResult<ResumeTailoringState>>
  readonly write: (
    state: ResumeTailoringState,
  ) => Promise<AdapterResult<ResumeTailoringState>>
}

export type PrivacySafeTelemetry = {
  readonly record: (
    event: 'resume-tailoring-opened',
  ) => Promise<AdapterResult<undefined>>
}
