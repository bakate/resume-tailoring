import { z } from 'zod'
import type { ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import type { ResumeCoherenceChecker, ResumeFieldValidator, ResumeSectionWriter } from '@resume-tailoring/application/ports'
import { resumeDocumentCoherenceSchema, resumeFieldValidationSchema, resumeModelUsageSchema, resumeSectionModelFailureSchema,
  resumeSectionOutputSchemas } from '../../candidate-journey/resume-document-schemas'

const resumeSectionContentSchema = z.union([
  z.strictObject({ kind: z.literal('value-proposition'), ...resumeSectionOutputSchemas['value-proposition'].shape }),
  z.strictObject({ kind: z.literal('experience'), experience: resumeSectionOutputSchemas.experience }),
  z.strictObject({ kind: z.literal('skills'), ...resumeSectionOutputSchemas.skills.shape }),
  z.strictObject({ kind: z.enum(['education', 'languages', 'projects', 'certifications']), ...resumeSectionOutputSchemas.education.shape }),
])

export function createBrowserResumeSectionWriter({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeSectionWriter {
  return { write: (input) => postResumeModel({ request, input, path: '/api/resume-section-writing', schema: resumeSectionContentSchema }) }
}

export function createBrowserResumeFieldValidator({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeFieldValidator {
  return { validate: (input) => postResumeModel({ request, input, path: '/api/resume-section-validation', schema: resumeFieldValidationSchema }) }
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
    const result = z.union([z.strictObject({ ok: z.literal(true), value: schema, usage: resumeModelUsageSchema.optional() }),
      resumeSectionModelFailureSchema]).safeParse(await response.json())
    if (!result.success) return permanent
    if (!response.ok && result.data.ok) return permanent
    return result.data
  } catch { return permanent }
}

const permanent = { ok: false, error: { type: 'permanent' } } as const
