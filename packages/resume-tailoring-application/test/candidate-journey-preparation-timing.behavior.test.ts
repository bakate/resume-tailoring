import { describe, expect, it } from 'vitest'
import { assessResumeExport, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, ResumeCoherenceInput, ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/privacy-safe-telemetry'
import { readGroupedResumeSection, structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeJobPostingExtractor, createFakeMatchEvidenceMatcher,
  createFakeResumeDocumentRenderer, createFakeResumeSectionModels, createFakeSourceProfileExtractor,
  createRecordingTelemetry } from '@resume-tailoring/application/testing'

describe('Candidate Journey Preparation Timing', () => {
  it('times every phase of one preparation in order, under one preparation identifier', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()

    await system.previewTailoredResume()

    system.expectLatestPreparationTimedInOrder(['source-intake', 'job-posting-extraction', 'match-evidence',
      'resume-sections', 'coherence', 'overflow-reduction', 'first-downloadable-pdf'])
    system.expectLatestPreparationUnderOneIdentifier()
    system.expectLatestPreparationDurationsOfTheFakeClock()
  })

  it('gives two preparations of the same Candidate Session different random identifiers, carried by no other event', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()

    await system.prepareTailoredResume()

    system.expectTwoPreparationIdentifiers()
    system.expectIdentifiersDerivedFromNothing()
  })

  it('records how many renders Overflow Reduction used', async () => {
    const system = createSystemUnderTest({ layout: 'two-pages' })
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectOverflowReductionRenderCountOfTheRenderer()
  })

  it('times Resume Sections and coherence again when coherence sends sections back for rewriting', async () => {
    const system = createSystemUnderTest({ coherence: 'rewrite-once' })
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectLatestPreparationTimedInOrder(['source-intake', 'job-posting-extraction', 'match-evidence',
      'resume-sections', 'coherence', 'resume-sections', 'coherence', 'overflow-reduction'])
  })

  it('records the time to the first downloadable PDF once the preview shows one', async () => {
    const system = createSystemUnderTest({ firstPreview: 'unavailable' })
    await system.givenPreviewWithoutDownloadablePdf()

    await system.previewTailoredResume()

    system.expectFirstDownloadablePdfTimedSinceThePreparationStarted()
  })

  it('times the first downloadable PDF once, not every later render', async () => {
    const system = createSystemUnderTest()
    await system.givenPreviewedTailoredResume()

    await system.previewTailoredResume()

    system.expectNoTimingAfterAction()
  })

  it('does not time the first downloadable PDF of a preparation that reuses its inputs', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumePreparedAgainInAnotherLanguage()

    await system.previewTailoredResume()

    system.expectNoTimingAfterAction()
  })

  it('does not time the first downloadable PDF once the Candidate changed the resume', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResumeWithChangedContacts()

    await system.previewTailoredResume()

    system.expectNoTimingAfterAction()
  })
})

function createSystemUnderTest(options: TestOptions = {}) { return new PreparationTimingSystem(options) }

type TestOptions = Readonly<{
  /** `two-pages` lays every draft out on two pages, so Overflow Reduction renders after each of its steps. */
  layout?: 'two-pages'
  /** `unavailable` fails the first render the preview asks for. */
  firstPreview?: 'unavailable'
  /** `rewrite-once` finds the first experience's role mixed up on the first check only. */
  coherence?: 'rewrite-once'
}>

type PhaseTiming = Extract<PrivacySafeTelemetryEvent, Readonly<{ name: 'preparation-phase-timed' }>>
type TimedPhase = PhaseTiming['phase']

