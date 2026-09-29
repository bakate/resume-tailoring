import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type {
  CandidateJourney,
  CandidateJourneyView,
  CandidateSession,
  CandidateSessionPersistence,
} from '@resume-tailoring/application/candidate-journey'
import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'

const currentTime = Date.UTC(2026, 8, 29, 9)
const activeProcessingPolicy = {
  provider: 'Example Model Provider',
  purposes: ['Extract professional evidence', 'Write supported resume content'],
  retentionPolicy: 'Requests may be retained for abuse monitoring for up to 30 days.',
  storageBehavior: 'Candidate content is not stored for model training.',
  transmittedDataCategories: ['Professional facts', 'Job Posting content'],
  version: '2026-09-29',
} as const satisfies ProcessingPolicy

describe('Candidate Journey Processing Consent', () => {
  it('grants consent to the active Processing Policy', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateSessionIsOpen()

    // Action
    await system.grantProcessingConsent()

    // Then
    system.expectActiveProcessingConsentToBeGranted()
  })

  it('requires renewed consent when the active policy has materially changed', async () => {
    const system = createSystemUnderTest({
      storedSession: createConsentedCandidateSession(),
      processingPolicy: { ...activeProcessingPolicy, provider: 'Changed Model Provider' },
    })

    // Given
    system.givenCandidateJourneyIsStarted()

    // Action
    await system.restoreCandidateSession()

    // Then
    system.expectProcessingConsentToBeRequired()
  })
})

function createSystemUnderTest({
  processingPolicy = activeProcessingPolicy,
  storedSession = null,
}: Readonly<{
  processingPolicy?: ProcessingPolicy
  storedSession?: CandidateSession | null
}> = {}) {
  return new CandidateJourneyTestSystem({ processingPolicy, storedSession })
}

class CandidateJourneyTestSystem {
  readonly #candidateJourney: CandidateJourney
  #completedAction: CandidateJourneyAction | null = null
  #view: CandidateJourneyView | null = null

  constructor({ processingPolicy, storedSession }: Readonly<{
    processingPolicy: ProcessingPolicy
    storedSession: CandidateSession | null
  }>) {
    this.#candidateJourney = createCandidateJourney({
      dependencies: {
        createSessionId: () => '00000000-0000-4000-8000-000000000039',
        languageModelGateway: { processingPolicy },
        now: () => currentTime,
        persistence: createInMemoryPersistence({ storedSession }),
      },
    })
  }

  async givenCandidateSessionIsOpen() {
    this.givenCandidateJourneyIsStarted()
    await this.#waitForView('candidate-session-absent')
    this.#candidateJourney.startCandidateSession()
    await this.#waitForView('candidate-session-open')
  }

  givenCandidateJourneyIsStarted() {
    this.#candidateJourney.start()
  }

  async grantProcessingConsent() {
    this.#candidateJourney.grantProcessingConsent()
    this.#view = await this.#waitForView('candidate-session-open', 'granted')
    this.#completedAction = 'processing-consent-granted'
  }

  async restoreCandidateSession() {
    this.#view = await this.#waitForView('candidate-session-open')
    this.#completedAction = 'candidate-session-restored'
  }

  expectActiveProcessingConsentToBeGranted() {
    this.#expectCompletedAction('processing-consent-granted')
    expect(this.#readOpenView().processingConsentStatus).toBe('granted')
    expect(this.#readOpenView().session.processingConsent).toEqual({
      grantedAt: currentTime,
      policy: activeProcessingPolicy,
    })
  }

  expectProcessingConsentToBeRequired() {
    this.#expectCompletedAction('candidate-session-restored')
    expect(this.#readOpenView().processingConsentStatus).toBe('required')
  }

  #expectCompletedAction(expectedAction: CandidateJourneyAction) {
    expect(this.#completedAction, 'Expected a caller-visible Action before reading the outcome')
      .toBe(expectedAction)
  }

  #readOpenView() {
    if (this.#view?.status !== 'candidate-session-open') {
      expect.fail('Expected an open Candidate Session before reading Processing Consent')
    }
    return this.#view
  }

  async #waitForView(
    status: CandidateJourneyView['status'],
    processingConsentStatus?: 'granted' | 'required',
  ) {
    const currentView = this.#candidateJourney.readView()
    if (matchesView({ currentView, processingConsentStatus, status })) return currentView
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (!matchesView({ currentView: nextView, processingConsentStatus, status })) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }
}

function matchesView({ currentView, processingConsentStatus, status }: Readonly<{
  currentView: CandidateJourneyView
  processingConsentStatus?: 'granted' | 'required'
  status: CandidateJourneyView['status']
}>) {
  if (currentView.status !== status) return false
  return processingConsentStatus === undefined
    || (currentView.status === 'candidate-session-open'
      && currentView.processingConsentStatus === processingConsentStatus)
}

function createInMemoryPersistence({ storedSession }: Readonly<{
  storedSession: CandidateSession | null
}>): CandidateSessionPersistence {
  let session = storedSession
  return {
    delete: () => {
      session = null
      return { ok: true, value: null }
    },
    restore: () => ({ ok: true, value: { notice: null, session } }),
    save: ({ session: nextSession }) => {
      session = nextSession
      return { ok: true, value: session }
    },
  }
}

function createConsentedCandidateSession(): CandidateSession {
  return {
    expiresAt: currentTime + candidateSessionDurationMilliseconds,
    phase: 'source-intake',
    processingConsent: { grantedAt: currentTime, policy: activeProcessingPolicy },
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000039',
    startedAt: currentTime,
    version: candidateSessionStorageVersion,
  }
}

type CandidateJourneyAction = 'candidate-session-restored' | 'processing-consent-granted'
