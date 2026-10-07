import { z } from 'zod'

import { resumeModelUsageSchema } from './candidate-journey/resume-document-schemas'

/**
 * The closed catalogue of API Failure types every route answers with. A type names what went wrong, never the
 * operation: the route already identifies the operation.
 */
export const apiFailureStatuses = {
  'demo-access-required': 401,
  'demo-origin-required': 403,
  'demo-access-unavailable': 503,
  'invalid-input': 400,
  'input-too-large': 413,
  'rate-limited': 429,
  timeout: 504,
  'provider-unavailable': 502,
  'invalid-provider-response': 502,
  'service-misconfigured': 503,
} as const

export type ApiFailureType = keyof typeof apiFailureStatuses
export type ApiFailure = Readonly<{ type: ApiFailureType; retryAfterSeconds?: number }>

const apiFailureTypes = Object.keys(apiFailureStatuses) as [ApiFailureType, ...ApiFailureType[]]

/** A section model call can fail after the provider billed tokens, so the envelope may carry that usage. */
export const apiFailureSchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({ type: z.enum(apiFailureTypes), retryAfterSeconds: z.number().int().min(0).optional() }),
  usage: resumeModelUsageSchema.optional(),
})

export function failureResponse({ type, retryAfterSeconds, usage }: ApiFailure & Readonly<{
  usage?: z.infer<typeof resumeModelUsageSchema>
}>) {
  const headers = retryAfterSeconds === undefined
    ? privateHeaders
    : { ...privateHeaders, 'Retry-After': String(retryAfterSeconds) }
  return Response.json({
    ok: false,
    error: { type, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) },
    ...(usage === undefined ? {} : { usage }),
  }, { headers, status: apiFailureStatuses[type] })
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
