import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOpenAiModelConfiguration } from '../../language-model-configuration'
import { createModelRequester } from './language-model-request'
import { createRecordedOpenAiError, createRecordedOpenAiResponse } from './recorded-openai-responses'

const operatorApiKey = { value: 'test-api-key' } as const
const echoedApiKey = { value: 'sk-proj-OperatorSecret0123456789abcdef' } as const
const configuration = createOpenAiModelConfiguration({ model: 'structured-model', reasoningEffort: 'low', role: 'structured' })
const outputSchema = { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false }
const modelRequest = {
  instructions: 'Extract the value.',
  maxOutputTokens: 1_000,
  operation: 'explainable-match-evidence',
  output: { name: 'value', schema: outputSchema },
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

  it('reads an answer cut at the output budget as incomplete', async () => {
    const requester = createModelRequester({ apiKey: operatorApiKey, configuration,
      request: () => Promise.resolve(createRecordedOpenAiResponse({ incompleteReason: 'max_output_tokens', outputText: '{"val' })) })

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
      model: 'structured-model', max_output_tokens: 1_000, reasoning: { effort: 'low' }, store: false,
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

    const result = await requester.send({ ...modelRequest, operation: 'resume-section-writing' })

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
})

function recordServerLogs() {
  const lines: string[] = []
  const record = (...values: unknown[]) => { lines.push(values.map(String).join(' ')) }
  for (const level of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation(record)
  }
  vi.spyOn(process, 'emitWarning').mockImplementation(record)
  return { read: () => lines.join('\n') }
}
