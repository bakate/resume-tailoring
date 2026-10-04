import { describe, expect, it, vi } from 'vitest'

import { createOpenAiRequester } from './openai-request'

describe('OpenAI request policy', () => {
  it('reuses a supplied deadline across requests', async () => {
    const deadlineSignal = new AbortController().signal
    const signals: (AbortSignal | null)[] = []
    const requester = createOpenAiRequester({
      apiKey: 'test-api-key',
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
      apiKey: 'private-api-key',
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
      apiKey: 'test-api-key',
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
      apiKey: 'test-api-key',
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
      apiKey: 'test-api-key',
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
})
