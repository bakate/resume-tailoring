import { describe, expect, it } from 'vitest'

import { createDemoAccessCookie } from './demo-access-session'
import { createDemoAccessGuardResponse, readDemoAccessDecision } from './demo-access-authorization'

const environment = {
  DEMO_ACCESS_MODE: 'enforced',
  DEMO_ORIGIN_SECRET: 'an-origin-secret-with-at-least-32-characters',
  DEMO_PUBLIC_HOSTNAME: 'resume-studio.example.workers.dev',
  DEMO_SESSION_SECRET: 'a-session-secret-with-at-least-32-characters',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  TURNSTILE_SITE_KEY: 'turnstile-site-key',
} as const
const nowMilliseconds = Date.UTC(2026, 8, 27, 12)

describe('demo access authorization', () => {
  it('allows requests when protection is disabled', () => {
    expect(readDemoAccessDecision({
      cookieHeader: '',
      environment: {},
      nowMilliseconds,
    })).toEqual({ ok: true, value: { access: 'granted', mode: 'disabled' } })
  })

  it('asks for a challenge without a signed session', () => {
    expect(readDemoAccessDecision({
      cookieHeader: '',
      environment,
      nowMilliseconds,
    })).toEqual({
      ok: true,
      value: { access: 'challenge-required', siteKey: 'turnstile-site-key' },
    })
  })

  it('allows requests with a signed session', () => {
    const cookieHeader = createDemoAccessCookie({
      issuedAtMilliseconds: nowMilliseconds,
      sessionSecret: environment.DEMO_SESSION_SECRET,
    })

    expect(readDemoAccessDecision({
      cookieHeader,
      environment,
      nowMilliseconds: nowMilliseconds + 1_000,
    })).toEqual({ ok: true, value: { access: 'granted', mode: 'enforced' } })
  })

  it('rejects a protected request without a signed session', async () => {
    const response = createDemoAccessGuardResponse({
      environment,
      request: createOriginRequest(),
    })

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({
      ok: false,
      error: { type: 'demo-access-required' },
    })
  })

  it('rejects requests that bypass the trusted proxy', async () => {
    const cookieHeader = createDemoAccessCookie({
      issuedAtMilliseconds: nowMilliseconds,
      sessionSecret: environment.DEMO_SESSION_SECRET,
    })
    const response = createDemoAccessGuardResponse({
      environment,
      request: new Request('https://demo.example/api/match-analysis', {
        headers: { cookie: cookieHeader },
      }),
    })

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      ok: false,
      error: { type: 'demo-origin-required' },
    })
  })

  it('fails closed when the protection configuration is incomplete', () => {
    const response = createDemoAccessGuardResponse({
      environment: { DEMO_ACCESS_MODE: 'enforced' },
      request: new Request('https://demo.example/api/match-analysis'),
    })

    expect(response?.status).toBe(503)
  })
})

function createOriginRequest() {
  return new Request('https://demo.example/api/match-analysis', {
    headers: { 'x-resume-studio-origin': environment.DEMO_ORIGIN_SECRET },
  })
}
