import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createOpenAiJobPostingExtractor } from '../candidate-journey/openai-job-posting-extractor'
import { jobPostingExtractionRequestSchema } from '../candidate-journey/job-match-schemas'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'

export const Route = createFileRoute('/api/explainable-job-posting-extraction')({
  server: { middleware: [createCsrfMiddleware()], handlers: {
    POST: async ({ request }) => extractJobPosting({ request }),
  } },
})

async function extractJobPosting({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const bodyResult = await readRequestBody({ request })
  if (!bodyResult.ok) return failureResponse({ status: bodyResult.status })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ status: 503 })
  const extractor = createOpenAiJobPostingExtractor({
    apiKey: environmentResult.value.openAiApiKey,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await extractor.extract(bodyResult.value)
  return result.ok ? Response.json(result, { headers: privateHeaders }) : failureResponse({ status: 502 })
}

async function readRequestBody({ request }: Readonly<{ request: Request }>) {
  try {
    const parsed = jobPostingExtractionRequestSchema.safeParse(await request.json())
    return parsed.success
      ? { ok: true, value: parsed.data } as const
      : { ok: false, status: 400 } as const
  } catch {
    return { ok: false, status: 400 } as const
  }
}

function failureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json({ ok: false, error: 'job-posting-extraction-unavailable' }, {
    headers: privateHeaders, status,
  })
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
