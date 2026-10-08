import { describe, expect, it, vi } from 'vitest'

import { createOpenAiRequester } from './openai-request'

const operatorApiKey = { source: 'operator', value: 'test-api-key' } as const
const candidateApiKey = { source: 'candidate', value: 'sk-proj-CandidateSecret0123456789abcdef' } as const

describe('OpenAI request policy', () => {
  it('reuses a supplied deadline across requests', async () => {
    const deadlineSignal = new AbortController().signal
    const signals: (AbortSignal | null)[] = []
    const requester = createOpenAiRequester({
      apiKey: operatorApiKey,
      request: (_input, init) => {
        signals.push(init?.signal ?? null)
        return Promise.resolve(Response.json({ output: [] }))
      },
    })

    await requester.send({ body: {}, deadlineSignal, operation: 'explainable-match-evidence' })
    await requester.send({ body: {}, deadlineSignal, operation: 'explainable-match-evidence' })

    expect(signals).toEqual([deadlineSignal, deadlineSignal])
  })

  it('reports a privacy-safe timeout without request content or credentials', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createOpenAiRequester({
      apiKey: { source: 'operator', value: 'private-api-key' },
      request: () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
    })

    const result = await requester.send({
      body: { professionalContent: 'Private Candidate history' },
      operation: 'structured-source-profile-extraction',
    })

    expect(result).toEqual({ ok: false, error: { type: 'timeout' } })
    expect(writeLog).toHaveBeenCalledOnce()
    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).toContain('"cause":"timeout"')
    expect(serializedMetric).toContain('"operation":"structured-source-profile-extraction"')
    expect(serializedMetric).not.toContain('Private Candidate history')
    expect(serializedMetric).not.toContain('private-api-key')
    writeLog.mockRestore()
  })

  it('reports the provider error code and parameter of a rejected request without its message', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createOpenAiRequester({
      apiKey: operatorApiKey,
      request: () => Promise.resolve(Response.json({ error: {
        code: 'invalid_json_schema', message: 'Private Candidate history is invalid', param: 'text.format.schema',
      } }, { status: 400 })),
    })

    const result = await requester.send({ body: {}, operation: 'resume-section-writing' })

    expect(result).toEqual({ ok: false, error: { status: 400, type: 'upstream-invalid-request' } })
    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).toContain('"upstreamErrorCode":"invalid_json_schema"')
    expect(serializedMetric).toContain('"upstreamErrorParam":"text.format.schema"')
    expect(serializedMetric).not.toContain('Private Candidate history')
    writeLog.mockRestore()
  })

  it('omits provider error details that are not identifier-like', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createOpenAiRequester({
      apiKey: operatorApiKey,
      request: () => Promise.resolve(Response.json({ error: {
        code: 'Private Candidate history', param: null,
      } }, { status: 400 })),
    })

    await requester.send({ body: {}, operation: 'resume-section-writing' })

    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).not.toContain('upstreamError')
    expect(serializedMetric).not.toContain('Private Candidate history')
    writeLog.mockRestore()
  })

  it('classifies provider rate limits and preserves Retry-After', async () => {
    const requester = createOpenAiRequester({
      apiKey: operatorApiKey,
      request: () => Promise.resolve(new Response(null, {
        headers: { 'Retry-After': '15' },
        status: 429,
      })),
    })

    const result = await requester.send({ body: {}, operation: 'explainable-match-evidence' })

    expect(result).toEqual({
      ok: false,
      error: { retryAfter: '15', status: 429, type: 'rate-limited' },
    })
  })

  it('signs a request with the Candidate API Key alone', async () => {
    const authorizations: (string | null)[] = []
    const requester = createOpenAiRequester({
      apiKey: candidateApiKey,
      request: (_input, init) => {
        authorizations.push(new Headers(init?.headers).get('authorization'))
        return Promise.resolve(Response.json({ error: { code: 'invalid_api_key' } }, { status: 401 }))
      },
    })

    await requester.send({ body: {}, operation: 'explainable-job-posting-extraction' })

    expect(authorizations).toEqual([`Bearer ${candidateApiKey.value}`])
  })

  it.each([
    { status: 401, code: 'invalid_api_key', type: 'candidate-api-key-invalid' },
    { status: 403, code: 'missing_scope', type: 'candidate-api-key-invalid' },
    { status: 404, code: 'model_not_found', type: 'candidate-api-key-model-unavailable' },
    { status: 403, code: 'model_not_found', type: 'candidate-api-key-model-unavailable' },
    { status: 429, code: 'insufficient_quota', type: 'provider-credit-exhausted' },
    { status: 429, code: 'rate_limit_exceeded', type: 'rate-limited' },
  ] as const)('reads a $status $code answered to a Candidate API Key as $type', async ({ code, status, type }) => {
    const requester = createOpenAiRequester({
      apiKey: candidateApiKey,
      request: () => Promise.resolve(Response.json({ error: { code } }, { status })),
    })

    const result = await requester.send({ body: {}, operation: 'explainable-job-posting-extraction' })

    expect(result).toMatchObject({ ok: false, error: { type } })
  })

  it.each([
    { status: 401, code: 'invalid_api_key', type: 'upstream-invalid-request' },
    { status: 404, code: 'model_not_found', type: 'upstream-invalid-request' },
    { status: 429, code: 'insufficient_quota', type: 'upstream-failure' },
  ] as const)('reads a $status $code answered to the operator key as $type', async ({ code, status, type }) => {
    const requester = createOpenAiRequester({
      apiKey: operatorApiKey,
      request: () => Promise.resolve(Response.json({ error: { code } }, { status })),
    })

    const result = await requester.send({ body: {}, operation: 'explainable-job-posting-extraction' })

    expect(result).toMatchObject({ ok: false, error: { type } })
  })

  it('never reports a Candidate API Key a provider error echoes', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createOpenAiRequester({
      apiKey: candidateApiKey,
      request: () => Promise.resolve(Response.json({ error: {
        code: candidateApiKey.value, message: `Incorrect API key provided: ${candidateApiKey.value}`,
        param: `key.${candidateApiKey.value.slice(0, 20)}`,
      } }, { status: 401 })),
    })

    const result = await requester.send({ body: {}, operation: 'resume-section-writing' })

    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).toContain('"cause":"candidate-api-key-invalid"')
    expect(serializedMetric).toContain('"apiKeySource":"candidate"')
    expect(serializedMetric).not.toContain('sk-proj')
    expect(serializedMetric).not.toContain('CandidateSecret')
    expect(JSON.stringify(result)).not.toContain('CandidateSecret')
    writeLog.mockRestore()
  })
})
