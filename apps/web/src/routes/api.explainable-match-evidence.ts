import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createOpenAiJobMatchEvidenceMatcher } from '../candidate-journey/openai-job-match-evidence-matcher'
import { matchEvidenceRequestSchema } from '../candidate-journey/job-match-schemas'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'

export const Route = createFileRoute('/api/explainable-match-evidence')({
  server: { middleware: [createCsrfMiddleware()], handlers: {
    POST: async ({ request }) => matchEvidence({ request }),
  } },
})

async function matchEvidence({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const bodyResult = await readRequestBody({ request })
  if (!bodyResult.ok) return failureResponse({ status: 400 })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ status: 503 })
  const matcher = createOpenAiJobMatchEvidenceMatcher({
    apiKey: environmentResult.value.openAiApiKey,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await matcher.match(bodyResult.value)
  return result.ok ? Response.json(result, { headers: privateHeaders }) : failureResponse({ status: 502 })
}

async function readRequestBody({ request }: Readonly<{ request: Request }>) {
  try {
    const parsed = matchEvidenceRequestSchema.safeParse(await request.json())
    return parsed.success
      ? { ok: true, value: parsed.data } as const
      : { ok: false } as const
  } catch {
    return { ok: false } as const
  }
}

function failureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json({ ok: false, error: 'match-evidence-unavailable' }, {
    headers: privateHeaders, status,
  })
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const
