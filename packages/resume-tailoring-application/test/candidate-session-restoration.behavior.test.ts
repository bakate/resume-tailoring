import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyView, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { createFakeCandidateJourneyDependencies, createInMemoryCandidateSessionPersistence } from '@resume-tailoring/application/testing'

const startedAt = Date.UTC(2026, 8, 29, 9)
const expiresAt = startedAt + candidateSessionDurationMilliseconds

describe('Candidate Journey Candidate Session restoration', () => {
  it('reopens a stored Candidate Session before its expiry instant', async () => {
    const system = createSystemUnderTest()
    system.givenStoredSession(createStoredSession())
    system.givenCurrentTime(expiresAt - 1)

    await system.reopenCandidateJourney()

    system.expectReopenedSession()
  })

  it('discards a Candidate Session reopened at its expiry instant once and says so', async () => {
    const system = createSystemUnderTest()
    system.givenStoredSession(createStoredSession())
    system.givenCurrentTime(expiresAt)

    await system.reopenCandidateJourney()

    system.expectDiscardedSession({ notice: 'expired-session-discarded' })
  })

  it('discards a stored Candidate Session whose lifetime is not 24 hours as incompatible', async () => {
    const system = createSystemUnderTest()
    system.givenStoredSession({ ...createStoredSession(), expiresAt: startedAt + 2 * candidateSessionDurationMilliseconds })
    system.givenCurrentTime(startedAt)

    await system.reopenCandidateJourney()

    system.expectDiscardedSession({ notice: 'incompatible-session-discarded' })
  })
})

function createSystemUnderTest() {
  return new CandidateSessionRestorationTestSystem()
}

class CandidateSessionRestorationTestSystem {
  #persistence = createInMemoryCandidateSessionPersistence()
  #now = startedAt
  #view: CandidateJourneyView | null = null

  givenStoredSession(session: CandidateSession) {
    this.#persistence = createInMemoryCandidateSessionPersistence({ session })
  }

  givenCurrentTime(now: number) {
    this.#now = now
  }

  async reopenCandidateJourney() {
    const journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => this.#now, persistence: this.#persistence,
    }) })
    journey.start()
    await expect.poll(() => journey.readView().status).not.toBe('preparing-session')
    this.#view = journey.readView()
  }

  expectReopenedSession() {
    const view = this.#readView()
    expect(view.status).toBe('candidate-session-open')
    expect(view.status === 'candidate-session-open' ? view.session : null).toEqual(createStoredSession())
  }

  expectDiscardedSession({ notice }: Readonly<{ notice: 'expired-session-discarded' | 'incompatible-session-discarded' }>) {
    expect(this.#readView()).toEqual({ status: 'candidate-session-absent', notice })
    expect(this.#persistence.readStoredSession()).toBeNull()
  }

  #readView() {
    if (this.#view === null) expect.fail('Expected the Candidate Journey to be reopened before reading its outcome')
    return this.#view
  }
}

function createStoredSession(): CandidateSession {
  return {
    expiresAt, startedAt, jobMatch: null, phase: 'source-intake', processingConsent: null,
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000086',
    sourceIntake: null, tailoredResume: null, version: candidateSessionStorageVersion,
  }
}
