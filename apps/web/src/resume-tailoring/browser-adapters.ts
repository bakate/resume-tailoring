import type {
  CandidateSessionClock,
  CandidateSessionIdentity,
  PrivacySafeTelemetry,
  SourceProfileFactIdentity,
  SourceProfileExtractor,
  JobRequirementExtractor,
  JobRequirementGroupIdentity,
  JobRequirementIdentity,
  MatchEvidenceMatcher,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import {
  hasOnlyJobPostingSourceExcerpts,
  jobRequirementExtractionResultSchema,
} from './job-requirement-schemas'
import { sourceProfileExtractionSuccessSchema } from './source-profile-schemas'
import {
  hasOnlyMatchInputReferences,
  matchAnalysisResultSchema,
} from './match-analysis-schemas'

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

export function createBrowserJobRequirementIdentity(): JobRequirementIdentity {
  return {
    create: () => createBrowserIdentity({ prefix: 'job-requirement-' }),
  }
}

export function createBrowserJobRequirementGroupIdentity(): JobRequirementGroupIdentity {
  return {
    create: () => createBrowserIdentity({ prefix: 'job-requirement-group-' }),
  }
}

export function createBrowserMatchEvidenceMatcher({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): MatchEvidenceMatcher {
  return {
    match: (matchRequest) => requestMatchEvidence({ matchRequest, request }),
  }
}

async function requestMatchEvidence({
  matchRequest,
  request,
}: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  request: typeof fetch
}>) {
  try {
    const response = await request('/api/match-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(matchRequest),
      cache: 'no-store',
    })
    return parseMatchAnalysisResult({ matchRequest, value: await response.json() })
  } catch {
    return matchAnalysisTransportUnavailableResult
  }
}

function parseMatchAnalysisResult({
  matchRequest,
  value,
}: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  value: unknown
}>) {
  const result = matchAnalysisResultSchema.safeParse(value)
  if (!result.success) return matchAnalysisTransportUnavailableResult
  if (!result.data.ok) return result.data
  return hasOnlyMatchInputReferences({ ...matchRequest, evidence: result.data.value })
    ? result.data
    : matchAnalysisTransportUnavailableResult
}

function createBrowserIdentity<TPrefix extends string>({ prefix }: Readonly<{
  prefix: TPrefix
}>) {
  try {
    return { ok: true, value: `${prefix}${crypto.randomUUID()}` as `${TPrefix}${string}` } as const
  } catch {
    return unavailableResult
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

export function createBrowserJobRequirementExtractor({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): JobRequirementExtractor {
  return {
    extract: ({ jobPostingContent }) => extractJobRequirements({ jobPostingContent, request }),
  }
}

async function extractJobRequirements({
  jobPostingContent,
  request,
}: Readonly<{ jobPostingContent: string; request: typeof fetch }>) {
  try {
    const response = await request('/api/job-requirement-extraction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobPostingContent }),
      cache: 'no-store',
    })
    return parseJobRequirementExtractionResult({
      jobPostingContent, value: await response.json(),
    })
  } catch {
    return requirementTransportUnavailableResult
  }
}

function parseJobRequirementExtractionResult({
  jobPostingContent,
  value,
}: Readonly<{ jobPostingContent: string; value: unknown }>) {
  const result = jobRequirementExtractionResultSchema.safeParse(value)
  if (!result.success) return requirementTransportUnavailableResult
  if (!result.data.ok) return result.data
  return hasOnlyJobPostingSourceExcerpts({
    jobPostingContent, requirements: result.data.value,
  }) ? result.data : requirementTransportUnavailableResult
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

const requirementTransportUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-transport-unavailable' },
} as const

const matchAnalysisTransportUnavailableResult = {
  ok: false,
  error: { type: 'match-analysis-transport-unavailable' },
} as const
