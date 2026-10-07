import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { failureResponse } from '../api-failure'
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
  try {
    const result = recordPrivacySafeAnalytics({
      value: await request.json() as unknown,
      writeEvent: writePrivacySafeAnalyticsEvent,
    })
    return result.ok
      ? new Response(null, { status: 202, headers: privateHeaders })
      : failureResponse({ type: 'invalid-input' })
  } catch {
    return failureResponse({ type: 'invalid-input' })
  }
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
