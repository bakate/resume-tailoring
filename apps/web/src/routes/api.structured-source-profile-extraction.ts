import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createOpenAiStructuredSourceProfileExtractor } from '../adapters/server/openai-structured-source-profile-extractor'
import { structuredSourceProfileRequestSchema } from '../candidate-journey/structured-source-profile-schema'
import { failureResponse } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { readModelApiKey } from './-model-api-key'

export const Route = createFileRoute('/api/structured-source-profile-extraction')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: {
      POST: async ({ request }) => extractStructuredSourceProfile({ request }),
    },
  },
})

async function extractStructuredSourceProfile({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const contentResult = await readProfessionalContent({ request })
  if (!contentResult.ok) return failureResponse({ type: contentResult.type })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ type: 'service-misconfigured' })
  const apiKey = readModelApiKey({ environment: environmentResult.value, request })
  if (!apiKey.ok) return failureResponse({ type: apiKey.type })
  const extractor = createOpenAiStructuredSourceProfileExtractor({
    apiKey: apiKey.value,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await extractor.extract({ professionalContent: contentResult.value })
  if (result.ok) return Response.json(result, { headers: privateHeaders })
  // Only a browser adapter reads a network failure or an unexpected response.
  const apiFailure = result.apiFailure
  return failureResponse(apiFailure === undefined || apiFailure.type === 'network' || apiFailure.type === 'unexpected-response'
    ? { type: 'provider-unavailable' } : { ...apiFailure, type: apiFailure.type })
}

async function readProfessionalContent({ request }: Readonly<{ request: Request }>) {
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.modelRequest })
  if (!body.ok) return body
  const result = structuredSourceProfileRequestSchema.safeParse(body.value)
  if (result.success) return { ok: true, value: result.data.professionalContent } as const
  const isOversized = result.error.issues.some(
    (issue) => issue.code === 'too_big' && issue.path[0] === 'professionalContent',
  )
  return { ok: false, type: isOversized ? 'input-too-large' : 'invalid-input' } as const
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
