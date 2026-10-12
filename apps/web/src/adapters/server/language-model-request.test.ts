import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  createDeepSeekModelConfiguration,
  createOpenAiModelConfiguration,
  type LanguageModelConfiguration,
} from '../../language-model-configuration'
import { createModelRequester } from './language-model-request'
import { createRecordedDeepSeekError, createRecordedDeepSeekResponse } from './recorded-deepseek-responses'
import { createRecordedOpenAiError, createRecordedOpenAiResponse } from './recorded-openai-responses'
import { createScriptedLanguageModelProvider } from './scripted-language-model-provider'

const operatorApiKey = { value: 'test-api-key' } as const
const echoedApiKey = { value: 'sk-proj-OperatorSecret0123456789abcdef' } as const
const configuration = createOpenAiModelConfiguration({ model: 'structured-model', reasoningEffort: 'low', role: 'structured' })
const deepSeekConfiguration = createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'structured' })
const outputSchema = { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false }
const modelRequest = {
  instructions: 'Extract the value.',
  operation: 'explainable-match-evidence',
  output: { name: 'value', schema: outputSchema },
  outputSchema: z.strictObject({ value: z.string() }),
  userText: 'Private Candidate history',
} as const

describe('Model request call wrapper', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns the output text with its token usage', async () => {
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      request: () => Promise.resolve(createRecordedOpenAiResponse({ outputText: '{"value":"TypeScript"}',
        usage: { inputTokens: 900, outputTokens: 120 } })) })

    const result = await requester.send(modelRequest)

    expect(result).toEqual({ ok: true, value: { complete: true, text: '{"value":"TypeScript"}',
      usage: { inputTokens: 900, outputTokens: 120 } } })
  })

  it('reads an answer the model stopped for another reason than its budget as incomplete', async () => {
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      request: () => Promise.resolve(createRecordedOpenAiResponse({ incompleteReason: 'content_filter', outputText: '{"val' })) })

    const result = await requester.send(modelRequest)

    expect(result).toMatchObject({ ok: true, value: { complete: false, text: '{"val' } })
  })

  it('sends the frozen provider options of the Qualified Model Configuration', async () => {
    const requests: Request[] = []
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration, request: (input, init) => {
      requests.push(new Request(input, init))
      return Promise.resolve(createRecordedOpenAiResponse({ outputText: '{"value":"TypeScript"}' }))
    } })

    await requester.send(modelRequest)

    expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses')
    const body = await requests[0]?.json() as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'structured-model', max_output_tokens: 8_000, reasoning: { effort: 'low' }, store: false,
      input: [{ role: 'developer', content: 'Extract the value.' },
        { role: 'user', content: [{ type: 'input_text', text: 'Private Candidate history' }] }],
      text: { format: { type: 'json_schema', name: 'value', strict: true, schema: outputSchema } },
    })
    expect(body).not.toHaveProperty('reasoning.summary')
  })

  it('signs every call with the key it is given, never the key the environment holds', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-environment-key-that-must-not-sign')
    const authorizations: (string | null)[] = []
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration, request: (_input, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization'))
      return Promise.resolve(createRecordedOpenAiResponse({ outputText: '{"value":"TypeScript"}' }))
    } })

    await requester.send(modelRequest)

    expect(authorizations).toEqual(['Bearer test-api-key'])
  })

  it('bounds every call with the supplied deadline', async () => {
    const deadline = new AbortController()
    // Like fetch, the double rejects once the deadline passes, at once when it already has.
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration, request: (_input, init) =>
      new Promise((_resolve, reject) => {
        const rejectWithReason = () => { reject(new DOMException('Timed out', 'TimeoutError')) }
        if (init?.signal?.aborted === true) rejectWithReason()
        else init?.signal?.addEventListener('abort', rejectWithReason)
      }) })

    const pending = requester.send({ ...modelRequest, deadlineSignal: deadline.signal })
    deadline.abort(new DOMException('Timed out', 'TimeoutError'))

    await expect(pending).resolves.toEqual({ ok: false, error: { type: 'timeout' } })
  })

  it.each([
    { name: 'a rate limit', answer: () => Promise.resolve(createRecordedOpenAiError({ code: 'rate_limit_exceeded', status: 429 })) },
    { name: 'an outage', answer: () => Promise.resolve(new Response(null, { status: 503 })) },
    { name: 'a network failure', answer: () => Promise.reject(new TypeError('fetch failed', { cause: new Error('ECONNRESET') })) },
  ])('never retries a call after $name', async ({ answer }) => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration, request: () => {
      requestCount += 1
      return answer()
    } })

    const result = await requester.send(modelRequest)

    expect(result.ok).toBe(false)
    expect(requestCount).toBe(1)
  })

  it('reports a privacy-safe timeout without request content or credentials', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createModelRequester({ apiKey: { value: 'private-api-key' }, configuration,
      request: () => Promise.reject(new DOMException('Timed out', 'TimeoutError')) })

    const result = await requester.send({ ...modelRequest, operation: 'structured-source-profile-extraction' })

    expect(result).toEqual({ ok: false, error: { type: 'timeout' } })
    expect(writeLog).toHaveBeenCalledOnce()
    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).toContain('"category":"privacy-safe-model-request"')
    expect(serializedMetric).toContain('"cause":"timeout"')
    expect(serializedMetric).toContain('"operation":"structured-source-profile-extraction"')
    expect(serializedMetric).toContain('"provider":"openai"')
    expect(serializedMetric).not.toContain('Private Candidate history')
    expect(serializedMetric).not.toContain('private-api-key')
  })

  it('reports the provider error code and parameter of a rejected request without its message', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      request: () => Promise.resolve(createRecordedOpenAiError({ code: 'invalid_json_schema',
        message: 'Private Candidate history is invalid', param: 'text.format.schema', status: 400 })) })

    const result = await requester.send({ ...modelRequest, operation: 'resume-section-validation' })

    expect(result).toEqual({ ok: false, error: { status: 400, type: 'upstream-invalid-request' } })
    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).toContain('"upstreamErrorCode":"invalid_json_schema"')
    expect(serializedMetric).toContain('"upstreamErrorParam":"text.format.schema"')
    expect(serializedMetric).not.toContain('Private Candidate history')
  })

  it('omits provider error details that are not identifier-like', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      request: () => Promise.resolve(createRecordedOpenAiError({ code: 'Private Candidate history', status: 400 })) })

    await requester.send(modelRequest)

    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).not.toContain('upstreamError')
    expect(serializedMetric).not.toContain('Private Candidate history')
  })

  it('keeps the delay a rate limit asks for', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      request: () => Promise.resolve(new Response(null, { headers: { 'Retry-After': '15' }, status: 429 })) })

    const result = await requester.send(modelRequest)

    expect(result).toEqual({ ok: false, error: { retryAfter: '15', status: 429, type: 'rate-limited' } })
  })

  it('leaves neither Candidate content nor the key a provider error echoes in logs, metrics or the result', async () => {
    const logs = recordServerLogs()
    const requester = createModelRequester({ apiKey: echoedApiKey, configuration,
      request: () => Promise.resolve(createRecordedOpenAiError({ code: echoedApiKey.value,
        message: `Incorrect API key provided: ${echoedApiKey.value} for Private Candidate history`,
        param: `key.${echoedApiKey.value.slice(0, 20)}`, status: 401 })) })

    const result = await requester.send(modelRequest)

    expect(logs.read()).toContain('"cause":"upstream-invalid-request"')
    for (const secret of ['sk-proj', 'OperatorSecret', 'Private Candidate history']) {
      expect(logs.read()).not.toContain(secret)
      expect(JSON.stringify(result)).not.toContain(secret)
    }
  })

  it('reaches a provider registered only by its caller, never branching on the provider', async () => {
    const providers = { scripted: createScriptedLanguageModelProvider({ answer: ({ model, outputName }) =>
      ({ text: JSON.stringify({ value: `${model}:${outputName}` }) }) }) }
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: scriptedConfiguration, providers })

    const result = await requester.send(modelRequest)

    expect(result).toMatchObject({ ok: true, value: { complete: true, text: '{"value":"scripted-model:value"}' } })
  })

  it('reports each call\'s configuration, operation, latency and usage to its observer, and nothing it carried', async () => {
    const measurements: unknown[] = []
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      observeCall: (measurement) => { measurements.push(measurement) },
      request: () => Promise.resolve(createRecordedOpenAiResponse({ outputText: '{"value":"TypeScript"}',
        usage: { inputTokens: 900, outputTokens: 120 } })) })

    await requester.send(modelRequest)

    expect(measurements).toEqual([{ configuration, latencyMilliseconds: expect.any(Number) as number,
      operation: 'explainable-match-evidence', outcome: 'answered', usage: { inputTokens: 900, outputTokens: 120 } }])
    expect(JSON.stringify(measurements)).not.toMatch(/Private Candidate history|TypeScript|test-api-key/u)
  })

  it('reports a failed call to its observer without usage', async () => {
    const measurements: unknown[] = []
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      observeCall: (measurement) => { measurements.push(measurement) },
      request: () => Promise.resolve(new Response(null, { status: 500 })) })

    await requester.send(modelRequest)

    expect(measurements).toEqual([{ configuration, latencyMilliseconds: expect.any(Number) as number,
      operation: 'explainable-match-evidence', outcome: 'failed' }])
  })
})

