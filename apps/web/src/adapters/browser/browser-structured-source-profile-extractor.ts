import { structuredSourceProfileSuccessSchema } from '../../candidate-journey/structured-source-profile-schema'
import type { ReadApiFailure, StructuredSourceProfileExtractor } from '@resume-tailoring/application/ports'
import { networkFailure, readApiFailure, unexpectedResponse } from './api-failure-reader'

export function createBrowserStructuredSourceProfileExtractor({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): StructuredSourceProfileExtractor {
  return {
    extract: ({ professionalContent }) => extractStructuredSourceProfile({
      professionalContent,
      request,
    }),
  }
}

async function extractStructuredSourceProfile({
  professionalContent,
  request,
}: Readonly<{ professionalContent: string; request: typeof fetch }>) {
  try {
    const response = await request('/api/structured-source-profile-extraction', {
      body: JSON.stringify({ professionalContent }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) return unavailableResult(await readApiFailure(response))
    const result = structuredSourceProfileSuccessSchema.safeParse(await response.json().catch(() => undefined))
    return result.success ? result.data : unavailableResult(unexpectedResponse)
  } catch {
    return unavailableResult(networkFailure)
  }
}

function unavailableResult(apiFailure: ReadApiFailure) {
  return { ok: false, error: 'source-profile-extraction-unavailable', apiFailure } as const
}
