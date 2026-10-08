import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { failureResponse } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { createOpenAiResumeClaimReformulator } from '../adapters/server/openai-resume-claim-service'
import { resumeClaimWritingRequestSchema } from '../resume-tailoring/resume-claim-schemas'
import type { ResumeClaimReformulator } from '@resume-tailoring/application/ports'

export const Route = createFileRoute('/api/resume-claim-writing')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => writeResumeClaims({ request }) },
  },
})

async function writeResumeClaims({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const writingRequest = await readWritingRequest({ request })
  if (!writingRequest.ok) return failureResponse({ type: writingRequest.type })
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return failureResponse({ type: 'service-misconfigured' })
  const reformulator = createOpenAiResumeClaimReformulator({
    apiKey: environment.value.openAiApiKey,
    model: environment.value.openAiWritingModel,
    reasoningEffort: environment.value.openAiWritingReasoningEffort,
  })
  const result = await reformulateResumeClaim({ request: writingRequest.value, reformulator })
  return result.ok
    ? Response.json({ ok: true, value: { claims: result.value } }, { headers: privateHeaders })
    : failureResponse({ type: 'provider-unavailable' })
}

function reformulateResumeClaim({
  request,
  reformulator,
}: Readonly<{
  request: ReturnType<typeof resumeClaimWritingRequestSchema.parse>
  reformulator: ResumeClaimReformulator
}>) {
  return reformulator.reformulate(request).then((result) => result.ok
    ? { ok: true, value: [result.value] } as const
    : result)
}

async function readWritingRequest({ request }: Readonly<{ request: Request }>) {
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.modelRequest })
  if (!body.ok) return body
  const result = resumeClaimWritingRequestSchema.safeParse(body.value)
  return result.success ? { ok: true, value: result.data } as const : invalidResult
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidResult = { ok: false, type: 'invalid-input' } as const
