import type { ResumeTailoringView } from '@resume-tailoring/application/resume-tailoring-workflow'

type AdapterResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: { readonly type: 'adapter-unavailable' } }

export function createBrowserCandidateSessionPersistence() {
  let currentState: ResumeTailoringView = { status: 'not-started' }

  return {
    read: (): Promise<AdapterResult<ResumeTailoringView>> =>
      Promise.resolve({
        ok: true,
        value: currentState,
      }),
    write: (
      state: ResumeTailoringView,
    ): Promise<AdapterResult<ResumeTailoringView>> => {
      currentState = state
      return Promise.resolve({ ok: true, value: currentState })
    },
  }
}

export function createPrivacySafeBrowserTelemetry() {
  return {
    record: (): Promise<AdapterResult<undefined>> =>
      Promise.resolve({
        ok: true,
        value: undefined,
      }),
  }
}
