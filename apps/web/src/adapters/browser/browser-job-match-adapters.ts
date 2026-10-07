import {
  jobPostingExtractionSuccessSchema,
  matchEvidenceSuccessSchema,
} from '../../candidate-journey/job-match-schemas'
import type { JobPostingExtractor, MatchEvidenceMatcher, ReadApiFailure } from '@resume-tailoring/application/ports'
import { networkFailure, readApiFailure, unexpectedResponse } from './api-failure-reader'

export function createBrowserJobPostingExtractor({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): JobPostingExtractor {
  return { extract: ({ jobPostingContent }) => postJson({
    body: { jobPostingContent },
    failure: extractionUnavailableResult,
    path: '/api/explainable-job-posting-extraction',
    request,
    schema: jobPostingExtractionSuccessSchema,
  }) }
}

export function createBrowserJobMatchEvidenceMatcher({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): MatchEvidenceMatcher {
  return { match: (body) => postJson({
    body,
    failure: evidenceUnavailableResult,
    path: '/api/explainable-match-evidence',
    request,
    schema: matchEvidenceSuccessSchema,
  }) }
}

async function postJson<TValue, TFailure extends Readonly<{ ok: false }>>({
  body, failure, path, request, schema,
}: Readonly<{
  body: unknown
  failure: TFailure
  path: string
  request: typeof fetch
  schema: Readonly<{ safeParse: (value: unknown) => Readonly<{
    success: boolean
    data?: Readonly<{ ok: true; value: TValue }>
  }> }>
}>): Promise<Readonly<{ ok: true; value: TValue }> | TFailure & Readonly<{ apiFailure: ReadApiFailure }>> {
  try {
    const response = await request(path, {
      body: JSON.stringify(body),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) return { ...failure, apiFailure: await readApiFailure(response) }
    const parsed = schema.safeParse(await response.json().catch(() => undefined))
    return parsed.success && parsed.data !== undefined ? parsed.data : { ...failure, apiFailure: unexpectedResponse }
  } catch {
    return { ...failure, apiFailure: networkFailure }
  }
}

const extractionUnavailableResult = {
  ok: false,
  error: 'job-posting-extraction-unavailable',
} as const
const evidenceUnavailableResult = {
  ok: false,
  error: 'match-evidence-unavailable',
} as const
