import { describe, expect, it } from 'vitest'

import { readOpenAiApiFailure } from './openai-api-failure'

describe('OpenAI failures as API failures', () => {
  it.each([
    [{ type: 'timeout' }, { type: 'timeout' }],
    [{ type: 'request-too-large', characterCount: 60_001, maximumCharacterCount: 60_000 }, { type: 'input-too-large' }],
    [{ type: 'rate-limited', status: 429, retryAfter: '15' }, { type: 'rate-limited', retryAfterSeconds: 15 }],
    [{ type: 'rate-limited', status: 429, retryAfter: 'Wed, 21 Oct 2026 07:28:00 GMT' }, { type: 'rate-limited' }],
    [{ type: 'invalid-model-output' }, { type: 'invalid-provider-response' }],
    [{ type: 'invalid-response' }, { type: 'invalid-provider-response' }],
    [{ type: 'upstream-invalid-request', status: 401 }, { type: 'service-misconfigured' }],
    [{ type: 'upstream-failure', status: 503 }, { type: 'provider-unavailable' }],
    [{ type: 'transport' }, { type: 'provider-unavailable' }],
  ] as const)('reads %o as %o without naming the operation', (failure, apiFailure) => {
    expect(readOpenAiApiFailure(failure)).toEqual(apiFailure)
  })
})
