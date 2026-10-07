import type { FailureCause } from '@resume-tailoring/domain/candidate-session'
import type { ReadApiFailure } from './api-failure'

export { failureCauseTypes } from '@resume-tailoring/domain/candidate-session'
export type { FailureCause }

/** The one action that lets the Candidate continue after a failure; the application decides it, never the UI. */
export type Recovery = 'renew-access' | 'retry-after' | 'shorten-input' | 'retry' | 'reload'

/** A failure explained to the Candidate: why it happened and what to do next. */
export type ExplainedFailure = Readonly<{ cause: FailureCause; recovery: Recovery }>

/** How long to wait when a rate limit names no delay. */
const defaultRetryAfterSeconds = 30

/**
 * Reads the provider-neutral Failure Cause of what a browser adapter read; a failure without an API Failure is
 * unexpected. A provider that answered badly is unavailable for now: retrying later may succeed. A misconfigured
 * service, an invalid request or a foreign origin is a defect no retry can fix, so it is unexpected.
 */
export function readFailureCause(apiFailure: ReadApiFailure | undefined): FailureCause {
  switch (apiFailure?.type) {
    case 'demo-access-required': return { type: 'access-required' }
    case 'rate-limited': return { type: 'rate-limited', retryAfterSeconds: apiFailure.retryAfterSeconds ?? defaultRetryAfterSeconds }
    case 'timeout': return { type: 'timeout' }
    case 'input-too-large': return { type: 'input-too-large' }
    case 'demo-access-unavailable':
    case 'provider-unavailable':
    case 'invalid-provider-response': return { type: 'service-unavailable' }
    case 'network': return { type: 'network' }
    case 'demo-origin-required':
    case 'service-misconfigured':
    case 'invalid-input':
    case 'unexpected-response':
    case undefined: return { type: 'unexpected' }
  }
}

export function readRecovery(cause: FailureCause): Recovery {
  switch (cause.type) {
    case 'access-required': return 'renew-access'
    case 'rate-limited': return 'retry-after'
    case 'input-too-large': return 'shorten-input'
    case 'timeout':
    case 'service-unavailable':
    case 'network': return 'retry'
    case 'unexpected': return 'reload'
  }
}

export function explainFailure(apiFailure: ReadApiFailure | undefined): ExplainedFailure {
  const cause = readFailureCause(apiFailure)
  return { cause, recovery: readRecovery(cause) }
}

/** A failed model call, with its Failure Cause and Recovery read from the API Failure the adapter kept. */
export function explainModelFailure<TError extends string>({ error, apiFailure }: Readonly<{
  error: TError; apiFailure?: ReadApiFailure
}>) {
  return { ok: false, error, ...explainFailure(apiFailure) } as const
}

/** Whether retrying as is can succeed; when several steps fail, the Candidate is told first about one that cannot. */
export function isRetryable(cause: FailureCause) {
  return readRecovery(cause) === 'retry'
}
