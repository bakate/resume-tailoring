import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { failureResponse } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { createOpenAiResumeClaimSemanticValidator } from '../adapters/server/openai-resume-claim-service'
import { resumeClaimValidationRequestSchema } from '../resume-tailoring/resume-claim-schemas'

export const Route = createFileRoute('/api/resume-claim-validation')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => validateResumeClaim({ request }) },
  },
})

async function validateResumeClaim({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const validationRequest = await readValidationRequest({ request })
  if (!validationRequest.ok) return failureResponse({ type: validationRequest.type })
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return failureResponse({ type: 'service-misconfigured' })
  const validator = createOpenAiResumeClaimSemanticValidator({
    apiKey: environment.value.openAiApiKey,
    model: environment.value.openAiStructuredModel,
    reasoningEffort: environment.value.openAiStructuredReasoningEffort,
  })
  const result = await validator.validate(validationRequest.value)
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : failureResponse({ type: 'provider-unavailable' })
}

async function readValidationRequest({ request }: Readonly<{ request: Request }>) {
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.modelRequest })
  if (!body.ok) return body
  const result = resumeClaimValidationRequestSchema.safeParse(body.value)
  return result.success ? { ok: true, value: result.data } as const : invalidResult
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidResult = { ok: false, type: 'invalid-input' } as const
