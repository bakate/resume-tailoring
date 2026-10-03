// PROTOTYPE (throwaway): do these behaviour tests express the Processing Consent guarantee of the proxy?
import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import {
  createFakeCandidateJourneyDependencies,
  createFakeResumeSectionModels,
  createFakeSourceProfileExtractor,
  createInMemoryCandidateSessionPersistence,
  testProcessingPolicy,
} from '@resume-tailoring/application/testing'

describe('Processing Consent around model-backed ports', () => {
  it('never sends Candidate content to the Language Model Provider before Processing Consent', async () => {
    const system = createSystemUnderTest({ consent: 'absent' })

    // Given
    await system.givenCandidateSessionIsOpen()

    // Action
    await system.submitPastedProfessionalText()

    // Then
    system.expectNoCandidateContentSent()
    system.expectSourceIntakeFailure('processing-consent-required')
  })

  it('sends no further Candidate content once the Candidate Session is deleted during preparation', async () => {
    const system = createSystemUnderTest({ consent: 'granted' })

    // Given
    await system.givenResumeSectionWritingIsInFlight()

    // Action
    await system.deleteCandidateSessionBeforeTheReply()

    // Then
    system.expectNoCandidateContentSentAfterDeletion()
    system.expectNoCandidateSessionStored()
  })

  it('sends no content of a deleted Candidate Session under the consent of a new one', async () => {
    const system = createSystemUnderTest({ consent: 'granted' })

    // Given
    await system.givenResumeSectionWritingIsInFlight()

    // Action
    await system.reopenConsentedCandidateSessionBeforeTheReply()

    // Then
    system.expectNoCandidateContentSentAfterDeletion()
    system.expectNewCandidateSessionWithoutPreparation()
  })
})

function createSystemUnderTest({ consent }: Readonly<{ consent: 'absent' | 'granted' }>) {
  return new ProcessingConsentTestSystem({ consent })
}

class ProcessingConsentTestSystem {
  readonly #persistence
  readonly #sentContent: string[] = []
  readonly #candidateJourney: CandidateJourney
  #sentBeforeDeletion: number | null = null
  #releaseWriting: (() => void) | null = null
  #view: CandidateJourneyView | null = null

  constructor({ consent }: Readonly<{ consent: 'absent' | 'granted' }>) {
    this.#persistence = createInMemoryCandidateSessionPersistence({ session: createStoredSession({ consent }) })
    const fakeExtractor = createFakeSourceProfileExtractor()
    this.#candidateJourney = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => startedAt,
      persistence: this.#persistence,
      sourceProfileExtractor: { extract: (request) => {
        this.#sentContent.push('source-profile-extraction')
        return fakeExtractor.extract(request)
      } },
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: async ({ section }) => {
          this.#sentContent.push(`write ${section.key}`)
          if (this.#releaseWriting === null) await new Promise<void>((resolve) => { this.#releaseWriting = resolve })
          return { ok: true, value: readGroupedResumeSection(section) }
        },
        validateFields: ({ section, fields }) => {
          this.#sentContent.push(`validate ${section.key}`)
          return Promise.resolve({ ok: true, value: { fields: fields.map(({ id }) => ({ fieldId: id, supported: true })) } })
        },
        checkCoherence: () => {
          this.#sentContent.push('check coherence')
          return Promise.resolve({ ok: true, value: { coherent: true, languageMatches: true, issues: [] } })
        },
      }),
    }) })
  }

  async givenCandidateSessionIsOpen() {
    this.#candidateJourney.start()
    await this.#waitFor((view) => view.status === 'candidate-session-open')
  }

  async givenResumeSectionWritingIsInFlight() {
    await this.givenCandidateSessionIsOpen()
    this.#candidateJourney.startTailoredResumePreparation({ sourceDocument: documentFromText('Professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#waitFor(() => this.#releaseWriting !== null)
  }

  async submitPastedProfessionalText() {
    this.#candidateJourney.submitSourceDocument(documentFromText('Professional evidence'))
    this.#view = await this.#waitFor((view) => view.status === 'candidate-session-open'
      && view.operation === null && view.sourceIntakeFailure !== null)
  }

  async deleteCandidateSessionBeforeTheReply() {
    this.#sentBeforeDeletion = this.#sentContent.length
    this.#candidateJourney.deleteCandidateSession()
    await this.#waitFor((view) => view.status === 'candidate-session-absent')
    this.#view = await this.#deliverTheReply()
  }

  async reopenConsentedCandidateSessionBeforeTheReply() {
    this.#sentBeforeDeletion = this.#sentContent.length
    this.#candidateJourney.deleteCandidateSession()
    await this.#waitFor((view) => view.status === 'candidate-session-absent')
    this.#candidateJourney.startCandidateSession()
    await this.#waitFor((view) => view.status === 'candidate-session-open')
    this.#candidateJourney.grantProcessingConsent()
    await this.#waitFor((view) => view.status === 'candidate-session-open' && view.processingConsentStatus === 'granted')
    this.#view = await this.#deliverTheReply()
  }

  expectNoCandidateContentSent() {
    expect(this.#sentContent).toEqual([])
  }

  expectNoCandidateContentSentAfterDeletion() {
    if (this.#sentBeforeDeletion === null) throw new Error('Delete the Candidate Session before reading what was sent')
    expect(this.#sentContent.slice(this.#sentBeforeDeletion)).toEqual([])
  }

  expectSourceIntakeFailure(failure: string) {
    const view = this.#readView()
    expect(view.status === 'candidate-session-open' ? view.sourceIntakeFailure : view.status).toBe(failure)
  }

  expectNoCandidateSessionStored() {
    expect(this.#persistence.readStoredSession()).toBeNull()
    expect(this.#readView().status).toBe('candidate-session-absent')
  }

  expectNewCandidateSessionWithoutPreparation() {
    const view = this.#readView()
    expect(view.status === 'candidate-session-open' ? view.session.preparation ?? null : view.status).toBeNull()
    expect(this.#persistence.readStoredSession()?.preparation ?? null).toBeNull()
  }

  async #deliverTheReply() {
    this.#releaseWriting?.()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return this.#candidateJourney.readView()
  }

  #readView() {
    if (this.#view === null) throw new Error('Perform the Action before reading its outcome')
    return this.#view
  }

  async #waitFor(isReady: (view: CandidateJourneyView) => boolean) {
    for (let turn = 0; turn < 200; turn += 1) {
      const view = this.#candidateJourney.readView()
      if (isReady(view)) return view
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    throw new Error('The Candidate Journey never reached the expected view')
  }
}

const startedAt = Date.UTC(2026, 9, 3, 9)

function createStoredSession({ consent }: Readonly<{ consent: 'absent' | 'granted' }>): CandidateSession {
  return { expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt, version: candidateSessionStorageVersion,
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000085', phase: 'source-intake',
    processingConsent: consent === 'granted' ? { grantedAt: startedAt, policy: testProcessingPolicy } : null,
    sourceIntake: null, jobMatch: null, tailoredResume: null }
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
