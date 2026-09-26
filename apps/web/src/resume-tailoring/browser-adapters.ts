import type {
  CandidateSessionClock,
  CandidateSessionIdentity,
  PrivacySafeTelemetry,
  SourceProfileFactIdentity,
  SourceProfileExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import { sourceProfileExtractionSuccessSchema } from './source-profile-schemas'

export { createBrowserCandidateSessionPersistence } from './candidate-session-indexed-db'
export { createBrowserSourceDocumentReader } from './source-document-pdf'

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

export function createBrowserSourceProfileFactIdentity(): SourceProfileFactIdentity {
  return {
    create: () => {
      try {
        return { ok: true, value: `source-fact-${crypto.randomUUID()}` }
      } catch {
        return unavailableResult
      }
    },
  }
}

export function createBrowserSourceProfileExtractor(): SourceProfileExtractor {
  return {
    extract: async ({ professionalContent }) => {
      try {
        const response = await fetch('/api/source-profile-extraction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ professionalContent }),
          cache: 'no-store',
        })
        if (!response.ok) return extractionUnavailableResult
        return parseExtractionResult({ value: await response.json() })
      } catch {
        return extractionUnavailableResult
      }
    },
  }
}

function parseExtractionResult({ value }: Readonly<{ value: unknown }>) {
  const result = sourceProfileExtractionSuccessSchema.safeParse(value)
  return result.success ? result.data : extractionUnavailableResult
}

const unavailableResult = {
  ok: false,
  error: { type: 'adapter-unavailable' },
} as const

const extractionUnavailableResult = {
  ok: false,
  error: { type: 'source-profile-extraction-unavailable' },
} as const
