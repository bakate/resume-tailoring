import { generateText, jsonSchema, NoObjectGeneratedError, Output } from 'ai'
import type { LanguageModel, LanguageModelUsage } from 'ai'

import type { LanguageModelConfiguration, LanguageModelProvider } from '../../language-model-configuration'
import { openAiLanguageModelProvider } from './openai-language-model-provider'

type ModelOperation =
  | 'resume-section-writing'
  | 'resume-section-validation'
  | 'resume-document-coherence'
  | 'explainable-job-posting-extraction'
  | 'explainable-match-evidence'
  | 'resume-claim-validation'
  | 'resume-claim-writing'
  | 'structured-source-profile-extraction'

/** The operator key every model request is signed with. */
export type ModelApiKey = Readonly<{ value: string }>

export type ModelRequestFailure = Readonly<{
  type: 'invalid-response' | 'rate-limited' | 'timeout' | 'transport'
    | 'upstream-invalid-request' | 'upstream-failure'
  status?: number
  retryAfter?: string
}>

/** What a provider's failure classifier reads from a failed call; its identifiers are filtered before any log. */
export type ProviderFailure = ModelRequestFailure & Readonly<{ errorCode?: string; errorParam?: string }>

/** What one Language Model Provider contributes; prompts, schemas and parsing stay in the operation adapters. */
export type LanguageModelProviderAdapter<TProviderOptions> = Readonly<{
  classifyFailure: (failure: Readonly<{ error: unknown }>) => ProviderFailure
  createLanguageModel: (settings: Readonly<{ apiKey: ModelApiKey; model: string; request: typeof fetch }>) => LanguageModel
  readProviderOptions: (providerOptions: TProviderOptions) => ProviderOptions
}>

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>

export type ModelUsage = Readonly<{ inputTokens: number; outputTokens: number }>

/** A model answer: its raw output text, which the operation adapter parses, and whether the model finished it. */
export type ModelResponse = Readonly<{ complete: boolean; text?: string; usage?: ModelUsage }>

type ModelRequestDetails = Readonly<{
  deadlineSignal?: AbortSignal
  instructions: string
  maxOutputTokens: number
  operation: ModelOperation
  output: Readonly<{ name: string; schema: Readonly<Record<string, unknown>> }>
  userText: string
}>

const languageModelProviderAdapters = {
  openai: openAiLanguageModelProvider,
} as const satisfies Record<LanguageModelProvider, LanguageModelProviderAdapter<never>>

// Provider warnings are not privacy-safe telemetry; only the failure metric below leaves this module.
;(globalThis as { AI_SDK_LOG_WARNINGS?: false }).AI_SDK_LOG_WARNINGS = false

/**
 * The one wrapper around AI SDK calls. It signs with the key it is given, never the SDK's environment lookup; it never
 * retries, so a failed call is retried only as a Recovery the application derives; and it logs only identifiers.
 */
export function createModelRequester({ apiKey, configuration, request = fetch }: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  request?: typeof fetch
}>) {
  const provider = languageModelProviderAdapters[configuration.provider]
  return {
    send: (details: ModelRequestDetails) => sendModelRequest({ apiKey, configuration, details, provider, request }),
  }
}

function createModelRequestDeadline() {
  return AbortSignal.timeout(modelRequestTimeoutMilliseconds)
}

