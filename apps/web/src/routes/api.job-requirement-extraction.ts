import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import type { ZodError } from 'zod'

import { validateServerEnvironment } from '../env'
import {
  jobRequirementExtractionRequestSchema,
} from '../resume-tailoring/job-requirement-schemas'
import {
  createOpenAiJobRequirementExtractor,
} from '../resume-tailoring/openai-job-requirement-extractor'

export const Route = createFileRoute('/api/job-requirement-extraction')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: {
      POST: async ({ request }) => extractJobRequirements({ request }),
    },
  },
})

async function extractJobRequirements({ request }: Readonly<{ request: Request }>) {
  const contentResult = await readJobPostingContent({ request })
  if (!contentResult.ok) return createFailureResponse({ status: contentResult.status })
  const environmentResult = validateServerEnvironment({ environment: process.env })
  if (!environmentResult.ok) return createFailureResponse({ status: 503 })

  const extractor = createOpenAiJobRequirementExtractor({
    apiKey: environmentResult.value.openAiApiKey,
    model: environmentResult.value.openAiStructuredModel,
    reasoningEffort: environmentResult.value.openAiStructuredReasoningEffort,
  })
  const result = await extractor.extract({ jobPostingContent: contentResult.value })
  return result.ok
    ? Response.json(result, { headers: privateHeaders })
    : createFailureResponse({ status: 502 })
}

async function readJobPostingContent({ request }: Readonly<{ request: Request }>) {
  try {
    const result = jobRequirementExtractionRequestSchema.safeParse(await request.json() as unknown)
    if (result.success) return { ok: true, value: result.data.jobPostingContent } as const
    return isJobPostingTooLarge(result.error) ? oversizedResult : invalidResult
  } catch {
    return invalidResult
  }
}

function isJobPostingTooLarge(error: ZodError) {
  return error.issues.some((issue) => issue.code === 'too_big'
    && issue.path.length === 1
    && issue.path[0] === 'jobPostingContent')
}

function createFailureResponse({ status }: Readonly<{ status: number }>) {
  return Response.json(
    { ok: false, error: { type: 'job-requirement-extraction-unavailable' } },
    { status, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

const invalidResult = { ok: false, status: 400 } as const
const oversizedResult = { ok: false, status: 413 } as const
