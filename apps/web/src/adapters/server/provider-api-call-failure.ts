import { APICallError } from 'ai'

import type { ProviderFailure } from './language-model-request'

/** What a provider's status table decides from one rejected call. */
export type ProviderStatusFailure = Readonly<{ alert?: ProviderFailure['alert']; type: ProviderFailure['type'] }>

/**
 * The part of a failure classifier every provider shares: an expired deadline, an unreachable provider and an
 * unreadable answer are told apart the same way, and only identifier fields of an error body are kept. The provider
 * decides what each status means.
 */
export function classifyApiCallFailure({ error, readStatusFailure }: Readonly<{
  error: unknown
  readStatusFailure: (failure: Readonly<{ errorCode?: string; status: number }>) => ProviderStatusFailure
}>): ProviderFailure {
  if (error instanceof Error && error.name === 'TimeoutError') return { type: 'timeout' }
  if (!APICallError.isInstance(error) || error.statusCode === undefined) return { type: 'transport' }
  const status = error.statusCode
  if (status < 400) return { type: 'invalid-response' }
  const { errorCode, errorParam } = readErrorIdentifiers({ error })
  const retryAfter = error.responseHeaders?.['retry-after']
  const { alert, type } = readStatusFailure({ ...(errorCode === undefined ? {} : { errorCode }), status })
  return {
    ...(alert === undefined ? {} : { alert }),
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(errorParam === undefined ? {} : { errorParam }),
    ...(retryAfter === undefined ? {} : { retryAfter }),
    status,
    type,
  }
}

/** The AI SDK parses a provider's error body into `data` when it can; otherwise the raw body is read here. */
function readErrorIdentifiers({ error }: Readonly<{ error: APICallError }>) {
  const body = error.data ?? readJson({ text: error.responseBody })
  const details = typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined
  if (typeof details !== 'object' || details === null) return {}
  const { code, param } = details as Readonly<{ code?: unknown; param?: unknown }>
  return {
    ...(typeof code === 'string' || typeof code === 'number' ? { errorCode: String(code) } : {}),
    ...(typeof param === 'string' ? { errorParam: param } : {}),
  }
}

function readJson({ text }: Readonly<{ text?: string }>): unknown {
  if (text === undefined) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
