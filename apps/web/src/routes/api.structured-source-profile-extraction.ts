import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createOpenAiStructuredSourceProfileExtractor } from '../adapters/server/openai-structured-source-profile-extractor'
import { structuredSourceProfileRequestSchema } from '../candidate-journey/structured-source-profile-schema'
import { failureResponse } from '../api-failure'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'

export const Route = createFileRoute('/api/structured-source-profile-extraction')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: {
      POST: async ({ request }) => extractStructuredSourceProfile({ request }),
    },
  },
})

async function extractStructuredSourceProfile({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const contentResult = await readProfessionalContent({ request })
  if (!contentResult.ok) return failureResponse({ type: contentResult.type })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ type: 'service-misconfigured' })
  const extractor = createOpenAiStructuredSourceProfileExtractor({
    apiKey: environmentResult.value.openAiApiKey,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await extractor.extract({ professionalContent: contentResult.value })
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : failureResponse({ type: 'provider-unavailable' })
}

async function readProfessionalContent({ request }: Readonly<{ request: Request }>) {
  try {
    const result = structuredSourceProfileRequestSchema.safeParse(await request.json())
    if (result.success) return { ok: true, value: result.data.professionalContent } as const
    const isOversized = result.error.issues.some(
      (issue) => issue.code === 'too_big' && issue.path[0] === 'professionalContent',
    )
    return { ok: false, type: isOversized ? 'input-too-large' : 'invalid-input' } as const
  } catch {
    return { ok: false, type: 'invalid-input' } as const
  }
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
