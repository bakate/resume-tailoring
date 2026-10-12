import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { classifyDeepSeekFailure } from './deepseek-language-model-provider'

describe('DeepSeek failure classifier', () => {
  it.each([
    { name: 'an invalid request', status: 400, type: 'upstream-invalid-request' },
    { name: 'invalid parameters', status: 422, type: 'upstream-invalid-request' },
    { name: 'a rejected key', status: 401, type: 'upstream-failure' },
    { name: 'an insufficient balance', status: 402, type: 'upstream-failure' },
    { name: 'a rate limit', status: 429, type: 'rate-limited' },
    { name: 'a server error', status: 500, type: 'upstream-failure' },
    { name: 'an overloaded server', status: 503, type: 'upstream-failure' },
  ] as const)('reads $name ($status) as $type', ({ status, type }) => {
    const error = createApiCallError({ status })

    const failure = classifyDeepSeekFailure({ error })

    expect(failure).toMatchObject({ status, type })
  })

  it('never reads an insufficient balance as a rate limit, whatever delay it states, and alerts the operator', () => {
    const error = createApiCallError({ headers: { 'retry-after': '1' }, status: 402 })

    const failure = classifyDeepSeekFailure({ error })

    expect(failure).toMatchObject({ alert: 'exhausted-provider-credit', type: 'upstream-failure' })
    expect(failure.type).not.toBe('rate-limited')
  })

  it('keeps the delay a rate limit asks for', () => {
    const error = createApiCallError({ headers: { 'retry-after': '15' }, status: 429 })

    const failure = classifyDeepSeekFailure({ error })

    expect(failure).toMatchObject({ retryAfter: '15', status: 429, type: 'rate-limited' })
  })

  it.each([
    { name: 'an expired deadline', error: new DOMException('Timed out', 'TimeoutError'), type: 'timeout' },
    { name: 'an unreachable provider', error: new APICallError({ message: 'Cannot connect to API', requestBodyValues: {},
      url: 'https://api.deepseek.com/chat/completions', isRetryable: true }), type: 'transport' },
    { name: 'a failing transport', error: new Error('socket hang up'), type: 'transport' },
  ])('keeps $name apart as $type', ({ error, type }) => {
    const failure = classifyDeepSeekFailure({ error })

    expect(failure).toEqual({ type })
  })
})

function createApiCallError({ headers = {}, status }: Readonly<{
  headers?: Readonly<Record<string, string>>
  status: number
}>) {
  const data = { error: { code: 'invalid_request_error', message: 'Private Candidate history', param: null, type: 'error' } }
  return new APICallError({ data, message: 'Private Candidate history', requestBodyValues: {}, responseBody: JSON.stringify(data),
    responseHeaders: headers, statusCode: status, url: 'https://api.deepseek.com/chat/completions' })
}
