import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { createOpenAiResumeClaimSemanticValidator } from '../resume-tailoring/openai-resume-claim-service'
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
  if (!validationRequest.ok) return createFailureResponse({ status: 400 })
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return createFailureResponse({ status: 503 })
  const validator = createOpenAiResumeClaimSemanticValidator({
    apiKey: environment.value.openAiApiKey,
    model: environment.value.openAiStructuredModel,
    reasoningEffort: environment.value.openAiStructuredReasoningEffort,
  })
  const result = await validator.validate(validationRequest.value)
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : createFailureResponse({ status: 502 })
}

async function readValidationRequest({ request }: Readonly<{ request: Request }>) {
  try {
    const result = resumeClaimValidationRequestSchema.safeParse(await request.json() as unknown)
    return result.success ? { ok: true, value: result.data } as const : invalidResult
  } catch {
    return invalidResult
  }
}

function createFailureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json(
    { ok: false, error: { type: 'resume-claim-validation-unavailable' } },
    { status, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidResult = { ok: false } as const
