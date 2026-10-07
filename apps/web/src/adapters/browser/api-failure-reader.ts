import type { ReadApiFailure } from '@resume-tailoring/application/ports'
import { apiFailureSchema } from '../../api-failure'

/** A request that never got a response failed in transport. */
export const networkFailure: ReadApiFailure = { type: 'network' }
/** A response that is neither the expected success nor a failure envelope. */
export const unexpectedResponse: ReadApiFailure = { type: 'unexpected-response' }

/** Reads the API Failure a response carries; any response outside the failure envelope is unexpected. */
export async function readApiFailure(response: Response): Promise<ReadApiFailure> {
  return readApiFailureBody({ response, body: await response.json().catch(() => undefined) })
}

/** The same reading for an adapter that already consumed the body. A successful status never carries a failure. */
export function readApiFailureBody({ response, body }: Readonly<{ response: Pick<Response, 'ok'>; body: unknown }>): ReadApiFailure {
  const failure = apiFailureSchema.safeParse(body)
  if (response.ok || !failure.success) return unexpectedResponse
  const { type, retryAfterSeconds } = failure.data.error
  return retryAfterSeconds === undefined ? { type } : { type, retryAfterSeconds }
}
