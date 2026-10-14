import { describe, expect, it } from 'vitest'
import { assessResumeExport, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/privacy-safe-telemetry'
import { readGroupedResumeSection, structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeJobPostingExtractor, createFakeMatchEvidenceMatcher,
  createFakeResumeDocumentRenderer, createFakeResumeSectionModels, createFakeSourceProfileExtractor,
  createRecordingTelemetry } from '@resume-tailoring/application/testing'

describe('Candidate Journey preparation timing', () => {
  it('times every phase of one preparation in order, under one preparation identifier', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResumeAndPreviewIt()

    system.expectPhasesTimedInOrder(['intake', 'job-posting-extraction', 'match-evidence', 'resume-sections',
      'coherence', 'overflow-reduction', 'first-downloadable-pdf'])
    system.expectOnePreparationIdentifier()
    system.expectDurationsOfTheFakeClock()
  })

  it('gives two preparations of the same Candidate Session different random identifiers', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()

    await system.prepareTailoredResumeAgain()

    system.expectTwoPreparationIdentifiers()
    system.expectIdentifiersDerivedFromNothing()
  })

  it('records how many renders Overflow Reduction used', async () => {
    const system = createSystemUnderTest({ layout: 'two-pages' })
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectOverflowReductionRenderCountOfTheRenderer()
  })

  it('records the time to the first downloadable PDF once the preview shows one', async () => {
    const system = createSystemUnderTest({ firstPreview: 'unavailable' })
    await system.givenPreviewWithoutDownloadablePdf()

    await system.previewTailoredResume()

    system.expectFirstDownloadablePdfTimedOnce()
  })

  it('times the first downloadable PDF once, not every later render', async () => {
    const system = createSystemUnderTest()
    await system.givenPreviewedTailoredResume()

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
}>

type TimedPhase = Extract<PrivacySafeTelemetryEvent, Readonly<{ name: 'preparation-phase-timed' }>>['phase']
type PhaseTiming = Extract<PrivacySafeTelemetryEvent, Readonly<{ name: 'preparation-phase-timed' }>>

class PreparationTimingSystem {
  readonly #journey: CandidateJourney
  readonly #telemetry = createRecordingTelemetry()
  #clock = Date.now()
  #phase: TimedPhase = 'intake'
  readonly #expectedDurations = new Map<TimedPhase, number>()
  #preparationStartedAt: number | null = null
  #fittingRenderCount = 0
  #previewRenderCount = 0
  #eventsBeforeAction: number | null = null

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => this.#clock,
      telemetry: this.#telemetry,
      sourceProfileExtractor: { extract: (request) => {
        this.#advance('intake', 1_100)
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
        checkCoherence: () => {
          this.#advance('coherence', 5_500)
          return Promise.resolve({ ok: true, value: { coherent: true, languageMatches: true, issues: [] } })
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
    await this.prepareTailoredResume()
  }

  async givenPreviewWithoutDownloadablePdf() {
    await this.givenPreparedTailoredResume()
    await this.#renderPreview()
  }

  async givenPreviewedTailoredResume() {
    await this.givenPreparedTailoredResume()
    await this.#renderPreview()
  }

  async prepareTailoredResume() {
    this.#markAction()
    await this.#prepare()
  }

  async prepareTailoredResumeAgain() {
    this.#markAction()
    await this.#prepare()
  }

  async prepareTailoredResumeAndPreviewIt() {
    this.#markAction()
    await this.#prepare()
    await this.#renderPreview()
  }

  async previewTailoredResume() {
    this.#markAction()
    await this.#renderPreview()
  }

  expectPhasesTimedInOrder(phases: readonly TimedPhase[]) {
    expect(this.#timingsAfterAction().map(({ phase }) => phase)).toEqual(phases)
  }

  expectOnePreparationIdentifier() {
    expect(new Set(this.#timingsAfterAction().map(({ preparationId }) => preparationId)).size).toBe(1)
  }

  expectDurationsOfTheFakeClock() {
    const startedAt = this.#preparationStartedAt ?? expect.fail('Start a preparation first')
    expect(Object.fromEntries(this.#timingsAfterAction().map(({ phase, durationMilliseconds }) =>
      [phase, durationMilliseconds]))).toEqual({
      ...Object.fromEntries(this.#expectedDurations),
      'first-downloadable-pdf': this.#clock - startedAt,
    })
  }

  expectTwoPreparationIdentifiers() {
    const identifiers = new Set(this.#telemetry.events.flatMap(readPreparationIdentifier))
    expect(identifiers.size).toBe(2)
  }

  /** Random identifiers: neither the session's identifier, nor a preparation revision, nor any Candidate content. */
  expectIdentifiersDerivedFromNothing() {
    const view = this.#readOpenView()
    const sessionIdentifier = view.session.sessionId.replace('candidate-session-', '')
    for (const identifier of new Set(this.#telemetry.events.flatMap(readPreparationIdentifier))) {
      expect(identifier).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
      expect(identifier).not.toBe(sessionIdentifier)
      expect(view.session.preparation?.revision).not.toContain(identifier)
      expect(view.session.resumeEditing?.revision).not.toContain(identifier)
    }
    const serialized = JSON.stringify(this.#telemetry.events)
    for (const content of candidateContent) expect(serialized).not.toContain(content)
  }

  expectOverflowReductionRenderCountOfTheRenderer() {
    const timing = this.#timingsAfterAction().find(({ phase }) => phase === 'overflow-reduction')
    expect(this.#fittingRenderCount).toBeGreaterThan(1)
    expect(timing).toMatchObject({ renderCount: this.#fittingRenderCount })
  }

  expectFirstDownloadablePdfTimedOnce() {
    const startedAt = this.#preparationStartedAt ?? expect.fail('Start a preparation first')
    expect(this.#telemetry.events.filter((event) => event.name === 'preparation-phase-timed'
      && event.phase === 'first-downloadable-pdf')).toMatchObject([{ durationMilliseconds: this.#clock - startedAt }])
  }

  expectNoTimingAfterAction() {
    expect(this.#timingsAfterAction()).toEqual([])
  }

  async #prepare() {
    this.#preparationStartedAt = this.#clock
    this.#expectedDurations.clear()
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'prepared').toBe(true)
    this.#phase = 'first-downloadable-pdf'
  }

  async #renderPreview() {
    const view = this.#readOpenView()
    const document = view.session.tailoredResume ?? expect.fail('Expected a Tailored Resume')
    await this.#journey.renderResumeDocument({ document, unsupportedFieldIds: view.resumeReview?.unsupportedFieldIds ?? [] })
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

  #timingsAfterAction(): readonly PhaseTiming[] {
    expect(this.#eventsBeforeAction, 'Perform a Candidate Journey action before reading telemetry').not.toBeNull()
    return this.#telemetry.events.slice(this.#eventsBeforeAction ?? 0)
      .filter((event): event is PhaseTiming => event.name === 'preparation-phase-timed')
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

function readPreparationIdentifier(event: PrivacySafeTelemetryEvent) {
  return event.name === 'preparation-phase-timed' ? [event.preparationId] : []
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
