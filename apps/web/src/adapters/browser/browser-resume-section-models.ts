import { z } from 'zod'
import type { ResumeSectionModelFailure, ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import type { ResumeCoherenceChecker, ResumeFieldValidator, ResumeSectionWriter } from '@resume-tailoring/application/ports'
import { apiFailureSchema } from '../../api-failure'
import type { ApiFailureType } from '../../api-failure'
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
  } catch { return { ok: false, error: { type: 'transient' } } }
}

async function readModelResponse<TValue>({ response, schema }: Readonly<{
  response: Response; schema: z.ZodType<TValue>
}>): Promise<ResumeSectionModelResult<TValue>> {
  try {
    const body: unknown = await response.json()
    if (!response.ok) return readModelFailure(body)
    const result = z.strictObject({ ok: z.literal(true), value: schema, usage: resumeModelUsageSchema.optional() }).safeParse(body)
    return result.success ? result.data : permanent
  } catch { return permanent }
}

function readModelFailure(body: unknown): ResumeSectionModelResult<never> {
  const failure = apiFailureSchema.safeParse(body)
  if (!failure.success) return permanent
  const { error, usage } = failure.data
  return { ok: false, error: { type: sectionModelFailures[error.type] ?? 'permanent' }, ...(usage === undefined ? {} : { usage }) }
}

/** Only failures a second attempt can overcome stay transient; the rest keep their current meaning. */
const sectionModelFailures: Partial<Record<ApiFailureType, ResumeSectionModelFailure>> = {
  timeout: 'timeout',
  'provider-unavailable': 'transient',
  'rate-limited': 'transient',
}

const permanent = { ok: false, error: { type: 'permanent' } } as const
