import { describe, expect, it } from 'vitest'

import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion } from './candidate-journey'
import type { CandidateSession, CandidateSessionPersistence } from './candidate-journey'

export type CandidateSessionPersistenceSetup = Readonly<{
  storedSession: CandidateSession | null
  storageAvailable: boolean
}>

const startedAt = 1_000
const storedSession = {
  expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
  jobMatch: null, phase: 'source-intake', processingConsent: null,
  sessionId: 'candidate-session-00000000-0000-4000-8000-000000000084',
  sourceIntake: null, tailoredResume: null, version: candidateSessionStorageVersion,
} as const satisfies CandidateSession

/** The behavior every Candidate Session persistence shares, run against the in-memory fake and each real adapter. */
export function describeCandidateSessionPersistenceContract({ name, createPersistence }: Readonly<{
  name: string
  createPersistence: (setup: CandidateSessionPersistenceSetup) => CandidateSessionPersistence
}>) {
  describe(`${name} honors the Candidate Session persistence contract`, () => {
    it('restores no Candidate Session when none is stored', () => {
      const persistence = createPersistence({ storedSession: null, storageAvailable: true })

      const restored = persistence.restore({ now: startedAt })

      expect(restored).toEqual({ ok: true, value: { notice: null, session: null } })
    })

    it('restores the Candidate Session it saved', () => {
      const persistence = createPersistence({ storedSession: null, storageAvailable: true })

      const saved = persistence.save({ session: storedSession })

      expect(saved).toEqual({ ok: true, value: storedSession })
      expect(persistence.restore({ now: startedAt })).toEqual({ ok: true, value: { notice: null, session: storedSession } })
    })

    it('forgets a deleted Candidate Session', () => {
      const persistence = createPersistence({ storedSession, storageAvailable: true })

      const deleted = persistence.delete()

      expect(deleted).toEqual({ ok: true, value: null })
      expect(persistence.restore({ now: startedAt })).toEqual({ ok: true, value: { notice: null, session: null } })
    })

    it('discards an expired Candidate Session once and says so', () => {
      const persistence = createPersistence({ storedSession, storageAvailable: true })

      const restored = persistence.restore({ now: storedSession.expiresAt })

      expect(restored).toEqual({ ok: true, value: { notice: 'expired-session-discarded', session: null } })
      expect(persistence.restore({ now: startedAt })).toEqual({ ok: true, value: { notice: null, session: null } })
    })

    it.each([
      ['restoring', (persistence: CandidateSessionPersistence) => persistence.restore({ now: startedAt })],
      ['saving', (persistence: CandidateSessionPersistence) => persistence.save({ session: storedSession })],
      ['deleting', (persistence: CandidateSessionPersistence) => persistence.delete()],
    ] as const)('reports unavailable storage when %s', (_operation, useStorage) => {
      const persistence = createPersistence({ storedSession, storageAvailable: false })

      const result = useStorage(persistence)

      expect(result).toEqual({ ok: false, error: 'candidate-session-storage-unavailable' })
    })
  })
}
