import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
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
  try {
    const body = await request.text()
    if (body.length > 3_000_000) return invalidRequest()
    const parsed = resumeRenderRequestSchema.safeParse(JSON.parse(body) as unknown)
    if (!parsed.success) return invalidRequest()
    const result = await renderResumeDocument(parsed.data)
    return Response.json({ ...result, pdf: result.pdf === null ? null
      : Buffer.from(result.pdf).toString('base64') }, { headers: privateHeaders })
  } catch {
    return invalidRequest()
  }
}

function invalidRequest() {
  return Response.json({ error: 'invalid-resume-document' }, { status: 400, headers: privateHeaders })
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
