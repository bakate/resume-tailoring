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
  ResumeClaimIdentity,
  ResumeClaimSemanticValidator,
  ResumeClaimWriter,
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
import {
  hasOnlyResumeClaimInputReferences,
  resumeClaimValidationResultSchema,
  resumeClaimWritingResultSchema,
} from './resume-claim-schemas'

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

export function createBrowserResumeClaimIdentity(): ResumeClaimIdentity {
  return { create: () => createBrowserIdentity({ prefix: 'resume-claim-' }) }
}

export function createBrowserResumeClaimWriter({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): ResumeClaimWriter {
  return {
    write: (writingInputs) => writeBrowserResumeClaims({ request, writingInputs }),
    reformulate: (reformulation) => reformulateBrowserResumeClaim({ request, reformulation }),
  }
}

export function createBrowserResumeClaimSemanticValidator({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): ResumeClaimSemanticValidator {
  return {
    validate: (validationRequest) => requestResumeClaimValidation({ request, validationRequest }),
  }
}

async function writeBrowserResumeClaims({ request, writingInputs }: Readonly<{
  request: typeof fetch
  writingInputs: Parameters<ResumeClaimWriter['write']>[0]
}>) {
  const result = await requestResumeClaimWriting({
    request, value: { operation: 'write', ...writingInputs }, writingInputs,
  })
  return result.ok ? { ok: true, value: result.value.claims } as const : result
}

async function reformulateBrowserResumeClaim({ request, reformulation }: Readonly<{
  request: typeof fetch
  reformulation: Parameters<ResumeClaimWriter['reformulate']>[0]
}>) {
  const { claim, feedback, request: candidateRequest, ...writingInputs } = reformulation
  const value = {
    operation: 'reformulate', ...writingInputs, claim, feedback,
    ...(candidateRequest === undefined ? {} : { request: candidateRequest }),
  }
  const result = await requestResumeClaimWriting({ request, value, writingInputs })
  return result.ok && result.value.claims.length === 1
    ? { ok: true, value: result.value.claims[0] ?? claim } as const
    : resumeClaimWritingUnavailableResult
}

async function requestResumeClaimValidation({ request, validationRequest }: Readonly<{
  request: typeof fetch
  validationRequest: Parameters<ResumeClaimSemanticValidator['validate']>[0]
}>) {
  try {
    const response = await request('/api/resume-claim-validation', createJsonRequest(validationRequest))
    const result = resumeClaimValidationResultSchema.safeParse(await response.json())
    return result.success ? result.data : resumeClaimValidationUnavailableResult
  } catch {
    return resumeClaimValidationUnavailableResult
  }
}

async function requestResumeClaimWriting({
  request,
  value,
  writingInputs,
}: Readonly<{
  request: typeof fetch
  value: unknown
  writingInputs: Parameters<ResumeClaimWriter['write']>[0]
  }>) {
  try {
    const response = await request('/api/resume-claim-writing', createJsonRequest(value))
    const result = resumeClaimWritingResultSchema.safeParse(await response.json())
    if (!result.success || !result.data.ok) return resumeClaimWritingUnavailableResult
    return hasOnlyResumeClaimInputReferences({
      claims: result.data.value.claims,
      inputs: writingInputs,
    }) ? result.data : resumeClaimWritingUnavailableResult
  } catch {
    return resumeClaimWritingUnavailableResult
  }
}

function createJsonRequest(value: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    cache: 'no-store',
  } as const
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
  return hasOnlyMatchInputReferences({ ...matchRequest, analysis: result.data.value })
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

const resumeClaimWritingUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-writing-unavailable' },
} as const

const resumeClaimValidationUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-validation-unavailable' },
} as const
