import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { classifyOpenAiFailure } from './openai-language-model-provider'

describe('OpenAI failure classifier', () => {
  it.each([
    { name: 'exhausted operator credit', status: 429, code: 'insufficient_quota', type: 'upstream-failure' },
    { name: 'a rate limit', status: 429, code: 'rate_limit_exceeded', type: 'rate-limited' },
    { name: 'a rate limit without code', status: 429, code: undefined, type: 'rate-limited' },
    { name: 'a model the key cannot reach', status: 404, code: 'model_not_found', type: 'upstream-invalid-request' },
    { name: 'a rejected key', status: 401, code: 'invalid_api_key', type: 'upstream-invalid-request' },
    { name: 'a forbidden key', status: 403, code: 'model_not_found', type: 'upstream-invalid-request' },
    { name: 'an invalid request', status: 400, code: 'invalid_json_schema', type: 'upstream-invalid-request' },
    { name: 'a server error', status: 500, code: 'server_error', type: 'upstream-failure' },
    { name: 'an outage', status: 503, code: undefined, type: 'upstream-failure' },
  ] as const)('reads $name ($status $code) as $type', ({ code, status, type }) => {
    const error = createApiCallError({ code, status })

    const failure = classifyOpenAiFailure({ error })

    expect(failure).toMatchObject({ status, type })
  })

  it('never reads exhausted operator credit as a rate limit, whatever delay it states', () => {
    const error = createApiCallError({ code: 'insufficient_quota', headers: { 'retry-after': '1' }, status: 429 })

    const failure = classifyOpenAiFailure({ error })

    expect(failure.type).toBe('upstream-failure')
  })

  it('keeps the delay a rate limit asks for', () => {
    const error = createApiCallError({ code: 'rate_limit_exceeded', headers: { 'retry-after': '15' }, status: 429 })

    const failure = classifyOpenAiFailure({ error })

    expect(failure).toEqual({ errorCode: 'rate_limit_exceeded', retryAfter: '15', status: 429, type: 'rate-limited' })
  })

  it('reads the error identifiers from a body the AI SDK could not parse', () => {
    const error = new APICallError({ message: 'Unparsed', requestBodyValues: {}, statusCode: 429, url: 'https://api.openai.com/v1/responses',
      responseBody: JSON.stringify({ error: { code: 'insufficient_quota' } }) })

    const failure = classifyOpenAiFailure({ error })

    expect(failure).toMatchObject({ errorCode: 'insufficient_quota', type: 'upstream-failure' })
  })

  it.each([
    { name: 'an expired deadline', error: new DOMException('Timed out', 'TimeoutError'), type: 'timeout' },
    { name: 'an aborted call', error: new DOMException('Aborted', 'AbortError'), type: 'transport' },
    { name: 'an unreachable provider', error: new APICallError({ message: 'Cannot connect to API', requestBodyValues: {},
      url: 'https://api.openai.com/v1/responses', isRetryable: true }), type: 'transport' },
    { name: 'a failing transport', error: new Error('socket hang up'), type: 'transport' },
    { name: 'an unreadable answer', error: new APICallError({ message: 'Failed to process successful response',
      requestBodyValues: {}, statusCode: 200, url: 'https://api.openai.com/v1/responses' }), type: 'invalid-response' },
  ])('keeps $name apart as $type', ({ error, type }) => {
    const failure = classifyOpenAiFailure({ error })

    expect(failure).toEqual({ type })
  })
})

function createApiCallError({ code, headers = {}, status }: Readonly<{
  code: string | undefined
  headers?: Readonly<Record<string, string>>
  status: number
}>) {
  const data = { error: { code: code ?? null, message: 'Private Candidate history', param: null, type: 'error' } }
  return new APICallError({ data, message: 'Private Candidate history', requestBodyValues: {}, responseBody: JSON.stringify(data),
    responseHeaders: headers, statusCode: status, url: 'https://api.openai.com/v1/responses' })
}
