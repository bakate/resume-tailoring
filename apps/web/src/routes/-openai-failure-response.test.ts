import { describe, expect, it } from 'vitest'

import { createOpenAiFailureResponse } from './-openai-failure-response'

describe('OpenAI route failure responses', () => {
  it('returns a retryable timeout without exposing provider details', async () => {
    const response = createOpenAiFailureResponse({
      failure: { type: 'timeout' },
      operation: 'match-evidence',
    })

    expect(response.status).toBe(504)
    expect(await response.json()).toEqual({
      error: 'match-evidence-timeout',
      ok: false,
      retryable: true,
    })
  })

  it('returns a bounded-input response without retrying', async () => {
    const response = createOpenAiFailureResponse({
      failure: { characterCount: 60_001, maximumCharacterCount: 60_000, type: 'request-too-large' },
      operation: 'match-evidence',
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: 'match-evidence-input-too-large',
      ok: false,
      retryable: false,
    })
  })

  it('preserves Retry-After for rate limiting', () => {
    const response = createOpenAiFailureResponse({
      failure: { retryAfter: '15', status: 429, type: 'rate-limited' },
      operation: 'job-posting-extraction',
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('15')
  })
})
