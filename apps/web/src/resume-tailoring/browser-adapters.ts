import type {
  CandidateSessionClock,
  CandidateSessionIdentity,
  PrivacySafeTelemetry,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

export { createBrowserCandidateSessionPersistence } from './candidate-session-indexed-db'

export function createBrowserCandidateSessionClock(): CandidateSessionClock {
  return {
    now: () => Date.now(),
    scheduleExpiration: ({ expiresAt, onExpire }) => {
      const timeout = window.setTimeout(() => {
        void onExpire()
      }, Math.max(0, expiresAt - Date.now()))
      return () => {
        window.clearTimeout(timeout)
      }
    },
  }
}

export function createBrowserCandidateSessionIdentity(): CandidateSessionIdentity {
  return {
    create: () => {
      try {
        return { ok: true, value: `candidate-session-${crypto.randomUUID()}` }
      } catch {
        return unavailableResult
      }
    },
  }
}

export function createPrivacySafeBrowserTelemetry(): PrivacySafeTelemetry {
  return {
    record: () => Promise.resolve({ ok: true, value: undefined }),
  }
}

const unavailableResult = {
  ok: false,
  error: { type: 'adapter-unavailable' },
} as const
