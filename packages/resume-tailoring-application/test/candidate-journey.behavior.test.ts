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
import type {
  SourceDocumentFailure,
  SourceDocumentReader,
  StructuredSourceProfileExtraction,
} from '@resume-tailoring/application/source-intake'

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

describe('Candidate Journey Source Intake', () => {
  it('structures pasted professional text without transmitting contact details', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenProcessingConsentIsGranted()

    // Action
    await system.submitPastedProfessionalText()

    // Then
    system.expectStructuredSourceProfileToBeReadyForJobMatch()
  })

  it('isolates a Critical Ambiguity without withholding usable Candidate Facts', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenProcessingConsentIsGranted()
    system.givenAnAmbiguousExperienceDate()

    // Action
    await system.submitPastedProfessionalTextForAmbiguityResolution()

    // Then
    system.expectOnlyAmbiguousFactToBeExcluded()
  })

  it('resolves a Critical Ambiguity through its targeted question', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenSourceIntakeRequiresAmbiguityResolution()

    // Action
    await system.answerCriticalAmbiguity()

    // Then
    system.expectResolvedFactToBeReadyForJobMatch()
  })

  it.each([
    ['a scan', 'scanned-document'],
    ['an encrypted document', 'encrypted-document'],
    ['an empty document', 'empty-document'],
    ['an oversized document', 'oversized-document'],
    ['an unsupported document', 'unsupported-document'],
  ] as const)('keeps the Candidate Session after %s fails', async (_caseName, failure) => {
    const system = createSystemUnderTest()

    // Given
    await system.givenProcessingConsentIsGranted()
    system.givenSourceDocumentFailsWith(failure)

    // Action
    await system.submitInvalidSourceDocument()

    // Then
    system.expectSourceDocumentFailureWithoutSessionLoss(failure)
  })

  it('rejects a Source Document longer than five pages without losing the session', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenProcessingConsentIsGranted()
    system.givenSixPageSourceDocument()

    // Action
    await system.submitInvalidSourceDocument()

    // Then
    system.expectSourceDocumentFailureWithoutSessionLoss('oversized-document')
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
  readonly #modelRequests: string[] = []
  #extractionResult: StructuredSourceProfileExtraction = structuredExtraction
  #documentReadResult: Awaited<ReturnType<SourceDocumentReader['read']>> | null = null
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
        sourceDocumentReader: { read: ({ bytes }) => Promise.resolve(
          this.#documentReadResult ?? {
            ok: true,
            value: { pageCount: null, text: new TextDecoder().decode(bytes) },
          },
        ) },
        sourceProfileExtractor: { extract: ({ professionalContent }) => {
          this.#modelRequests.push(professionalContent)
          return Promise.resolve({ ok: true, value: this.#extractionResult })
        } },
      },
    })
  }

  async givenCandidateSessionIsOpen() {
    this.givenCandidateJourneyIsStarted()
    await this.#waitForView('candidate-session-absent')
    this.#candidateJourney.startCandidateSession()
    await this.#waitForView('candidate-session-open')
  }

  async givenProcessingConsentIsGranted() {
    await this.givenCandidateSessionIsOpen()
    this.#candidateJourney.grantProcessingConsent()
    await this.#waitForView('candidate-session-open', 'granted')
  }

  givenAnAmbiguousExperienceDate() {
    this.#extractionResult = ambiguousStructuredExtraction
  }

  givenSourceDocumentFailsWith(failure: SourceDocumentFailure) {
    this.#documentReadResult = { ok: false, error: failure }
  }

  givenSixPageSourceDocument() {
    this.#documentReadResult = {
      ok: true,
      value: { pageCount: 6, text: 'Senior FullStack Developer' },
    }
  }

  async givenSourceIntakeRequiresAmbiguityResolution() {
    await this.givenProcessingConsentIsGranted()
    this.givenAnAmbiguousExperienceDate()
    this.#candidateJourney.submitSourceDocument(createPastedSourceDocument())
    await this.#waitForCriticalAmbiguity()
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

  async submitPastedProfessionalText() {
    this.#candidateJourney.submitSourceDocument(createPastedSourceDocument())
    this.#view = await this.#waitForPhase('job-match')
    this.#completedAction = 'source-document-submitted'
  }

  async submitPastedProfessionalTextForAmbiguityResolution() {
    this.#candidateJourney.submitSourceDocument(createPastedSourceDocument())
    this.#view = await this.#waitForCriticalAmbiguity()
    this.#completedAction = 'source-document-submitted'
  }

  async answerCriticalAmbiguity() {
    this.#candidateJourney.resolveCriticalAmbiguity({
      ambiguityId: 'critical-ambiguity-1',
      answer: '2021',
    })
    this.#view = await this.#waitForPhase('job-match')
    this.#completedAction = 'critical-ambiguity-answered'
  }

  async submitInvalidSourceDocument() {
    this.#candidateJourney.submitSourceDocument(createPastedSourceDocument())
    this.#view = await this.#waitForSourceIntakeFailure()
    this.#completedAction = 'source-document-submitted'
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

  expectStructuredSourceProfileToBeReadyForJobMatch() {
    this.#expectCompletedAction('source-document-submitted')
    const view = this.#readOpenView()
    expect(view.session.phase).toBe('job-match')
    expect(view.session.sourceIntake?.sourceProfile).toMatchObject({
      certifications: [{ name: 'AWS Solutions Architect' }],
      education: [{ institution: 'Example University' }],
      experiences: [{ organization: 'Acme', role: 'Senior FullStack Developer' }],
      languages: [{ name: 'French' }],
      projects: [{ name: 'Billing platform' }],
      skills: [{ name: 'TypeScript' }],
    })
    expect(view.session.sourceIntake?.candidateFacts.every(
      (candidateFact) => candidateFact.status === 'attested',
    )).toBe(true)
    expect(view.session.sourceIntake?.contactDetails).toEqual([
      { kind: 'email', value: 'bakate@example.com' },
    ])
    expect(this.#modelRequests).toHaveLength(1)
    expect(this.#modelRequests[0]).not.toContain('bakate@example.com')
  }

  expectOnlyAmbiguousFactToBeExcluded() {
    this.#expectCompletedAction('source-document-submitted')
    const sourceIntake = this.#readOpenView().session.sourceIntake
    expect(this.#readOpenView().session.phase).toBe('source-intake')
    expect(sourceIntake?.criticalAmbiguities).toEqual([expect.objectContaining({
      question: 'What year did you start at Acme?',
    })])
    expect(sourceIntake?.candidateFacts.filter(
      (candidateFact) => candidateFact.status === 'excluded-critical-ambiguity',
    )).toEqual([expect.objectContaining({ path: 'experiences.0.startDate.0' })])
    expect(sourceIntake?.candidateFacts.some(
      (candidateFact) => candidateFact.value === 'TypeScript'
        && candidateFact.status === 'attested',
    )).toBe(true)
  }

  expectResolvedFactToBeReadyForJobMatch() {
    this.#expectCompletedAction('critical-ambiguity-answered')
    const sourceIntake = this.#readOpenView().session.sourceIntake
    expect(sourceIntake?.criticalAmbiguities).toEqual([])
    expect(sourceIntake?.candidateFacts.find(
      (candidateFact) => candidateFact.path === 'experiences.0.startDate.0',
    )).toMatchObject({ status: 'attested', value: '2021' })
    expect(sourceIntake?.sourceProfile.experiences[0]?.startDate).toBe('2021')
  }

  expectSourceDocumentFailureWithoutSessionLoss(expectedFailure: SourceDocumentFailure) {
    this.#expectCompletedAction('source-document-submitted')
    const view = this.#readOpenView()
    expect(view.sourceIntakeFailure).toBe(expectedFailure)
    expect(view.session.phase).toBe('source-intake')
    expect(view.session.sourceIntake).toBeNull()
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

  async #waitForPhase(phase: CandidateSession['phase']) {
    const currentView = this.#candidateJourney.readView()
    if (currentView.status === 'candidate-session-open' && currentView.session.phase === phase) {
      return currentView
    }
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open' || nextView.session.phase !== phase) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }

  async #waitForCriticalAmbiguity() {
    const currentView = this.#candidateJourney.readView()
    if (hasCriticalAmbiguity({ view: currentView })) return currentView
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (!hasCriticalAmbiguity({ view: nextView })) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }

  async #waitForSourceIntakeFailure() {
    const currentView = this.#candidateJourney.readView()
    if (currentView.status === 'candidate-session-open'
      && currentView.sourceIntakeFailure !== null) return currentView
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open'
          || nextView.sourceIntakeFailure === null) return
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
    sourceIntake: null,
    startedAt: currentTime,
    version: candidateSessionStorageVersion,
  }
}

const structuredExtraction = {
  certifications: [{ name: 'AWS Solutions Architect', issuer: 'AWS', issuedAt: '2024' }],
  criticalAmbiguities: [],
  education: [{ institution: 'Example University', qualification: 'MSc Computer Science' }],
  experiences: [{
    achievements: ['Built a billing platform'],
    context: 'Payments',
    endDate: null,
    organization: 'Acme',
    role: 'Senior FullStack Developer',
    startDate: '2021',
  }],
  languages: [{ name: 'French', proficiency: 'Native' }],
  projects: [{ description: 'Billing platform', name: 'Billing platform' }],
  skills: [{ category: 'Programming language', name: 'TypeScript' }],
} as const satisfies StructuredSourceProfileExtraction

const ambiguousStructuredExtraction = {
  ...structuredExtraction,
  experiences: [{ ...structuredExtraction.experiences[0], startDate: null }],
  criticalAmbiguities: [{
    path: 'experiences.0.startDate.0',
    question: 'What year did you start at Acme?',
  }],
} as const satisfies StructuredSourceProfileExtraction

function createPastedSourceDocument() {
  return {
    bytes: new TextEncoder().encode([
      'Bakate Example',
      'bakate@example.com',
      'Senior FullStack Developer at Acme',
    ].join('\n')),
    mediaType: 'text/plain',
    name: 'pasted-professional-text.txt',
  } as const
}

function hasCriticalAmbiguity({ view }: Readonly<{ view: CandidateJourneyView }>) {
  return view.status === 'candidate-session-open'
    && (view.session.sourceIntake?.criticalAmbiguities.length ?? 0) > 0
}

type CandidateJourneyAction =
  | 'candidate-session-restored'
  | 'critical-ambiguity-answered'
  | 'processing-consent-granted'
  | 'source-document-submitted'
