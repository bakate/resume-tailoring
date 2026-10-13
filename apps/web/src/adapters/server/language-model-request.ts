import { generateText, jsonSchema, NoObjectGeneratedError, Output } from 'ai'
import type { LanguageModel, LanguageModelUsage } from 'ai'
import type { z } from 'zod'

import { readModelOperationSettings } from '../../language-model-configuration'
import type {
  LanguageModelConfiguration,
  LanguageModelProvider,
  ModelOperation,
  ProviderModelConfiguration,
} from '../../language-model-configuration'
import { deepSeekLanguageModelProvider } from './deepseek-language-model-provider'
import { openAiLanguageModelProvider } from './openai-language-model-provider'

/** The operator key every model request is signed with. */
export type ModelApiKey = Readonly<{ value: string }>

export type ModelRequestFailure = Readonly<{
  type: 'invalid-response' | 'rate-limited' | 'timeout' | 'transport' | 'truncated'
    | 'upstream-invalid-request' | 'upstream-failure'
  status?: number
  retryAfter?: string
}>

/**
 * What a provider's failure classifier reads from a failed call; its identifiers are filtered before any log. An
 * alert names a failure only the operator can fix, such as exhausted provider credit.
 */
export type ProviderFailure = ModelRequestFailure & Readonly<{
  alert?: 'exhausted-provider-credit'
  errorCode?: string
  errorParam?: string
}>

type ModelOutputFormat = Readonly<{ name: string; schema: Readonly<Record<string, unknown>> }>

/** What one Language Model Provider contributes; prompts, schemas and parsing stay in the operation adapters. */
export type LanguageModelProviderAdapter<TProvider extends LanguageModelProvider> = Readonly<{
  classifyFailure: (failure: Readonly<{ error: unknown }>) => ProviderFailure
  /**
   * Who holds the answer to its schema: the provider (strict structured outputs), or this wrapper, which then retries
   * one schema-invalid answer.
   */
  conformance: 'client-side' | 'server-side'
  createLanguageModel: (settings: Readonly<{ apiKey: ModelApiKey; model: string; request: typeof fetch }>) => LanguageModel
  readInstructions: (request: Readonly<{ instructions: string; output: ModelOutputFormat }>) => string
  readProviderOptions: (request: Readonly<{
    configuration: ProviderModelConfiguration<TProvider>
    operation: ModelOperation
  }>) => ProviderOptions
}>

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>

export type ModelUsage = Readonly<{ inputTokens: number; outputTokens: number }>

/** The Language Model Providers a configuration may name, each by the name it is configured under. */
export type LanguageModelProviderRegistry = Readonly<Record<string, LanguageModelProviderAdapter<never>>>

/** One call as qualification measures it: which configuration served which operation, how fast, at what usage. */
export type ModelCallMeasurement = Readonly<{
  configuration: LanguageModelConfiguration
  latencyMilliseconds: number
  operation: ModelOperation
  outcome: 'answered' | 'failed'
  usage?: ModelUsage
  /** Present only when the first answer did not conform: whether the deadline let it be sent again. */
  conformance?: ConformanceRetry
}>

export type ConformanceRetry = 'retried' | 'retry-skipped'

/**
 * What an operation adapter needs to reach a model. Qualification may also hand it the providers to choose from and
 * an observer of every call; production uses neither and reaches only the providers listed below.
 */
export type ModelConnection = Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  now?: () => number
  observeCall?: (measurement: ModelCallMeasurement) => void
  providers?: LanguageModelProviderRegistry
  request?: typeof fetch
}>

/** A model answer: its raw output text, which the operation adapter parses, and whether the model finished it. */
export type ModelResponse = Readonly<{ complete: boolean; text?: string; usage?: ModelUsage }>

type ModelRequestDetails = Readonly<{
  deadlineSignal?: AbortSignal
  instructions: string
  operation: ModelOperation
  output: ModelOutputFormat
  /** The schema the answer must conform to, whichever side guarantees it. */
  outputSchema: z.ZodType
  userText: string
}>

type ModelRequestResult = Readonly<{ ok: true; value: ModelResponse }> | Readonly<{ ok: false; error: ModelRequestFailure }>

type ModelAnswer = Readonly<{ finishReason?: string; text?: string; usage?: LanguageModelUsage }>

const languageModelProviderAdapters = {
  deepseek: deepSeekLanguageModelProvider,
  openai: openAiLanguageModelProvider,
} as const satisfies { [TProvider in LanguageModelProvider]: LanguageModelProviderAdapter<TProvider> } & LanguageModelProviderRegistry

// Provider warnings are not privacy-safe telemetry; only the failure metric below leaves this module.
;(globalThis as { AI_SDK_LOG_WARNINGS?: false }).AI_SDK_LOG_WARNINGS = false

