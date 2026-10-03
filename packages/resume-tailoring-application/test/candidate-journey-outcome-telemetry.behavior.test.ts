import { describe, expect, it } from 'vitest'
import { candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyDependencies, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/privacy-safe-telemetry'
import { createFixtureResumeSectionModels, readGroupedResumeSection, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'

describe('Candidate Journey privacy-safe outcome telemetry', () => {
  it('records journey progression through one generation action without Candidate content', async () => {
    const system = createSystemUnderTest()
    await system.givenNewConsentedSession()

    await system.generateApplicationResume()

    system.expectJourneyProgressionRecorded()
  })

  it('records each Resume Section and the whole preparation without Candidate content', async () => {
    const system = createSystemUnderTest()
    await system.givenNewConsentedSession()

    await system.generateApplicationResume()

    system.expectSectionPreparationMetricsRecorded()
  })

  it('records a download of the current resume with only its match band', async () => {
    const system = createSystemUnderTest()
    await system.givenGeneratedResume()

    system.downloadCurrentResume()

    system.expectDownloadRecorded()
  })

  it('records whether the downloaded resume was usable without structural rewriting', async () => {
    const system = createSystemUnderTest()
    await system.givenDownloadedResume()

    system.reportResumeNeedsStructuralRewriting()

    system.expectUsabilityAssessmentRecorded()
  })

  it('records a resume correction without the corrected Candidate content', async () => {
    const system = createSystemUnderTest()
    await system.givenGeneratedResume()

    system.removeValueProposition()

    system.expectCorrectionRecorded()
  })

  it('records a download of a non-tailored normalized resume', async () => {
    const system = createSystemUnderTest({ correspondence: 'none' })
    await system.givenNormalizedResume()

    system.downloadCurrentResume()

    system.expectNormalizedDownloadRecorded()
  })

  it('does not record an outcome when no resume has been prepared', async () => {
    const system = createSystemUnderTest()
    await system.givenNewConsentedSession()

    system.reportResumeNeedsStructuralRewriting()

    system.expectNoOutcomeRecorded()
  })

  it('records session expiration without Candidate content', async () => {
    const system = createSystemUnderTest({ session: 'expiring' })

    await system.openExpiringSession()

    system.expectExpirationRecorded()
  })

  it('records session deletion without Candidate content', async () => {
    const system = createSystemUnderTest()
    await system.givenGeneratedResume()

    await system.deleteCandidateSession()

    system.expectDeletionRecorded()
  })
})

function createSystemUnderTest(options: TestOptions = {}) { return new OutcomeTelemetrySystem(options) }

type TestOptions = Readonly<{ correspondence?: 'none'; session?: 'expiring' }>

class OutcomeTelemetrySystem {
  readonly #journey: CandidateJourney
  readonly #events: PrivacySafeTelemetryEvent[] = []
  #eventsBeforeAction: number | null = null

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createDependencies({ options, events: this.#events }) })
  }

  async givenNewConsentedSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-absent')
    this.#journey.startCandidateSession()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
    this.#journey.grantProcessingConsent()
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.processingConsentStatus : null
    }).toBe('granted')
    this.#markAction()
  }

  async givenGeneratedResume() {
    await this.givenNewConsentedSession()
    await this.generateApplicationResume()
    this.#markAction()
  }

  async givenDownloadedResume() {
    await this.givenGeneratedResume()
    this.downloadCurrentResume()
  }

  async givenNormalizedResume() {
    await this.givenNewConsentedSession()
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText('Source professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#preparationFinished()
    this.#journey.startTailoredResumePreparation({ purpose: 'normalized' })
    await this.#preparationFinished()
    this.#markAction()
  }

  async generateApplicationResume() {
    this.#markAction()
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText('Source professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#preparationFinished()
  }

  downloadCurrentResume() {
    this.#markAction()
    this.#journey.recordResumeDownload()
  }

  reportResumeNeedsStructuralRewriting() {
    this.#markAction()
    this.#journey.rateResumeUsefulness({ useful: false })
  }

  removeValueProposition() {
    const view = this.#journey.readView()
    const fieldId = view.status === 'candidate-session-open'
      ? view.session.tailoredResume?.valueProposition.paragraphs[0]?.id ?? '' : ''
    this.#markAction()
    this.#journey.hideResumeField({ fieldId })
  }

  async openExpiringSession() {
    this.#markAction()
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-absent')
  }

  async deleteCandidateSession() {
    this.#markAction()
    this.#journey.deleteCandidateSession()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-absent')
  }

  expectJourneyProgressionRecorded() {
    expect(this.#recordedAfterAction().filter(({ name }) => name === 'candidate-journey-phase-reached')).toEqual([
      { name: 'candidate-journey-phase-reached', phase: 'source-intake' },
      { name: 'candidate-journey-phase-reached', phase: 'job-match' },
      { name: 'candidate-journey-phase-reached', phase: 'tailored-resume-preparation' },
    ])
    expect(this.#events[0]).toEqual({ name: 'resume-tailoring-opened' })
    this.#expectNoCandidateContent()
  }

  expectSectionPreparationMetricsRecorded() {
    const recorded = this.#recordedAfterAction()
    expect(recorded.filter(({ name }) => name === 'resume-section-prepared')).toEqual(
      ['value-proposition', 'experience', 'experience', 'skills', 'education', 'languages', 'projects', 'certifications']
        .map((sectionKind) => ({ name: 'resume-section-prepared', sectionKind, outcome: 'validated', attemptCount: 1,
          durationMilliseconds: 0, inputTokens: 120, outputTokens: 40 })))
    expect(recorded.filter(({ name }) => name === 'resume-preparation-completed')).toEqual([
      { name: 'resume-preparation-completed', outcome: 'prepared', durationMilliseconds: 0, sectionCount: 8 },
    ])
    this.#expectNoCandidateContent()
  }

  expectDownloadRecorded() {
    expect(this.#recordedAfterAction()).toEqual([{ name: 'resume-downloaded', matchScoreBand: '75-100' }])
    this.#expectNoCandidateContent()
  }

  expectCorrectionRecorded() {
    expect(this.#recordedAfterAction()).toEqual([{ name: 'resume-correction-recorded', correctionKind: 'resume-claim-removal' }])
    this.#expectNoCandidateContent()
  }

  expectNormalizedDownloadRecorded() {
    expect(this.#recordedAfterAction()).toEqual([{ name: 'resume-downloaded', matchScoreBand: '0-24' }])
    this.#expectNoCandidateContent()
  }

  expectUsabilityAssessmentRecorded() {
    expect(this.#recordedAfterAction()).toEqual([{ name: 'resume-usefulness-rated', hasComment: false,
      matchScoreBand: '75-100', useful: false }])
    this.#expectNoCandidateContent()
  }

  expectNoOutcomeRecorded() {
    expect(this.#recordedAfterAction()).toEqual([])
  }

  expectExpirationRecorded() {
    expect(this.#recordedAfterAction()).toEqual([{ name: 'candidate-session-expired' }])
  }

  expectDeletionRecorded() {
    expect(this.#recordedAfterAction()).toEqual([{ name: 'candidate-session-deleted' }])
    this.#expectNoCandidateContent()
  }

  #markAction() { this.#eventsBeforeAction = this.#events.length }

  #recordedAfterAction() {
    expect(this.#eventsBeforeAction, 'Perform a Candidate Journey action before reading telemetry').not.toBeNull()
    return this.#events.slice(this.#eventsBeforeAction ?? 0)
  }

  #expectNoCandidateContent() {
    const serialized = JSON.stringify(this.#events)
    for (const content of candidateContent) expect(serialized).not.toContain(content)
  }

  async #preparationFinished() {
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.operation : 'pending'
    }).toBeNull()
  }
}

const candidateContent = ['Northwind', 'billing', 'React', 'Frontend', 'Alex', '@example.com'] as const

function createDependencies({ options, events }: Readonly<{
  options: TestOptions; events: PrivacySafeTelemetryEvent[]
}>): CandidateJourneyDependencies {
  const startedAt = Date.now()
  let session: CandidateSession | null = options.session === 'expiring' ? { expiresAt: startedAt, startedAt,
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000060', version: candidateSessionStorageVersion,
    phase: 'source-intake', processingConsent: null, sourceIntake: null, jobMatch: null, tailoredResume: null } : null
  const factMatch = { factId: 'source-fact-skills-0-name-0', factExcerpt: 'React', requirementExcerpt: 'React' } as const
  return {
    createSessionId: () => crypto.randomUUID(), now: () => startedAt,
    telemetry: { record: (event) => { events.push(event); return Promise.resolve({ ok: true, value: undefined }) } },
    languageModelGateway: { processingPolicy: policy },
    persistence: { restore: () => ({ ok: true, value: { notice: null, session } }),
      save: ({ session: nextSession }) => { session = nextSession; return { ok: true, value: session } },
      delete: () => { session = null; return { ok: true, value: null } } },
    sourceDocumentReader: { read: (document) => Promise.resolve({ ok: true,
      value: { text: new TextDecoder().decode(document.bytes), pageCount: 1 } }) },
    sourceProfileExtractor: { extract: () => Promise.resolve({ ok: true,
      value: { ...structuredResumeSource.sourceProfile, criticalAmbiguities: [] } }) },
    jobPostingDocumentReader: { read: (document) => Promise.resolve({ ok: true,
      value: { text: new TextDecoder().decode(document.bytes) } }) },
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: true, value: structuredResumeJobMatch }) },
    matchEvidenceMatcher: { match: () => Promise.resolve({ ok: true, value: options.correspondence === 'none'
      ? { adjacentEvidence: [], evidence: [], relevance: [] }
      : { adjacentEvidence: [], evidence: [{ coverage: 'covered', factMatches: [factMatch], requirementId: 'job-requirement-react' }],
        relevance: [{ requirementId: 'job-requirement-react', factMatch }] } }) },
    resumeSectionModels: createFixtureResumeSectionModels({
      writeSection: ({ section }) => Promise.resolve({ ok: true, usage: { inputTokens: 80, outputTokens: 30 },
        value: section.kind === 'value-proposition' ? { kind: 'value-proposition', paragraphs: [{ id: 'summary-billing',
          text: 'Frontend engineer building accessible billing screens.', factIds: ['source-fact-skills-0-name-0'] }] }
          : readGroupedResumeSection(section) }),
      validateFields: ({ fields }) => Promise.resolve({ ok: true, usage: { inputTokens: 40, outputTokens: 10 },
        value: { fields: fields.map(({ id }) => ({ fieldId: id, supported: true })) } }),
    }),
  }
}

const policy = { provider: 'Test', purposes: ['Write'], retentionPolicy: 'None',
  storageBehavior: 'Browser-local', transmittedDataCategories: ['Evidence'], version: 'test' } as const

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
