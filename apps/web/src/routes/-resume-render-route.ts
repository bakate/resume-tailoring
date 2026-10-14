import type { ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { z } from 'zod'
import { failureResponse, privateHeaders } from '../api-failure'
import { apiRequestBodyLimits, readJsonRequestBody } from '../api-request-body'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'

/**
 * Answers a rendering route: demo access first, then the parsed body to `render`, whose render goes back with its PDF
 * in base64. A render the renderer could not complete answers as a timeout or an unavailable provider.
 */
export async function answerRenderRoute<TInput>({ request, schema, render }: Readonly<{
  request: Request
  schema: z.ZodType<TInput>
  render: (input: TInput) => Promise<Readonly<{ result: ResumeRenderResult; body: unknown }>>
}>) {
  const denied = createDemoAccessGuardResponse({ request })
  if (denied !== null) return denied
  const body = await readJsonRequestBody({ request, maxBytes: apiRequestBodyLimits.resumeDocument })
  if (!body.ok) return failureResponse({ type: body.type })
  const parsed = schema.safeParse(body.value)
  if (!parsed.success) return failureResponse({ type: 'invalid-input' })
  const rendered = await render(parsed.data)
  if (rendered.result.assessment.layout.status === 'unavailable') {
    return failureResponse({ type: rendered.result.failure?.cause.type === 'timeout' ? 'timeout' : 'provider-unavailable' })
  }
  return Response.json(rendered.body, { headers: privateHeaders })
}

/** A render as the browser reads it: its assessment, with the PDF in base64. */
export function encodeRender({ assessment, pdf }: ResumeRenderResult) {
  return { assessment, pdf: pdf === null ? null : Buffer.from(pdf).toString('base64') }
}
