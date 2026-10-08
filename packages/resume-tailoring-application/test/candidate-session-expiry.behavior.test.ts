import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { createFakeCandidateJourneyDependencies, createInMemoryCandidateSessionPersistence } from '@resume-tailoring/application/testing'

const startedAt = Date.UTC(2026, 9, 8, 9)
const expiresAt = startedAt + candidateSessionDurationMilliseconds

describe('Candidate Session expiry while the page stays open', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('keeps an open Candidate Session until its expiry instant', async () => {
    const system = createSystemUnderTest()
    await system.givenOpenSessionAt(expiresAt - 60_000)

    await system.waitUntil(expiresAt - 1)

    system.expectSessionStillOpen()
  })

  it('deletes an open Candidate Session at its expiry instant and says so', async () => {
    const system = createSystemUnderTest()
    await system.givenOpenSessionAt(expiresAt - 60_000)

    await system.waitUntil(expiresAt)

    system.expectSessionDeletedAtExpiry()
  })
})

function createSystemUnderTest() {
  return new CandidateSessionExpiryTestSystem()
}

class CandidateSessionExpiryTestSystem {
  readonly #persistence = createInMemoryCandidateSessionPersistence({ session: createStoredSession() })
  #now = startedAt
  #journey: CandidateJourney | null = null
  #hasWaited = false

  async givenOpenSessionAt(now: number) {
    this.#now = now
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => this.#now, persistence: this.#persistence,
    }) })
    this.#journey.start()
    await vi.advanceTimersByTimeAsync(0)
    if (this.#journey.readView().status !== 'candidate-session-open') expect.fail('Expected the stored Candidate Session to open')
  }

  /** Lets the open page's clock run, as a Candidate who leaves the tab open would. */
  async waitUntil(instant: number) {
    const elapsed = instant - this.#now
    this.#now = instant
    await vi.advanceTimersByTimeAsync(elapsed)
    this.#hasWaited = true
  }

  expectSessionStillOpen() {
    expect(this.#readJourney().readView().status).toBe('candidate-session-open')
    expect(this.#persistence.readStoredSession()).toEqual(createStoredSession())
  }

  expectSessionDeletedAtExpiry() {
    expect(this.#readJourney().readView()).toEqual({ status: 'candidate-session-absent', notice: 'expired-session-discarded' })
    expect(this.#persistence.readStoredSession()).toBeNull()
  }

  #readJourney() {
    if (this.#journey === null || !this.#hasWaited) expect.fail('Expected time to pass on an open Candidate Session before reading its outcome')
    return this.#journey
  }
}

function createStoredSession(): CandidateSession {
  return {
    expiresAt, startedAt, jobMatch: null, phase: 'source-intake', processingConsent: null,
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000146',
    sourceIntake: null, tailoredResume: null, version: candidateSessionStorageVersion,
  }
}
