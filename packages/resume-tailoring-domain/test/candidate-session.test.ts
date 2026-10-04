import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  hasValidCandidateSessionLifetime,
  isCandidateSessionExpired,
} from '../src/candidate-session'

const startedAt = 1_000

describe('Candidate Session lifetime', () => {
  it.each([
    { lifetime: 'exactly 24 hours', expiresAt: startedAt + candidateSessionDurationMilliseconds, valid: true },
    { lifetime: '48 hours', expiresAt: startedAt + 2 * candidateSessionDurationMilliseconds, valid: false },
    { lifetime: 'one millisecond short of 24 hours', expiresAt: startedAt + candidateSessionDurationMilliseconds - 1, valid: false },
  ])('accepts a lifetime of $lifetime only when it is the Candidate Session duration', ({ expiresAt, valid }) => {
    const session = { startedAt, expiresAt }

    const accepted = hasValidCandidateSessionLifetime({ session })

    expect(accepted).toBe(valid)
  })

  it.each([
    { moment: 'before its expiry instant', now: startedAt + candidateSessionDurationMilliseconds - 1, expired: false },
    { moment: 'at its expiry instant', now: startedAt + candidateSessionDurationMilliseconds, expired: true },
    { moment: 'after its expiry instant', now: startedAt + candidateSessionDurationMilliseconds + 1, expired: true },
  ])('treats a Candidate Session $moment as expired: $expired', ({ now, expired }) => {
    const session = { expiresAt: startedAt + candidateSessionDurationMilliseconds }

    const result = isCandidateSessionExpired({ session, now })

    expect(result).toBe(expired)
  })
})
