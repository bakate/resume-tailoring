import { z } from 'zod'
import type { ResumeModelUsage, ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import type { ReadApiFailure, ResumeCoherenceChecker, ResumeFieldValidator, ResumeSectionWriter } from '@resume-tailoring/application/ports'
import { apiFailureSchema } from '../../api-failure'
import { networkFailure, readApiFailureBody, unexpectedResponse } from './api-failure-reader'
import { resumeDocumentCoherenceSchema, resumeFieldValidationResponseSchema, resumeModelUsageSchema, resumeSectionContentSchema,
} from '../../candidate-journey/resume-document-schemas'

export function createBrowserResumeSectionWriter({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeSectionWriter {
  return { write: (input) => postResumeModel({ request, input, path: '/api/resume-section-writing', schema: resumeSectionContentSchema }) }
}

export function createBrowserResumeFieldValidator({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeFieldValidator {
  return { validate: (input) => postResumeModel({ request, input: { ...input, namesUnsupportedPropositions: true },
    path: '/api/resume-section-validation', schema: resumeFieldValidationResponseSchema }) }
}

export function createBrowserResumeCoherenceChecker({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeCoherenceChecker {
  return { check: (input) => postResumeModel({ request, input, path: '/api/resume-document-coherence', schema: resumeDocumentCoherenceSchema }) }
}

async function postResumeModel<TValue>({ request, input, path, schema }: Readonly<{
  request: typeof fetch; input: unknown; path: string; schema: z.ZodType<TValue>
}>): Promise<ResumeSectionModelResult<TValue>> {
  try {
    const response = await request(path, { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    return await readModelResponse({ response, schema })
  } catch { return modelFailure({ apiFailure: networkFailure }) }
}

async function readModelResponse<TValue>({ response, schema }: Readonly<{
  response: Response; schema: z.ZodType<TValue>
}>): Promise<ResumeSectionModelResult<TValue>> {
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) return modelFailure({ apiFailure: readApiFailureBody({ response, body }), usage: readFailureUsage(body) })
  const result = z.strictObject({ ok: z.literal(true), value: schema, usage: resumeModelUsageSchema.optional() }).safeParse(body)
  return result.success ? result.data : modelFailure({ apiFailure: unexpectedResponse })
}

function modelFailure({ apiFailure, usage }: Readonly<{
  apiFailure: ReadApiFailure; usage?: ResumeModelUsage
}>): ResumeSectionModelResult<never> {
  return { ok: false, error: apiFailure, ...(usage === undefined ? {} : { usage }) }
}

/** A failed model call can still have billed tokens; the failure envelope reports them. */
function readFailureUsage(body: unknown) {
  const failure = apiFailureSchema.safeParse(body)
  return failure.success ? failure.data.usage : undefined
}
