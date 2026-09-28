import { describe, expect, it } from 'vitest'

import {
  createDemoAccessCookie,
  hasValidDemoAccess,
} from './demo-access-session'

const sessionSecret = 'test-session-secret-with-at-least-32-characters'
const issuedAtMilliseconds = Date.UTC(2026, 8, 27, 12)

describe('demo access session', () => {
  it('accepts an unexpired signed cookie', () => {
    const cookie = createDemoAccessCookie({
      issuedAtMilliseconds,
      sessionSecret,
    })

    expect(hasValidDemoAccess({
      cookieHeader: cookie.split(';')[0] ?? '',
      nowMilliseconds: issuedAtMilliseconds + 1_000,
      sessionSecret,
    })).toBe(true)
  })

  it('rejects a modified signature', () => {
    const cookie = createDemoAccessCookie({
      issuedAtMilliseconds,
      sessionSecret,
    }).replace('resume-demo-access=', 'resume-demo-access=x')

    expect(hasValidDemoAccess({
      cookieHeader: cookie,
      nowMilliseconds: issuedAtMilliseconds + 1_000,
      sessionSecret,
    })).toBe(false)
  })

  it('rejects an expired cookie', () => {
    const cookie = createDemoAccessCookie({ issuedAtMilliseconds, sessionSecret })

    expect(hasValidDemoAccess({
      cookieHeader: cookie,
      nowMilliseconds: issuedAtMilliseconds + 31 * 60 * 1_000,
      sessionSecret,
    })).toBe(false)
  })
})
