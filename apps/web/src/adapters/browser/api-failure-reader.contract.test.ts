import { describe, expect, it } from 'vitest'

import { apiFailureStatuses, failureResponse } from '../../api-failure'
import type { ApiFailureType } from '../../api-failure'
import { readApiFailure, readApiFailureBody } from './api-failure-reader'

describe('API failure reader', () => {
  it.each(Object.entries(apiFailureStatuses) as [ApiFailureType, number][])(
    'reads %s from its HTTP %i failure envelope',
    async (type, status) => {
      const response = failureResponse({ type })

      const failure = await readApiFailure(response)

      expect(response.status).toBe(status)
      expect(failure).toEqual({ type })
    },
  )

  it('keeps when a rate-limited caller may retry', async () => {
    const response = failureResponse({ type: 'rate-limited', retryAfterSeconds: 15 })

    const failure = await readApiFailure(response)

    expect(failure).toEqual({ type: 'rate-limited', retryAfterSeconds: 15 })
  })

  it('reads the failure without the tokens a failed model call consumed', async () => {
    const response = failureResponse({ type: 'invalid-provider-response', usage: { inputTokens: 9, outputTokens: 1 } })

    const failure = await readApiFailure(response)

    expect(failure).toEqual({ type: 'invalid-provider-response' })
  })

  it.each([
    ['an empty body', () => new Response(null, { status: 502 })],
    ['an HTML error page', () => new Response('<html>Bad gateway</html>', { status: 502 })],
    ['a former operation-named failure', () => Response.json({ ok: false, error: 'match-evidence-timeout', retryable: true },
      { status: 504 })],
    ['an unknown failure type', () => Response.json({ ok: false, error: { type: 'permanent' } }, { status: 500 })],
    ['a failure without its type', () => Response.json({ ok: false, error: {} }, { status: 400 })],
    ['a negative retry delay', () => Response.json({ ok: false, error: { type: 'rate-limited', retryAfterSeconds: -1 } },
      { status: 429 })],
    ['a bare 401 without envelope', () => new Response(null, { status: 401 })],
    ['a failure envelope with a successful status', () => Response.json({ ok: false, error: { type: 'timeout' } })],
    ['a successful body', () => Response.json({ ok: true, value: {} })],
  ] as const)('reads %s as an unexpected response', async (_body, answer) => {
    const failure = await readApiFailure(answer())

    expect(failure).toEqual({ type: 'unexpected-response' })
  })

  it('reads a body an adapter already consumed', () => {
    const body = { ok: false, error: { type: 'input-too-large' } }

    const failure = readApiFailureBody({ response: { ok: false }, body })

    expect(failure).toEqual({ type: 'input-too-large' })
  })
})
