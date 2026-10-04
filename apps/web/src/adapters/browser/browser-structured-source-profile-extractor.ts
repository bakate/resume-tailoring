import { structuredSourceProfileSuccessSchema } from '../../candidate-journey/structured-source-profile-schema'
import type { StructuredSourceProfileExtractor } from '@resume-tailoring/application/ports'

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
    if (!response.ok) return unavailableResult
    const result = structuredSourceProfileSuccessSchema.safeParse(await response.json())
    return result.success ? result.data : unavailableResult
  } catch {
    return unavailableResult
  }
}

const unavailableResult = {
  ok: false,
  error: 'source-profile-extraction-unavailable',
} as const
