import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'

const sessionStartedAt = 1_000
const candidateSessionStorageKey = 'honest-resume:candidate-session'
const candidateSession = {
  expiresAt: sessionStartedAt + candidateSessionDurationMilliseconds,
  phase: 'source-intake',
  sessionId: 'candidate-session-00000000-0000-4000-8000-000000000038',
  startedAt: sessionStartedAt,
  version: candidateSessionStorageVersion,
} as const satisfies CandidateSession

describe('browser Candidate Session persistence', () => {
  it('stores and restores the current version for 24 hours', () => {
    const storage = createMemoryStorage()
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.save({ session: candidateSession })).toEqual({
      ok: true, value: candidateSession,
    })
    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session: candidateSession },
    })
  })

  it.each([
    ['an incompatible version', { ...candidateSession, version: 999 }],
    ['an invalid lifetime', { ...candidateSession, expiresAt: sessionStartedAt + (48 * 60 * 60 * 1_000) }],
  ])('discards %s', (_caseName, storedSession) => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify(storedSession) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true,
      value: { notice: 'incompatible-session-discarded', session: null },
    })
    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })

  it('deletes a stored Candidate Session', () => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify(candidateSession) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.delete()).toEqual({ ok: true, value: null })
    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })
})

function createMemoryStorage({ initialValue = null }: Readonly<{
  initialValue?: string | null
}> = {}) {
  const storedValues = new Map<string, string>()
  if (initialValue !== null) storedValues.set(candidateSessionStorageKey, initialValue)
  return {
    getItem: (key: string) => storedValues.get(key) ?? null,
    removeItem: (key: string) => { storedValues.delete(key) },
    setItem: (key: string, value: string) => { storedValues.set(key, value) },
  }
}
