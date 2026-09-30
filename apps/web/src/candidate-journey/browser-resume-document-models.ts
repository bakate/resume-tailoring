import { z } from 'zod'
import type { ResumeDocumentWriter, ResumeDocumentValidator } from '@resume-tailoring/application/candidate-journey'
import { professionalResumeDocumentSchema, resumeDocumentValidationSchema, resumeModelFailureSchema } from './resume-document-schemas'

export function createBrowserResumeDocumentWriter({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeDocumentWriter {
  return { write: (input) => postResumeModel({ request, input, path: '/api/resume-document-writing', schema: professionalResumeDocumentSchema }) }
}

export function createBrowserResumeDocumentValidator({ request = fetch }: Readonly<{ request?: typeof fetch }> = {}): ResumeDocumentValidator {
  return { validate: (input) => postResumeModel({ request, input, path: '/api/resume-document-validation', schema: resumeDocumentValidationSchema }) }
}

async function postResumeModel<TValue>({ request, input, path, schema }: Readonly<{
  request: typeof fetch; input: unknown; path: string; schema: z.ZodType<TValue>
}>) {
  try {
    const response = await request(path, { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    return await readModelResponse({ response, schema })
  } catch { return { ok: false, error: { type: 'unavailable', transient: true } } as const }
}

async function readModelResponse<TValue>({ response, schema }: Readonly<{ response: Response; schema: z.ZodType<TValue> }>) {
  try {
    const result = z.union([z.strictObject({ ok: z.literal(true), value: schema }), resumeModelFailureSchema])
      .safeParse(await response.json())
    if (!response.ok) return result.success && !result.data.ok ? result.data : unavailable
    return result.success ? result.data : unavailable
  } catch { return unavailable }
}

const unavailable = { ok: false, error: { type: 'unavailable' } } as const