describe('Model request call wrapper, per operation', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([
    { provider: 'openai', configuration, answer: () => createRecordedOpenAiResponse({ incompleteReason: 'max_output_tokens', outputText: '{"val' }) },
    { provider: 'deepseek', configuration: deepSeekConfiguration, answer: () => createRecordedDeepSeekResponse({ finishReason: 'length' }) },
  ])('fails a $provider answer cut at its budget as truncated, never as invalid output, and never retries it', async ({ answer, configuration: truncatedConfiguration }) => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: truncatedConfiguration, request: () => {
      requestCount += 1
      return Promise.resolve(answer())
    } })

    const result = await requester.send(modelRequest)

    expect(result).toEqual({ ok: false, error: { type: 'truncated' } })
    expect(requestCount).toBe(1)
    const metric = JSON.parse(String(writeLog.mock.calls.at(0)?.at(0))) as { dimensions: Record<string, unknown> }
    expect(metric.dimensions).toMatchObject({ cause: 'truncated', operation: 'explainable-match-evidence',
      maxOutputTokens: truncatedConfiguration.operations['explainable-match-evidence']?.maxOutputTokens })
  })

  it('sends DeepSeek JSON mode with the thinking and budget its configuration sets for the operation', async () => {
    const requests: Request[] = []
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: (input, init) => {
      requests.push(new Request(input, init))
      return Promise.resolve(createRecordedDeepSeekResponse({ outputText: '{"value":"TypeScript"}' }))
    } })

    await requester.send(modelRequest)
    await requester.send({ ...modelRequest, operation: 'explainable-job-posting-extraction' })

    expect(requests.map(({ url }) => url)).toEqual(['https://api.deepseek.com/chat/completions', 'https://api.deepseek.com/chat/completions'])
    const [matching, extraction] = await Promise.all(requests.map((request) => request.json() as Promise<Record<string, unknown>>))
    expect(matching).toMatchObject({ model: 'deepseek-flash', max_tokens: 32_000, response_format: { type: 'json_object' },
      thinking: { type: 'enabled' }, reasoning_effort: 'low' })
    expect(extraction).toMatchObject({ max_tokens: 20_000, thinking: { type: 'disabled' } })
    expect(extraction).not.toHaveProperty('reasoning_effort')
  })

  it('shows DeepSeek the schema and an example of its shape in instructions that name json', async () => {
    let body = ''
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: (_input, init) => {
      body = typeof init?.body === 'string' ? init.body : ''
      return Promise.resolve(createRecordedDeepSeekResponse({ outputText: '{"value":"TypeScript"}' }))
    } })

    await requester.send(modelRequest)

    const { messages } = JSON.parse(body) as { messages: { content: string; role: string }[] }
    const instructions = messages.filter(({ role }) => role === 'system').map(({ content }) => content).join('\n')
    expect(instructions).toContain('Extract the value.')
    expect(instructions).toContain(JSON.stringify(outputSchema))
    expect(instructions).toContain('{"value":"…"}')
    expect(instructions).toContain('json')
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: 'Private Candidate history' })
  })

  it('maps DeepSeek prompt and completion tokens to the usage of the answer', async () => {
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration,
      request: () => Promise.resolve(createRecordedDeepSeekResponse({ outputText: '{"value":"TypeScript"}',
        usage: { inputTokens: 5_529, outputTokens: 12_919 } })) })

    const result = await requester.send(modelRequest)

    expect(result).toEqual({ ok: true, value: { complete: true, text: '{"value":"TypeScript"}',
      usage: { inputTokens: 5_529, outputTokens: 12_919 } } })
  })

  it('signs DeepSeek calls with the key it is given, never the key the environment holds', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-environment-key-that-must-not-sign')
    const authorizations: (string | null)[] = []
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: (_input, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization'))
      return Promise.resolve(createRecordedDeepSeekResponse({ outputText: '{"value":"TypeScript"}' }))
    } })

    await requester.send(modelRequest)

    expect(authorizations).toEqual(['Bearer test-api-key'])
  })

  it.each([
    { name: 'an empty answer', outputText: undefined, cause: 'missing-output-text' },
    { name: 'an unparseable answer', outputText: '{"value":', cause: 'invalid-json' },
    { name: 'a schema-invalid answer', outputText: '{"value":"TypeScript","extra":true}', cause: 'invalid-schema' },
  ])('sends DeepSeek the request once more after $name, and counts the retry', async ({ cause, outputText }) => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const answers = [createRecordedDeepSeekResponse({ outputText, usage: { inputTokens: 100, outputTokens: 10 } }),
      createRecordedDeepSeekResponse({ outputText: '{"value":"TypeScript"}', usage: { inputTokens: 100, outputTokens: 20 } })]
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: () => {
      requestCount += 1
      return Promise.resolve(answers.shift() ?? new Response(null, { status: 500 }))
    } })

    const result = await requester.send(modelRequest)

    expect(result).toEqual({ ok: true, value: { complete: true, text: '{"value":"TypeScript"}',
      usage: { inputTokens: 200, outputTokens: 30 } } })
    expect(requestCount).toBe(2)
    expect(writeLog.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)).toEqual([{
      category: 'privacy-safe-model-request', metric: 'conformance-retry', value: 1,
      dimensions: { cause, operation: 'explainable-match-evidence', provider: 'deepseek' },
    }])
  })

  it('returns the second non-conforming DeepSeek answer without a third call', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: () => {
      requestCount += 1
      return Promise.resolve(createRecordedDeepSeekResponse({ outputText: '{"value":1}' }))
    } })

    const result = await requester.send(modelRequest)

    expect(result).toMatchObject({ ok: true, value: { complete: true, text: '{"value":1}' } })
    expect(requestCount).toBe(2)
  })

  it('retries no schema-invalid answer when the remaining deadline could not hold another attempt', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    let clock = 0
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, now: () => clock,
      request: () => {
        requestCount += 1
        // The first attempt takes 60 s of the 110 s match evidence deadline: 50 s remain, too few for another.
        clock += 60_000
        return Promise.resolve(createRecordedDeepSeekResponse({ outputText: '' }))
      } })

    const result = await requester.send(modelRequest)

    expect(result).toEqual({ ok: true, value: { complete: true, usage: { inputTokens: 120, outputTokens: 40 } } })
    expect(requestCount).toBe(1)
    expect(String(writeLog.mock.calls.at(0)?.at(0))).toContain('"metric":"conformance-retry-skipped"')
  })

  it('leaves conformance to OpenAI, whose strict Structured Outputs hold the schema', async () => {
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration, request: () => {
      requestCount += 1
      return Promise.resolve(createRecordedOpenAiResponse({ outputText: '{"value":1}' }))
    } })

    await requester.send(modelRequest)

    expect(requestCount).toBe(1)
  })

  it('bounds the operation with its own deadline', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => { reject(new DOMException('Timed out', 'TimeoutError')) })
      }) })

    const pending = requester.send({ ...modelRequest, operation: 'explainable-job-posting-extraction' })
    await vi.advanceTimersByTimeAsync(89_999)
    const settledBeforeDeadline = await Promise.race([pending.then(() => true), Promise.resolve(false)])
    await vi.advanceTimersByTimeAsync(1)

    expect(settledBeforeDeadline).toBe(false)
    await expect(pending).resolves.toEqual({ ok: false, error: { type: 'timeout' } })
  })

  it.each([
    { name: 'an insufficient balance', status: 402, alerts: true, type: 'upstream-failure' },
    { name: 'a rate limit', status: 429, alerts: false, type: 'rate-limited' },
  ])('alerts the operator only on $name, read as $type', async ({ alerts, status, type }) => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    let requestCount = 0
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration: deepSeekConfiguration, request: () => {
      requestCount += 1
      return Promise.resolve(createRecordedDeepSeekError({ status }))
    } })

    const result = await requester.send(modelRequest)

    expect(result).toMatchObject({ ok: false, error: { status, type } })
    expect(requestCount).toBe(1)
    const alert = writeLog.mock.calls.map(([line]) => String(line)).find((line) => line.includes('"metric":"operator-alert"'))
    expect(alert === undefined ? undefined : JSON.parse(alert) as unknown).toEqual(alerts ? {
      category: 'privacy-safe-model-request', metric: 'operator-alert', value: 1,
      dimensions: { cause: 'exhausted-provider-credit', operation: 'explainable-match-evidence', provider: 'deepseek' },
    } : undefined)
  })
})

// A configuration of a provider production does not know; only the providers handed to the wrapper can serve it.
const scriptedConfiguration = { provider: 'scripted', model: 'scripted-model', role: 'structured',
  providerOptions: { temperature: 0 }, operations: configuration.operations } as unknown as LanguageModelConfiguration

function recordServerLogs() {
  const lines: string[] = []
  const record = (...values: unknown[]) => { lines.push(values.map(String).join(' ')) }
  for (const level of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation(record)
  }
  vi.spyOn(process, 'emitWarning').mockImplementation(record)
  return { read: () => lines.join('\n') }
}
