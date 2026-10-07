import { describe, expect, it } from 'vitest'

import { apiFailureSchema, failureResponse } from './api-failure'

describe('API failure responses', () => {
  it.each([
    ['demo-access-required', 401],
    ['demo-origin-required', 403],
    ['demo-access-unavailable', 503],
    ['invalid-input', 400],
    ['input-too-large', 413],
    ['rate-limited', 429],
    ['timeout', 504],
    ['provider-unavailable', 502],
    ['invalid-provider-response', 502],
    ['service-misconfigured', 503],
  ] as const)('answers %s with HTTP %i and the failure envelope', async (type, status) => {
    const response = failureResponse({ type })

    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ ok: false, error: { type } })
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0')
    expect(response.headers.get('Retry-After')).toBeNull()
  })

  it('tells a rate-limited caller when to retry, in the body and the Retry-After header', async () => {
    const response = failureResponse({ type: 'rate-limited', retryAfterSeconds: 15 })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('15')
    expect(await response.json()).toEqual({ ok: false, error: { type: 'rate-limited', retryAfterSeconds: 15 } })
  })

  it('keeps the tokens a failed model call consumed', async () => {
    const response = failureResponse({ type: 'invalid-provider-response', usage: { inputTokens: 100, outputTokens: 10 } })

    expect(await response.json()).toEqual({ ok: false, error: { type: 'invalid-provider-response' },
      usage: { inputTokens: 100, outputTokens: 10 } })
  })

  it('accepts every envelope the builder writes and rejects any other failure body', async () => {
    expect(apiFailureSchema.safeParse(await failureResponse({ type: 'rate-limited', retryAfterSeconds: 3 }).json()).success).toBe(true)
    expect(apiFailureSchema.safeParse({ ok: false, error: 'match-evidence-timeout', retryable: true }).success).toBe(false)
    expect(apiFailureSchema.safeParse({ ok: false, error: { type: 'permanent' } }).success).toBe(false)
  })
})
