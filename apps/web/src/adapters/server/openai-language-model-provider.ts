import { createOpenAI } from '@ai-sdk/openai'
import { APICallError } from 'ai'

import type { OpenAiProviderOptions } from '../../language-model-configuration'
import type { LanguageModelProviderAdapter, ProviderFailure } from './language-model-request'

/** OpenAI through the Responses API, with strict Structured Outputs and application storage disabled. */
export const openAiLanguageModelProvider: LanguageModelProviderAdapter<OpenAiProviderOptions> = {
  createLanguageModel: ({ apiKey, model, request }) => createOpenAI({ apiKey: apiKey.value, fetch: request }).responses(model),
  readProviderOptions: (providerOptions: OpenAiProviderOptions) => ({ openai: {
    ...providerOptions,
    // Every qualified model reasons and reads its instructions as a developer message, whatever its identifier.
    forceReasoning: true,
    // The AI SDK would otherwise ask for a reasoning summary nobody reads, at the Candidate's latency.
    reasoningSummary: null,
    systemMessageMode: 'developer',
  } }),
  classifyFailure: classifyOpenAiFailure,
}

/**
 * Exhausted operator credit is not a rate limit: waiting does not restore it, so it is an outage the operator must
 * fix. A rejected request is a defect, never the Candidate's to fix.
 */
export function classifyOpenAiFailure({ error }: Readonly<{ error: unknown }>): ProviderFailure {
  if (error instanceof Error && error.name === 'TimeoutError') return { type: 'timeout' }
  if (!APICallError.isInstance(error) || error.statusCode === undefined) return { type: 'transport' }
  const status = error.statusCode
  if (status < 400) return { type: 'invalid-response' }
  const { errorCode, errorParam } = readErrorIdentifiers({ error })
  const retryAfter = error.responseHeaders?.['retry-after']
  return {
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(errorParam === undefined ? {} : { errorParam }),
    ...(retryAfter === undefined ? {} : { retryAfter }),
    status,
    type: readStatusFailure({ errorCode, status }),
  }
}

function readStatusFailure({ errorCode, status }: Readonly<{ errorCode?: string; status: number }>): ProviderFailure['type'] {
  if (status === 429 && errorCode === 'insufficient_quota') return 'upstream-failure'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'upstream-failure'
  return 'upstream-invalid-request'
}

/** The AI SDK parses OpenAI's error body into `data` when it can; otherwise the raw body is read here. */
function readErrorIdentifiers({ error }: Readonly<{ error: APICallError }>) {
  const body = error.data ?? readJson({ text: error.responseBody })
  const details = typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined
  if (typeof details !== 'object' || details === null) return {}
  const { code, param } = details as Readonly<{ code?: unknown; param?: unknown }>
  return {
    ...(typeof code === 'string' ? { errorCode: code } : {}),
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