/**
 * The one wrapper around AI SDK calls. It calls only the provider of the configuration it is given and signs with the
 * key it is given, never the SDK's environment lookup. It bounds each operation by its own budget and deadline. It
 * never retries a failed call, so a failure is retried only as a Recovery the application derives; the one exception
 * is a schema-invalid answer from a provider without strict structured outputs, sent again once if the operation's
 * deadline can still hold it. It logs only identifiers.
 */
export function createModelRequester({
  apiKey, configuration, now = Date.now, observeCall, providers = languageModelProviderAdapters, request = fetch,
}: ModelConnection) {
  // A registry is keyed by name, so it cannot tie each adapter to its own configuration type; the name does.
  const provider = providers[configuration.provider] as LanguageModelProviderAdapter<LanguageModelProvider>
  return {
    send: async (details: ModelRequestDetails) => {
      const startedAtMilliseconds = now()
      const { conformance, result } = await sendModelRequest({ apiKey, configuration, details, now, provider, request })
      observeCall?.({ configuration, latencyMilliseconds: now() - startedAtMilliseconds, operation: details.operation,
        outcome: result.ok ? 'answered' : 'failed', ...(result.ok && result.value.usage !== undefined ? { usage: result.value.usage } : {}),
        ...(conformance === undefined ? {} : { conformance }) })
      return result
    },
  }
}

async function sendModelRequest({ apiKey, configuration, details, now, provider, request }: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  details: ModelRequestDetails
  now: () => number
  provider: LanguageModelProviderAdapter<LanguageModelProvider>
  request: typeof fetch
}>): Promise<ConformingModelRequestResult> {
  const settings = readModelOperationSettings({ configuration, operation: details.operation })
  const deadline = createOperationDeadline({ deadlineMilliseconds: settings.deadlineMilliseconds })
  try {
    const deadlineSignal = AbortSignal.any([deadline.signal, ...(details.deadlineSignal === undefined ? [] : [details.deadlineSignal])])
    return await sendConformingModelRequest({ call: { apiKey, configuration, deadlineSignal, details,
      maxOutputTokens: settings.maxOutputTokens, now, provider, request }, deadlineMilliseconds: settings.deadlineMilliseconds })
  } finally {
    deadline.clear()
  }
}

/** One deadline for the whole operation, so a conformance retry spends what the first attempt left. */
function createOperationDeadline({ deadlineMilliseconds }: Readonly<{ deadlineMilliseconds: number }>) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort(new DOMException('The operation deadline passed', 'TimeoutError')) },
    deadlineMilliseconds)
  return { clear: () => { clearTimeout(timer) }, signal: controller.signal }
}

type ModelCall = Parameters<typeof sendAttempt>[0]

type ConformingModelRequestResult = Readonly<{ conformance?: ConformanceRetry; result: ModelRequestResult }>

async function sendConformingModelRequest({ call, deadlineMilliseconds }: Readonly<{
  call: ModelCall
  deadlineMilliseconds: number
}>): Promise<ConformingModelRequestResult> {
  const { configuration, details, now, provider } = call
  const startedAtMilliseconds = now()
  const first = await sendAttempt(call)
  if (!first.ok) return { result: first }
  const nonConformance = readNonConformance({ answer: first.value, outputSchema: details.outputSchema })
  if (nonConformance === null || provider.conformance === 'server-side') {
    return { result: { ok: true, value: createModelResponse(first.value) } }
  }
  const elapsedMilliseconds = now() - startedAtMilliseconds
  const canRetry = deadlineMilliseconds - elapsedMilliseconds >= elapsedMilliseconds
  recordConformanceRetry({ cause: nonConformance, configuration, operation: details.operation, retried: canRetry })
  if (!canRetry) return { conformance: 'retry-skipped', result: { ok: true, value: createModelResponse(first.value) } }
  const retry = await sendAttempt(call)
  return { conformance: 'retried', result: retry.ok ? { ok: true, value: createModelResponse({ ...retry.value,
    usage: addUsage({ first: first.value.usage, second: retry.value.usage }) }) } : retry }
}