async function sendModelRequest({ apiKey, configuration, details, provider, request }: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  details: ModelRequestDetails
  provider: (typeof languageModelProviderAdapters)[LanguageModelProvider]
  request: typeof fetch
}>): Promise<Readonly<{ ok: true; value: ModelResponse }> | Readonly<{ ok: false; error: ModelRequestFailure }>> {
  const startedAtMilliseconds = Date.now()
  let requestCharacterCount = 0
  const measuredRequest: typeof fetch = (input, init) => {
    requestCharacterCount = typeof init?.body === 'string' ? init.body.length : 0
    return request(input, init)
  }
  try {
    const result = await generateText({
      abortSignal: details.deadlineSignal ?? createModelRequestDeadline(),
      instructions: details.instructions,
      maxOutputTokens: details.maxOutputTokens,
      maxRetries: 0,
      messages: [{ role: 'user', content: [{ type: 'text', text: details.userText }] }],
      model: provider.createLanguageModel({ apiKey, model: configuration.model, request: measuredRequest }),
      output: Output.object({ name: details.output.name, schema: jsonSchema(details.output.schema) }),
      providerOptions: provider.readProviderOptions(configuration.providerOptions),
    })
    return { ok: true, value: createModelResponse({ finishReason: result.finishReason, text: result.text, usage: result.usage }) }
  } catch (error) {
    // Output that is not the requested JSON is still the model's answer: the operation adapter decides what it means.
    if (NoObjectGeneratedError.isInstance(error)) return { ok: true, value: createModelResponse(error) }
    return recordFailure({ apiKey, failure: provider.classifyFailure({ error }), operation: details.operation,
      provider: configuration.provider, requestCharacterCount, startedAtMilliseconds })
  }
}

function createModelResponse({ finishReason, text, usage }: Readonly<{
  finishReason?: string
  text?: string
  usage?: LanguageModelUsage
}>): ModelResponse {
  const modelUsage = usage?.inputTokens === undefined || usage.outputTokens === undefined
    ? undefined
    : { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }
  return {
    complete: finishReason === 'stop',
    ...(text === undefined || text === '' ? {} : { text }),
    ...(modelUsage === undefined ? {} : { usage: modelUsage }),
  }
}

function recordFailure({
  apiKey, failure, operation, provider, requestCharacterCount, startedAtMilliseconds,
}: Readonly<{
  apiKey: ModelApiKey
  failure: ProviderFailure
  operation: ModelOperation
  provider: LanguageModelProvider
  requestCharacterCount: number
  startedAtMilliseconds: number
}>) {
  const { errorCode, errorParam, retryAfter, status, type } = failure
  const upstreamErrorCode = readErrorIdentifier({ apiKey, value: errorCode })
  const upstreamErrorParam = readErrorIdentifier({ apiKey, value: errorParam })
  const dimensions = {
    cause: type, durationMilliseconds: Math.max(0, Date.now() - startedAtMilliseconds), operation, provider, requestCharacterCount,
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(status === undefined ? {} : { status }),
    ...(upstreamErrorCode === undefined ? {} : { upstreamErrorCode }),
    ...(upstreamErrorParam === undefined ? {} : { upstreamErrorParam }),
  }
  console.info(JSON.stringify({ category: 'privacy-safe-model-request', metric: 'failed', value: 1, dimensions }))
  return { ok: false, error: {
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(status === undefined ? {} : { status }),
    type,
  } } as const
}

/**
 * Only identifier-like code and param values are logged; provider messages may echo Candidate content or the operator
 * key itself, so an identifier that looks like a key, or holds part of the one used, is dropped too.
 */
function readErrorIdentifier({ apiKey, value }: Readonly<{ apiKey: ModelApiKey; value?: string }>) {
  if (value === undefined || !/^[\w.[\]$-]{1,120}$/u.test(value)) return undefined
  return mayHoldApiKey({ apiKey, value }) ? undefined : value
}

/** Provider keys start with `sk-`; any eight consecutive characters of the key used also count as holding it. */
function mayHoldApiKey({ apiKey, value }: Readonly<{ apiKey: ModelApiKey; value: string }>) {
  if (/sk-/iu.test(value)) return true
  const fragmentLength = 8
  for (let start = 0; start + fragmentLength <= apiKey.value.length; start += 1) {
    if (value.includes(apiKey.value.slice(start, start + fragmentLength))) return true
  }
  return false
}

const modelRequestTimeoutMilliseconds = 90_000
