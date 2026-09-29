import type { OpenAiRequestFailure } from '../resume-tailoring/openai-request'

type OpenAiRouteFailure = OpenAiRequestFailure | Readonly<{
  type: 'invalid-model-output' | 'request-too-large'
  characterCount?: number
  maximumCharacterCount?: number
}>

type OpenAiRouteOperation = 'job-posting-extraction' | 'match-evidence'

export function createOpenAiFailureResponse({
  failure,
  operation,
}: Readonly<{
  failure: OpenAiRouteFailure
  operation: OpenAiRouteOperation
}>) {
  const error = readPublicError({ failure, operation })
  const headers = failure.type === 'rate-limited' && failure.retryAfter !== undefined
    ? { ...privateHeaders, 'Retry-After': failure.retryAfter }
    : privateHeaders
  return Response.json({ ok: false, error: error.code, retryable: error.retryable }, {
    headers,
    status: error.status,
  })
}

function readPublicError({
  failure,
  operation,
}: Readonly<{
  failure: OpenAiRouteFailure
  operation: OpenAiRouteOperation
}>) {
  if (failure.type === 'request-too-large') {
    return { code: `${operation}-input-too-large`, retryable: false, status: 413 } as const
  }
  if (failure.type === 'timeout') {
    return { code: `${operation}-timeout`, retryable: true, status: 504 } as const
  }
  if (failure.type === 'rate-limited') {
    return { code: `${operation}-rate-limited`, retryable: true, status: 429 } as const
  }
  if (failure.type === 'invalid-model-output' || failure.type === 'invalid-response') {
    return { code: `${operation}-invalid-provider-response`, retryable: true, status: 502 } as const
  }
  if (failure.type === 'upstream-invalid-request') {
    return { code: `${operation}-provider-request-rejected`, retryable: false, status: 502 } as const
  }
  return { code: `${operation}-provider-unavailable`, retryable: true, status: 502 } as const
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
