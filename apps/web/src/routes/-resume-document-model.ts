import type { z } from 'zod'
import type { ResumeSectionModelError, ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import { failureResponse } from '../api-failure'
import type { ApiFailure } from '../api-failure'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import type { ServerEnvironment } from '../env'

export async function processResumeModel<TInput>({ request, schema, processInput }: Readonly<{
  request: Request; schema: z.ZodType<TInput>
  processInput: (input: TInput, environment: ServerEnvironment) => Promise<ResumeSectionModelResult<unknown>>
}>) {
  const access = createDemoAccessGuardResponse({ request })
  if (access !== null) return access
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return failureResponse({ type: 'service-misconfigured' })
  const input = await readInput({ request, schema })
  if (!input.ok) return failureResponse({ type: input.type })
  try {
    const result = await processInput(input.value, environment.value)
    return result.ok
      ? Response.json(result, { headers: privateHeaders })
      : failureResponse({ ...readSectionModelApiFailure(result.error), ...(result.usage === undefined ? {} : { usage: result.usage }) })
  } catch { return failureResponse({ type: 'provider-unavailable' }) }
}

async function readInput<TInput>({ request, schema }: Readonly<{ request: Request; schema: z.ZodType<TInput> }>) {
  try {
    const text = await request.text()
    if (text.length > 500_000) return { ok: false, type: 'input-too-large' } as const
    const parsed = schema.safeParse(JSON.parse(text))
    return parsed.success ? { ok: true, value: parsed.data } as const : { ok: false, type: 'invalid-input' } as const
  } catch { return { ok: false, type: 'invalid-input' } as const }
}

/**
 * A server model fails with an API Failure. Processing consent is checked in the browser, so it never fails for want
 * of it, and only a browser adapter reads a network failure or an unexpected response.
 */
function readSectionModelApiFailure(error: ResumeSectionModelError): ApiFailure {
  if (error.type === 'consent-required') return { type: 'invalid-input' }
  if (error.type === 'network' || error.type === 'unexpected-response') return { type: 'provider-unavailable' }
  return error.retryAfterSeconds === undefined ? { type: error.type } : { type: error.type, retryAfterSeconds: error.retryAfterSeconds }
}

const privateHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
