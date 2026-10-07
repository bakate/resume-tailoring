import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { failureResponse } from '../api-failure'
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
  try {
    const body = await request.text()
    if (body.length > 3_000_000) return { ok: false, type: 'input-too-large' } as const
    const parsed = resumeRenderRequestSchema.safeParse(JSON.parse(body) as unknown)
    return parsed.success ? { ok: true, value: parsed.data } as const : { ok: false, type: 'invalid-input' } as const
  } catch {
    return { ok: false, type: 'invalid-input' } as const
  }
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
