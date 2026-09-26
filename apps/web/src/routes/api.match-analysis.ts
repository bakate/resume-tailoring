import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { validateServerEnvironment } from '../env'
import { matchAnalysisRequestSchema } from '../resume-tailoring/match-analysis-schemas'
import { createOpenAiMatchEvidenceMatcher } from '../resume-tailoring/openai-match-evidence-matcher'

export const Route = createFileRoute('/api/match-analysis')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: {
      POST: async ({ request }) => analyzeMatch({ request }),
    },
  },
})

async function analyzeMatch({ request }: Readonly<{ request: Request }>) {
  const matchRequest = await readMatchRequest({ request })
  if (!matchRequest.ok) return createFailureResponse({ status: 400 })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return createFailureResponse({ status: 503 })
  const matcher = createOpenAiMatchEvidenceMatcher({
    apiKey: environmentResult.value.openAiApiKey,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await matcher.match(matchRequest.value)
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : createFailureResponse({ status: 502 })
}

async function readMatchRequest({ request }: Readonly<{ request: Request }>) {
  try {
    const result = matchAnalysisRequestSchema.safeParse(await request.json() as unknown)
    return result.success ? { ok: true, value: result.data } as const : invalidResult
  } catch {
    return invalidResult
  }
}

function createFailureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json(
    { ok: false, error: { type: 'match-analysis-unavailable' } },
    { status, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

const invalidResult = { ok: false } as const
