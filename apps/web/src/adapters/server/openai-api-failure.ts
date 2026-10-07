import type { ApiFailure } from '../../api-failure'
import type { OpenAiRequestFailure } from './openai-request'

type OpenAiRouteFailure = OpenAiRequestFailure | Readonly<{
  type: 'invalid-model-output' | 'request-too-large'
  characterCount?: number
  maximumCharacterCount?: number
}>

export function readOpenAiApiFailure(failure: OpenAiRouteFailure): ApiFailure {
  if (failure.type === 'request-too-large') return { type: 'input-too-large' }
  if (failure.type === 'timeout') return { type: 'timeout' }
  if (failure.type === 'rate-limited') return readRateLimit(failure)
  if (failure.type === 'invalid-model-output' || failure.type === 'invalid-response') {
    return { type: 'invalid-provider-response' }
  }
  if (failure.type === 'upstream-invalid-request') return { type: 'service-misconfigured' }
  return { type: 'provider-unavailable' }
}

/** Retry-After may also be an HTTP date; only a delay in seconds is forwarded. */
function readRateLimit({ retryAfter }: OpenAiRequestFailure): ApiFailure {
  return retryAfter !== undefined && /^\d+$/.test(retryAfter)
    ? { type: 'rate-limited', retryAfterSeconds: Number(retryAfter) }
    : { type: 'rate-limited' }
}
