import { describe, expect, it, vi } from 'vitest'

import { verifyTurnstileToken } from './turnstile-verifier'

describe('Turnstile verifier', () => {
  it('accepts a successful token for the request hostname', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      hostname: 'demo.example.com',
    }))

    const result = await verifyTurnstileToken({
      expectedHostname: 'demo.example.com',
      request,
      secretKey: 'secret',
      token: 'valid-token',
    })

    expect(result).toEqual({ ok: true, value: undefined })
  })

  it('rejects tokens validated for another hostname', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      hostname: 'attacker.example.com',
    }))

    const result = await verifyTurnstileToken({
      expectedHostname: 'demo.example.com',
      request,
      secretKey: 'secret',
      token: 'valid-token',
    })

    expect(result).toEqual({ ok: false })
  })

  it('rejects failed verification responses', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: false }))

    expect(await verifyTurnstileToken({
      expectedHostname: 'demo.example.com',
      request,
      secretKey: 'secret',
      token: 'invalid-token',
    })).toEqual({ ok: false })
  })
})
