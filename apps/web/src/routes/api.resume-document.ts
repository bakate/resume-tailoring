import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { failureResponse } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { renderResumeDocument } from '../adapters/server/resume-document-renderer'
import { resumeRenderRequestSchema } from '../candidate-journey/resume-render-schema'

export const Route = createFileRoute('/api/resume-document')({
  server: { middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => renderDocumentResponse({ request }) } },
})

async function renderDocumentResponse({ request }: Readonly<{ request: Request }>) {
  const denied = createDemoAccessGuardResponse({ request })
  if (denied !== null) return denied
  const renderRequest = await readRenderRequest({ request })
  if (!renderRequest.ok) return failureResponse({ type: renderRequest.type })
  const result = await renderResumeDocument(renderRequest.value)
  if (result.assessment.layout.status === 'unavailable') return failureResponse({ type: 'provider-unavailable' })
  return Response.json({ ...result, pdf: result.pdf === null ? null
    : Buffer.from(result.pdf).toString('base64') }, { headers: privateHeaders })
}

async function readRenderRequest({ request }: Readonly<{ request: Request }>) {
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.resumeDocument })
  if (!body.ok) return body
  const parsed = resumeRenderRequestSchema.safeParse(body.value)
  return parsed.success ? { ok: true, value: parsed.data } as const : { ok: false, type: 'invalid-input' } as const
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
