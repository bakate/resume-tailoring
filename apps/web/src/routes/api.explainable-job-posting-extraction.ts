import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { requestOpenAiJobPostingExtraction } from '../candidate-journey/openai-job-posting-extractor'
import { jobPostingExtractionRequestSchema } from '../candidate-journey/job-match-schemas'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { createOpenAiFailureResponse } from './-openai-failure-response'

export const Route = createFileRoute('/api/explainable-job-posting-extraction')({
  server: { middleware: [createCsrfMiddleware()], handlers: {
    POST: async ({ request }) => extractJobPosting({ request }),
  } },
})

async function extractJobPosting({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const bodyResult = await readRequestBody({ request })
  if (!bodyResult.ok) return failureResponse({ error: 'job-posting-extraction-invalid-input', retryable: false, status: bodyResult.status })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ error: 'service-unavailable', retryable: true, status: 503 })
  const result = await requestOpenAiJobPostingExtraction({
    apiKey: environmentResult.value.openAiApiKey,
    jobPostingContent: bodyResult.value.jobPostingContent,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : createOpenAiFailureResponse({ failure: result.error, operation: 'job-posting-extraction' })
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

function failureResponse({ error, retryable, status }: Readonly<{ error: string; retryable: boolean; status: number }>) {
  return Response.json({ ok: false, error, retryable }, {
    headers: privateHeaders, status,
  })
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
