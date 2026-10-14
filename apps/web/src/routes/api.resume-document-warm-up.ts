import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { failureResponse, privateHeaders } from '../api-failure'
import type { ApiFailureType } from '../api-failure'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { warmUpResumeDocumentRenderer } from '../adapters/server/resume-document-renderer'
import type { RenderWarmUp } from '../adapters/server/resume-document-renderer'

/**
 * Launches the rendering browser while Resume Sections are written, so the first render starts at layout. It reads no
 * body and renders nothing, so it carries no Candidate content and is not a render. It answers once the browser is
 * ready: Lambda freezes the execution environment after the response, which would freeze a launch still running.
 */
export const Route = createFileRoute('/api/resume-document-warm-up')({
  server: { middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => warmUpResponse({ request }) } },
})

async function warmUpResponse({ request }: Readonly<{ request: Request }>) {
  const denied = createDemoAccessGuardResponse({ request })
  if (denied !== null) return denied
  const warmUp = await warmUpResumeDocumentRenderer()
  return warmUp === 'ready' ? new Response(null, { status: 204, headers: privateHeaders })
    : failureResponse({ type: failureTypeByWarmUp[warmUp] })
}

const failureTypeByWarmUp = {
  timeout: 'timeout',
  unavailable: 'provider-unavailable',
} as const satisfies Record<Exclude<RenderWarmUp, 'ready'>, ApiFailureType>
