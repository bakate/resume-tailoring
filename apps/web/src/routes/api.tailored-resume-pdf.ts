import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { createOpenAiRequestDeadline } from '../resume-tailoring/openai-request'
import { createOpenAiResumeClaimSemanticValidator } from '../resume-tailoring/openai-resume-claim-service'
import { createTailoredResumePdf } from '../resume-tailoring/tailored-resume-pdf'
import { resumePdfRequestSchema } from '../resume-tailoring/tailored-resume-schemas'

export const Route = createFileRoute('/api/tailored-resume-pdf')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => exportTailoredResumePdf({ request }) },
  },
})

async function exportTailoredResumePdf({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const parsedRequest = await readRequest({ request })
  if (!parsedRequest.ok) return createInvalidRequestResponse()
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return createUnavailableResponse()
  const semanticValidator = createOpenAiResumeClaimSemanticValidator({
    apiKey: environment.value.openAiApiKey,
    deadlineSignal: createOpenAiRequestDeadline(),
    model: environment.value.openAiStructuredModel,
    operation: 'tailored-resume-pdf-validation',
    reasoningEffort: environment.value.openAiStructuredReasoningEffort,
  })
  const result = await createTailoredResumePdf({ inputs: parsedRequest.value, semanticValidator })
  if (!result.ok) return Response.json(result, { status: 422, headers: privateHeaders })
  return new Response(Buffer.from(result.value), {
    status: 200,
    headers: {
      ...privateHeaders,
      'Content-Disposition': 'attachment; filename="tailored-resume.pdf"',
      'Content-Type': 'application/pdf',
    },
  })
}

function createUnavailableResponse() {
  return Response.json(
    { ok: false, error: { type: 'resume-pdf-validation-unavailable' } },
    { status: 503, headers: privateHeaders },
  )
}

async function readRequest({ request }: Readonly<{ request: Request }>) {
  try {
    const result = resumePdfRequestSchema.safeParse(await request.json() as unknown)
    return result.success ? { ok: true, value: result.data } as const : invalidRequestResult
  } catch {
    return invalidRequestResult
  }
}

function createInvalidRequestResponse() {
  return Response.json(
    { ok: false, error: { type: 'resume-pdf-request-invalid' } },
    { status: 400, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidRequestResult = { ok: false } as const
