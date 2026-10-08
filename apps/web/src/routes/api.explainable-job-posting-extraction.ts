import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { requestOpenAiJobPostingExtraction } from '../adapters/server/openai-job-posting-extractor'
import { jobPostingExtractionRequestSchema } from '../candidate-journey/job-match-schemas'
import { failureResponse } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { readOpenAiApiFailure } from '../adapters/server/openai-api-failure'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { readModelApiKey } from './-model-api-key'

export const Route = createFileRoute('/api/explainable-job-posting-extraction')({
  server: { middleware: [createCsrfMiddleware()], handlers: {
    POST: async ({ request }) => extractJobPosting({ request }),
  } },
})

async function extractJobPosting({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const bodyResult = await readRequestBody({ request })
  if (!bodyResult.ok) return failureResponse({ type: bodyResult.type })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ type: 'service-misconfigured' })
  const apiKey = readModelApiKey({ environment: environmentResult.value, request })
  if (!apiKey.ok) return failureResponse({ type: apiKey.type })
  const result = await requestOpenAiJobPostingExtraction({
    apiKey: apiKey.value,
    jobPostingContent: bodyResult.value.jobPostingContent,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : failureResponse(readOpenAiApiFailure(result.error))
}

async function readRequestBody({ request }: Readonly<{ request: Request }>) {
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.modelRequest })
  if (!body.ok) return body
  const parsed = jobPostingExtractionRequestSchema.safeParse(body.value)
  return parsed.success
    ? { ok: true, value: parsed.data } as const
    : { ok: false, type: 'invalid-input' } as const
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
