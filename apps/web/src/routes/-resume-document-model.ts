import type { z } from 'zod'
import type { ResumeSectionModelFailure, ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import { failureResponse } from '../api-failure'
import type { ApiFailureType } from '../api-failure'
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
      : failureResponse({ type: apiFailureTypes[result.error.type], ...(result.usage === undefined ? {} : { usage: result.usage }) })
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

/** Processing consent is checked in the browser, so a server model never fails for want of it. */
const apiFailureTypes: Record<ResumeSectionModelFailure, ApiFailureType> = {
  timeout: 'timeout',
  transient: 'provider-unavailable',
  permanent: 'invalid-provider-response',
  'consent-required': 'invalid-input',
}

const privateHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
