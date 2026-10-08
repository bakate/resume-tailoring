import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { failureResponse } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import {
  recordPrivacySafeAnalytics,
  writePrivacySafeAnalyticsEvent,
} from '../resume-tailoring/privacy-safe-analytics-observability'

export const Route = createFileRoute('/api/analytics')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => recordAnalytics({ request }) },
  },
})

async function recordAnalytics({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.analytics })
  if (!body.ok) return failureResponse({ type: body.type })
  const result = recordPrivacySafeAnalytics({
    value: body.value,
    writeEvent: writePrivacySafeAnalyticsEvent,
  })
  return result.ok
    ? new Response(null, { status: 202, headers: privateHeaders })
    : failureResponse({ type: 'invalid-input' })
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
