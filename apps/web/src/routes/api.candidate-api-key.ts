import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { readOpenAiApiFailure } from '../adapters/server/openai-api-failure'
import { createOpenAiRequester } from '../adapters/server/openai-request'
import { failureResponse } from '../api-failure'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { readModelApiKey } from './-model-api-key'

export const Route = createFileRoute('/api/candidate-api-key')({
  server: { middleware: [createCsrfMiddleware()], handlers: {
    POST: async ({ request }) => validateCandidateApiKey({ request }),
  } },
})

/**
 * Validates a Candidate API Key on entry, at no cost: it reads the description of the model each role uses, so the
 * Candidate learns now, not mid-preparation, that the key is rejected or cannot reach a model.
 */
async function validateCandidateApiKey({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ type: 'service-misconfigured' })
  const apiKey = readModelApiKey({ environment: environmentResult.value, request })
  if (!apiKey.ok) return failureResponse({ type: apiKey.type })
  // Without the header there is no Candidate API Key to validate, and the operator key is never checked here.
  if (apiKey.value.source !== 'candidate') return failureResponse({ type: 'candidate-api-key-invalid' })
  const requester = createOpenAiRequester({ apiKey: apiKey.value })
  const { openAiStructuredModel, openAiWritingModel } = environmentResult.value
  for (const model of new Set([openAiStructuredModel, openAiWritingModel])) {
    const access = await requester.checkModelAccess({ model })
    if (!access.ok) return failureResponse(readOpenAiApiFailure(access.error))
  }
  return Response.json({ ok: true }, { headers: privateHeaders })
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