/** One call to the provider. An answer cut at the output budget fails on its own, since the same request would be cut again. */
async function sendAttempt({ apiKey, configuration, deadlineSignal, details, maxOutputTokens, now, provider, request }: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  deadlineSignal: AbortSignal
  details: ModelRequestDetails
  maxOutputTokens: number
  now: () => number
  provider: LanguageModelProviderAdapter<LanguageModelProvider>
  request: typeof fetch
}>): Promise<Readonly<{ ok: true; value: ModelAnswer }> | Readonly<{ ok: false; error: ModelRequestFailure }>> {
  const startedAtMilliseconds = now()
  let requestCharacterCount = 0
  const measuredRequest: typeof fetch = (input, init) => {
    requestCharacterCount = typeof init?.body === 'string' ? init.body.length : 0
    return request(input, init)
  }
  const failure = { apiKey, configuration, now, operation: details.operation, startedAtMilliseconds }
  let answer: ModelAnswer
  try {
    const result = await generateText({
      abortSignal: deadlineSignal,
      instructions: provider.readInstructions({ instructions: details.instructions, output: details.output }),
      maxOutputTokens,
      maxRetries: 0,
      messages: [{ role: 'user', content: [{ type: 'text', text: details.userText }] }],
      model: provider.createLanguageModel({ apiKey, model: configuration.model, request: measuredRequest }),
      output: Output.object({ name: details.output.name, schema: jsonSchema(details.output.schema) }),
      providerOptions: provider.readProviderOptions({ configuration, operation: details.operation }),
    })
    // The result reads these through getters, which a spread would drop.
    answer = { finishReason: result.finishReason, text: result.text, usage: result.usage }
  } catch (error) {
    // Output that is not the requested JSON is still the model's answer: conformance and the adapter decide its fate.
    if (NoObjectGeneratedError.isInstance(error)) answer = { finishReason: error.finishReason, text: error.text, usage: error.usage }
    else return recordFailure({ ...failure, failure: provider.classifyFailure({ error }), requestCharacterCount })
  }
  if (answer.finishReason === 'length') {
    return recordFailure({ ...failure, failure: { type: 'truncated' }, maxOutputTokens, requestCharacterCount })
  }
  return { ok: true, value: answer }
}

type NonConformance = 'invalid-json' | 'invalid-schema' | 'missing-output-text'

/** Only a finished answer is checked: one the model stopped for another reason is never worth the same request again. */
function readNonConformance({ answer, outputSchema }: Readonly<{ answer: ModelAnswer; outputSchema: z.ZodType }>): NonConformance | null {
  if (answer.finishReason !== 'stop') return null
  if (answer.text === undefined || answer.text.trim() === '') return 'missing-output-text'
  let value: unknown
  try {
    value = JSON.parse(answer.text) as unknown
  } catch {
    return 'invalid-json'
  }
  return outputSchema.safeParse(value).success ? null : 'invalid-schema'
}

function recordConformanceRetry({ cause, configuration, operation, retried }: Readonly<{
  cause: NonConformance
  configuration: LanguageModelConfiguration
  operation: ModelOperation
  retried: boolean
}>) {
  console.info(JSON.stringify({ category: 'privacy-safe-model-request',
    metric: retried ? 'conformance-retry' : 'conformance-retry-skipped', value: 1,
    dimensions: { cause, operation, provider: configuration.provider } }))
}

function addUsage({ first, second }: Readonly<{ first?: LanguageModelUsage; second?: LanguageModelUsage }>) {
  if (first?.inputTokens === undefined || first.outputTokens === undefined) return second
  if (second?.inputTokens === undefined || second.outputTokens === undefined) return first
  return { ...second, inputTokens: first.inputTokens + second.inputTokens, outputTokens: first.outputTokens + second.outputTokens }
}

function createModelResponse({ finishReason, text, usage }: ModelAnswer): ModelResponse {
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
  apiKey, configuration, failure, maxOutputTokens, now, operation, requestCharacterCount, startedAtMilliseconds,
}: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  failure: ProviderFailure
  maxOutputTokens?: number
  now: () => number
  operation: ModelOperation
  requestCharacterCount: number
  startedAtMilliseconds: number
}>) {
  const { alert, errorCode, errorParam, retryAfter, status, type } = failure
  const { provider } = configuration
  const upstreamErrorCode = readErrorIdentifier({ apiKey, value: errorCode })
  const upstreamErrorParam = readErrorIdentifier({ apiKey, value: errorParam })
  const dimensions = {
    cause: type, durationMilliseconds: Math.max(0, now() - startedAtMilliseconds), operation, provider, requestCharacterCount,
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(status === undefined ? {} : { status }),
    ...(upstreamErrorCode === undefined ? {} : { upstreamErrorCode }),
    ...(upstreamErrorParam === undefined ? {} : { upstreamErrorParam }),
  }
  console.info(JSON.stringify({ category: 'privacy-safe-model-request', metric: 'failed', value: 1, dimensions }))
  // The deployment alarms on this metric: only the operator can restore exhausted provider credit.
  if (alert !== undefined) {
    console.info(JSON.stringify({ category: 'privacy-safe-model-request', metric: 'operator-alert', value: 1,
      dimensions: { cause: alert, operation, provider } }))
  }
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
