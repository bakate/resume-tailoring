import {
  jobPostingExtractionSuccessSchema,
  matchEvidenceSuccessSchema,
} from '../../candidate-journey/job-match-schemas'
import type { JobPostingExtractor, MatchEvidenceMatcher } from '@resume-tailoring/application/ports'

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

async function postJson<TValue, TFailure>({
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
}>): Promise<Readonly<{ ok: true; value: TValue }> | TFailure> {
  try {
    const response = await request(path, {
      body: JSON.stringify(body),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) return failure
    const parsed = schema.safeParse(await response.json())
    return parsed.success && parsed.data !== undefined ? parsed.data : failure
  } catch {
    return failure
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
