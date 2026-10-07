/** The closed catalogue of API Failure types a server route answers with. */
export const apiFailureTypes = [
  'demo-access-required',
  'demo-origin-required',
  'demo-access-unavailable',
  'invalid-input',
  'input-too-large',
  'rate-limited',
  'timeout',
  'provider-unavailable',
  'invalid-provider-response',
  'service-misconfigured',
] as const
export type ApiFailureType = typeof apiFailureTypes[number]

/**
 * What a browser adapter read from a failed request: the API Failure the server answered with, `network` when no
 * response arrived, or `unexpected-response` when the response carried no recognizable failure.
 */
export type ReadApiFailure = Readonly<{
  type: ApiFailureType | 'network' | 'unexpected-response'
  retryAfterSeconds?: number
}>
