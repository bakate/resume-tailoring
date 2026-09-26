import type { ResumeClaimWriter } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { validateServerEnvironment } from '../env'
import { createOpenAiResumeClaimWriter } from '../resume-tailoring/openai-resume-claim-service'
import { resumeClaimWritingRequestSchema } from '../resume-tailoring/resume-claim-schemas'

export const Route = createFileRoute('/api/resume-claim-writing')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => writeResumeClaims({ request }) },
  },
})

async function writeResumeClaims({ request }: Readonly<{ request: Request }>) {
  const writingRequest = await readWritingRequest({ request })
  if (!writingRequest.ok) return createFailureResponse({ status: 400 })
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return createFailureResponse({ status: 503 })
  const writer = createOpenAiResumeClaimWriter({
    apiKey: environment.value.openAiApiKey,
    model: environment.value.openAiWritingModel,
    reasoningEffort: environment.value.openAiWritingReasoningEffort,
  })
  const result = await useWriter({ request: writingRequest.value, writer })
  return result.ok
    ? Response.json({ ok: true, value: { claims: result.value } }, { headers: privateHeaders })
    : createFailureResponse({ status: 502 })
}

function useWriter({
  request,
  writer,
}: Readonly<{
  request: ReturnType<typeof resumeClaimWritingRequestSchema.parse>
  writer: ResumeClaimWriter
}>) {
  if (request.operation === 'write') return writer.write(request)
  return writer.reformulate(request).then((result) => result.ok
    ? { ok: true, value: [result.value] } as const
    : result)
}

async function readWritingRequest({ request }: Readonly<{ request: Request }>) {
  try {
    const result = resumeClaimWritingRequestSchema.safeParse(await request.json() as unknown)
    return result.success ? { ok: true, value: result.data } as const : invalidResult
  } catch {
    return invalidResult
  }
}

function createFailureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json(
    { ok: false, error: { type: 'resume-claim-writing-unavailable' } },
    { status, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidResult = { ok: false } as const
