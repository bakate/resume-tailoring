import { describe, expect, it } from 'vitest'

import { validateDemoAccessEnvironment } from './demo-access-environment'

describe('demo access environment', () => {
  it('keeps local development open by default', () => {
    expect(validateDemoAccessEnvironment({ environment: {} })).toEqual({
      ok: true,
      value: { mode: 'disabled' },
    })
  })

  it('requires every secret when protection is enforced', () => {
    const result = validateDemoAccessEnvironment({
      environment: { DEMO_ACCESS_MODE: 'enforced' },
    })

    expect(result.ok).toBe(false)
  })

  it('accepts a complete enforced configuration', () => {
    const result = validateDemoAccessEnvironment({
      environment: {
        DEMO_ACCESS_MODE: 'enforced',
        DEMO_ORIGIN_SECRET: 'an-origin-secret-with-at-least-32-characters',
        DEMO_PUBLIC_HOSTNAME: 'resume-studio.example.workers.dev',
        DEMO_SESSION_SECRET: 'a-session-secret-with-at-least-32-characters',
        TURNSTILE_SECRET_KEY: 'turnstile-secret',
        TURNSTILE_SITE_KEY: 'turnstile-site-key',
      },
    })

    expect(result).toEqual({
      ok: true,
      value: {
        mode: 'enforced',
        originSecret: 'an-origin-secret-with-at-least-32-characters',
        publicHostname: 'resume-studio.example.workers.dev',
        sessionSecret: 'a-session-secret-with-at-least-32-characters',
        turnstileSecretKey: 'turnstile-secret',
        turnstileSiteKey: 'turnstile-site-key',
      },
    })
  })
})
