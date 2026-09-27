import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import type { ZodError } from 'zod'

import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import { createOpenAiSourceProfileExtractor } from '../resume-tailoring/openai-source-profile-extractor'
import { sourceProfileExtractionRequestSchema } from '../resume-tailoring/source-profile-schemas'

export const Route = createFileRoute('/api/source-profile-extraction')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: {
      POST: async ({ request }) => extractSourceProfile({ request }),
    },
  },
})

async function extractSourceProfile({ request }: Readonly<{ request: Request }>) {
  const accessResponse = createDemoAccessGuardResponse({ request })
  if (accessResponse !== null) return accessResponse
  const professionalContentResult = await readProfessionalContent({ request })
  if (!professionalContentResult.ok) {
    return createFailureResponse({ status: professionalContentResult.status })
  }
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return createFailureResponse({ status: 503 })

  const extractor = createOpenAiSourceProfileExtractor({
    apiKey: environmentResult.value.openAiApiKey,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await extractor.extract({ professionalContent: professionalContentResult.value })
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : createFailureResponse({ status: 502 })
}

async function readProfessionalContent({ request }: Readonly<{ request: Request }>) {
  try {
    const body = await request.json() as unknown
    const result = sourceProfileExtractionRequestSchema.safeParse(body)
    if (result.success) return { ok: true, value: result.data.professionalContent } as const
    return isProfessionalContentTooLarge(result.error)
      ? oversizedProfessionalContentResult
      : invalidProfessionalContentResult
  } catch {
    return invalidProfessionalContentResult
  }
}

function isProfessionalContentTooLarge(error: ZodError) {
  return error.issues.some((issue) => issue.code === 'too_big'
    && issue.path.length === 1
    && issue.path[0] === 'professionalContent')
}

function createFailureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json(
    { ok: false, error: { type: 'source-profile-extraction-unavailable' } },
    { status, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

const invalidProfessionalContentResult = { ok: false, status: 400 } as const
const oversizedProfessionalContentResult = { ok: false, status: 413 } as const
