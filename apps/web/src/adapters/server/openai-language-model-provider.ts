import { createOpenAI } from '@ai-sdk/openai'

import type { LanguageModelProviderAdapter, ProviderFailure } from './language-model-request'
import { classifyApiCallFailure } from './provider-api-call-failure'

/** OpenAI through the Responses API, with strict Structured Outputs and application storage disabled. */
export const openAiLanguageModelProvider: LanguageModelProviderAdapter<'openai'> = {
  // Strict Structured Outputs hold the answer to its schema on OpenAI's side.
  conformance: 'server-side',
  createLanguageModel: ({ apiKey, model, request }) => createOpenAI({ apiKey: apiKey.value, fetch: request }).responses(model),
  readInstructions: ({ instructions }) => instructions,
  readProviderOptions: ({ configuration }) => ({ openai: {
    ...configuration.providerOptions,
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
 * fix, and it alerts them. A rejected request is a defect, never the Candidate's to fix.
 */
export function classifyOpenAiFailure({ error }: Readonly<{ error: unknown }>): ProviderFailure {
  return classifyApiCallFailure({ error, readStatusFailure: ({ errorCode, status }) => {
    if (status === 429 && errorCode === 'insufficient_quota') return { alert: 'exhausted-provider-credit', type: 'upstream-failure' }
    if (status === 429) return { type: 'rate-limited' }
    if (status >= 500) return { type: 'upstream-failure' }
    return { type: 'upstream-invalid-request' }
  } })
}