class PreparationTimingSystem {
  readonly #journey: CandidateJourney
  readonly #telemetry = createRecordingTelemetry()
  #clock = Date.now()
  #phase: TimedPhase = 'source-intake'
  readonly #expectedDurations = new Map<TimedPhase, number>()
  #preparationStartedAt = 0
  #preparationEventsFrom = 0
  #fittingRenderCount = 0
  #previewRenderCount = 0
  #coherenceCheckCount = 0
  #eventsBeforeAction: number | null = null

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => this.#clock,
      telemetry: this.#telemetry,
      sourceProfileExtractor: { extract: (request) => {
        this.#advance('source-intake', 1_100)
        return createFakeSourceProfileExtractor().extract(request)
      } },
      jobPostingExtractor: { extract: (request) => {
        this.#advance('job-posting-extraction', 2_200)
        return createFakeJobPostingExtractor().extract(request)
      } },
      matchEvidenceMatcher: { match: (request) => {
        this.#advance('match-evidence', 3_300)
        return createFakeMatchEvidenceMatcher().match(request)
      } },
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: ({ section }) => {
          this.#advance('resume-sections', 400)
          return Promise.resolve({ ok: true, value: readGroupedResumeSection(section) })
        },
        validateFields: ({ fields }) => {
          this.#advance('resume-sections', 50)
          return Promise.resolve({ ok: true, value: { fields: fields.map(({ id }) => ({ fieldId: id, supported: true })) } })
        },
        checkCoherence: (input) => {
          this.#advance('coherence', 5_500)
          this.#coherenceCheckCount += 1
          return Promise.resolve({ ok: true, value: this.#checkCoherence({ input, options }) })
        },
      }),
      resumeDocumentRenderer: createFakeResumeDocumentRenderer({ render: (request) => this.#render({ request, options }) }),
    }) })
  }

  async givenConsentedSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-absent')
    this.#journey.startCandidateSession()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
    this.#journey.grantProcessingConsent()
    await expect.poll(() => this.#readOpenView().processingConsentStatus).toBe('granted')
  }

  async givenPreparedTailoredResume() {
    await this.givenConsentedSession()
    await this.#prepare({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
  }

  async givenPreviewWithoutDownloadablePdf() {
    await this.givenPreparedTailoredResume()
    await this.#renderPreview()
  }

  async givenPreviewedTailoredResume() {
    await this.givenPreparedTailoredResume()
    await this.#renderPreview()
  }

  async givenTailoredResumePreparedAgainInAnotherLanguage() {
    await this.givenPreparedTailoredResume()
    await this.#prepare({ locale: 'fr' })
  }

  async givenPreparedTailoredResumeWithChangedContacts() {
    await this.givenPreparedTailoredResume()
    const resume = this.#readOpenView().session.tailoredResume ?? expect.fail('Expected a Tailored Resume')
    this.#journey.updateResumeContacts({ identity: resume.identity,
      contactDetails: [...resume.contactDetails, { kind: 'phone', value: '+33 6 00 00 00 00' }] })
    await expect.poll(() => this.#readOpenView().session.tailoredResume?.contactDetails.length)
      .toBe(resume.contactDetails.length + 1)
  }

  async prepareTailoredResume() {
    this.#markAction()
    await this.#prepare({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
  }

  async previewTailoredResume() {
    this.#markAction()
    await this.#renderPreview()
  }

  expectLatestPreparationTimedInOrder(phases: readonly TimedPhase[]) {
    expect(this.#timingsOfLatestPreparation().map(({ phase }) => phase)).toEqual(phases)
  }

  expectLatestPreparationUnderOneIdentifier() {
    expect(new Set(this.#timingsOfLatestPreparation().map(({ preparationId }) => preparationId)).size).toBe(1)
  }

  expectLatestPreparationDurationsOfTheFakeClock() {
    expect(Object.fromEntries(this.#timingsOfLatestPreparation().map(({ phase, durationMilliseconds }) =>
      [phase, durationMilliseconds]))).toEqual({
      ...Object.fromEntries(this.#expectedDurations),
      'first-downloadable-pdf': this.#clock - this.#preparationStartedAt,
    })
  }

  expectTwoPreparationIdentifiers() {
    expect(this.#preparationIdentifiers().length).toBe(2)
  }

  /** Random identifiers: not the session's, not in a revision, not Candidate content, and on no other event. */
  expectIdentifiersDerivedFromNothing() {
    const { session } = this.#readOpenView()
    const otherEvents = JSON.stringify(this.#recordedEvents().filter(({ name }) => name !== 'preparation-phase-timed'))
    for (const identifier of this.#preparationIdentifiers()) {
      expect(identifier).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
      expect(session.sessionId).not.toContain(identifier)
      expect(session.preparation?.revision).not.toContain(identifier)
      expect(session.resumeEditing?.revision).not.toContain(identifier)
      expect(otherEvents).not.toContain(identifier)
    }
    const serialized = JSON.stringify(this.#recordedEvents())
    for (const content of candidateContent) expect(serialized).not.toContain(content)
  }

  expectOverflowReductionRenderCountOfTheRenderer() {
    const timing = this.#timingsAfterAction().find(({ phase }) => phase === 'overflow-reduction')
    expect(this.#fittingRenderCount).toBeGreaterThan(1)
    expect(timing).toMatchObject({ renderCount: this.#fittingRenderCount })
  }

  expectFirstDownloadablePdfTimedSinceThePreparationStarted() {
    expect(this.#timingsOfLatestPreparation().filter(({ phase }) => phase === 'first-downloadable-pdf'))
      .toMatchObject([{ durationMilliseconds: this.#clock - this.#preparationStartedAt }])
  }

  expectNoTimingAfterAction() {
    expect(this.#timingsAfterAction()).toEqual([])
  }

  async #prepare(request: Parameters<CandidateJourney['startTailoredResumePreparation']>[0]) {
    this.#preparationStartedAt = this.#clock
    this.#preparationEventsFrom = this.#telemetry.events.length
    this.#expectedDurations.clear()
    this.#journey.startTailoredResumePreparation(request)
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'prepared').toBe(true)
    this.#phase = 'first-downloadable-pdf'
  }

  async #renderPreview() {
    const view = this.#readOpenView()
    const document = view.session.tailoredResume ?? expect.fail('Expected a Tailored Resume')
    await this.#journey.renderResumeDocument({ document, unsupportedFieldIds: view.resumeReview?.unsupportedFieldIds ?? [] })
  }

  #checkCoherence({ input, options }: Readonly<{ input: ResumeCoherenceInput; options: TestOptions }>) {
    const coherent = { coherent: true, languageMatches: true, issues: [] }
    const role = input.document.experiences[0]?.role
    if (options.coherence !== 'rewrite-once' || this.#coherenceCheckCount > 1 || role == null) return coherent
    return { ...coherent, coherent: false, issues: [{ fieldId: role.id, kind: 'mixed-association' as const }] }
  }

  #render({ request, options }: Readonly<{ request: ResumeRenderRequest; options: TestOptions }>) {
    const previewing = this.#phase === 'first-downloadable-pdf'
    this.#advance(previewing ? 'first-downloadable-pdf' : 'overflow-reduction', 700)
    if (previewing) this.#previewRenderCount += 1
    else this.#fittingRenderCount += 1
    if (previewing && options.firstPreview === 'unavailable' && this.#previewRenderCount === 1) {
      return Promise.reject(new Error('Renderer unavailable'))
    }
    const pageCount = !previewing && options.layout === 'two-pages' ? 2 : 1
    return Promise.resolve({ pdf: new TextEncoder().encode('%PDF-'), assessment: assessResumeExport({ ...request,
      layout: { status: 'fits', revision: request.draft.revision, pageCount } }) })
  }

  #advance(phase: TimedPhase, milliseconds: number) {
    this.#phase = phase
    this.#clock += milliseconds
    if (phase !== 'first-downloadable-pdf') this.#expectedDurations.set(phase, (this.#expectedDurations.get(phase) ?? 0) + milliseconds)
  }

  #markAction() { this.#eventsBeforeAction = this.#telemetry.events.length }

  #recordedEvents() {
    expect(this.#eventsBeforeAction, 'Perform a Candidate Journey action before reading telemetry').not.toBeNull()
    return this.#telemetry.events
  }

  #timingsAfterAction() {
    return this.#recordedEvents().slice(this.#eventsBeforeAction ?? 0).filter(isPhaseTiming)
  }

  #timingsOfLatestPreparation() {
    return this.#recordedEvents().slice(this.#preparationEventsFrom).filter(isPhaseTiming)
  }

  #preparationIdentifiers() {
    return [...new Set(this.#recordedEvents().filter(isPhaseTiming).map(({ preparationId }) => preparationId))]
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') expect.fail(`Expected an open Candidate Session, got ${view.status}`)
    return view
  }
}

/** Its name and email make the prepared resume complete enough to download. */
const sourceDocumentText = 'Alex Morgan\nalex.morgan@example.com\nSource professional evidence'
const candidateContent = ['Northwind', 'billing', 'React', 'Frontend', 'Alex', '@example.com'] as const

function isPhaseTiming(event: PrivacySafeTelemetryEvent): event is PhaseTiming {
  return event.name === 'preparation-phase-timed'
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
