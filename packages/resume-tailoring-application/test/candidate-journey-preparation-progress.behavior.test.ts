import { describe, expect, it } from 'vitest'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, ResumeCoherenceInput } from '@resume-tailoring/application/candidate-journey'
import { structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeDocumentRenderer,
  createFakeResumeSectionModels } from '@resume-tailoring/application/testing'

describe('Candidate Journey preparation progress', () => {
  it('exposes each preparation phase in order, with the Resume Sections written out of the total', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectPhasesExposedInOrder(['source-intake', 'job-posting-extraction', 'match-evidence',
      'resume-sections', 'coherence', 'overflow-reduction'])
    system.expectWrittenSectionsCountedOneByOneUpToTheTotal()
  })

  it('exposes no Resume Section before the sections are planned', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectNoSectionExposedBeforeWritingSections()
  })

  it('keeps every validated Resume Section exposed while checking coherence and laying out the pages', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectEverySectionValidatedDuring(['coherence', 'overflow-reduction'])
  })

  it('keeps laying out the pages exposed while the preview renders the first PDF', async () => {
    const system = createSystemUnderTest({ render: 'held' })
    await system.givenPreparedTailoredResume()

    await system.startPreviewingTailoredResume()

    system.expectLayingOutThePagesWithoutStandInSections()
  })

  it('returns to no phase once the PDF is downloadable', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()

    await system.previewTailoredResume()

    system.expectDownloadablePdf()
    system.expectNoPhase()
  })

  it('returns to no phase when the preparation fails', async () => {
    const system = createSystemUnderTest({ coherence: 'timeout' })
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailed()
    system.expectNoPhase()
  })

  it('no longer exposes as validated the content of a section coherence sends back for rewriting', async () => {
    const system = createSystemUnderTest({ coherence: 'rewrite-first-experience-once' })
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectFirstExperienceUnvalidatedWhenWritingResumesAfterCoherence()
    system.expectPhasesExposedInOrder(['source-intake', 'job-posting-extraction', 'match-evidence',
      'resume-sections', 'coherence', 'resume-sections', 'coherence', 'overflow-reduction'])
  })
})

function createSystemUnderTest(options: TestOptions = {}) { return new PreparationProgressSystem(options) }

type TestOptions = Readonly<{
  /**
   * `rewrite-first-experience-once` finds the first experience's role mixed up on the first check only; `timeout`
   * fails every check.
   */
  coherence?: 'rewrite-first-experience-once' | 'timeout'
  /** `held` never finishes the preview's render, so the test reads the view while it runs. */
  render?: 'held'
}>

type Action = 'preparation' | 'preview' | 'held-preview'
type OpenView = Extract<CandidateJourneyView, Readonly<{ status: 'candidate-session-open' }>>
type PreparationProgress = NonNullable<OpenView['preparationProgress']>
type ProgressPhase = PreparationProgress['phase']

class PreparationProgressSystem {
  readonly #journey: CandidateJourney
  // Every progress the view exposed during the latest preparation, in order.
  readonly #observed: PreparationProgress[] = []
  #coherenceChecks = 0
  #lastRender: Awaited<ReturnType<CandidateJourney['renderResumeDocument']>> | null = null
  #action: Action | null = null
  #heldRenders = 0

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      resumeSectionModels: createFakeResumeSectionModels({ checkCoherence: (input) => {
        this.#coherenceChecks += 1
        if (options.coherence === 'timeout') return Promise.resolve({ ok: false, error: { type: 'timeout' } })
        return Promise.resolve({ ok: true, value: this.#checkCoherence({ input, options }) })
      } }),
      // Overflow Reduction renders during the preparation; only the preview's render is held.
      resumeDocumentRenderer: createFakeResumeDocumentRenderer({ render: (request) => {
        if (options.render !== 'held' || this.#action !== 'held-preview') return createFakeResumeDocumentRenderer().render(request)
        this.#heldRenders += 1
        return new Promise(() => undefined)
      } }),
    }) })
    this.#journey.subscribe(() => {
      const view = this.#journey.readView()
      const progress = view.status === 'candidate-session-open' ? view.preparationProgress : null
      if (progress !== null && progress !== this.#observed.at(-1)) this.#observed.push(progress)
    })
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

  async prepareTailoredResume() {
    this.#action = 'preparation'
    this.#observed.length = 0
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome !== null).toBe(true)
  }

  async previewTailoredResume() {
    this.#action = 'preview'
    this.#lastRender = await this.#renderPreview()
  }

  async startPreviewingTailoredResume() {
    this.#action = 'held-preview'
    void this.#renderPreview()
    await expect.poll(() => this.#heldRenders).toBe(1)
  }

  #renderPreview() {
    const view = this.#readOpenView()
    const document = view.session.tailoredResume ?? expect.fail('Expected a Tailored Resume')
    return this.#journey.renderResumeDocument({ document, unsupportedFieldIds: view.resumeReview?.unsupportedFieldIds ?? [] })
  }

  #expectAction(action: Action) {
    if (this.#action !== action) expect.fail(`Perform the ${action} action before reading its outcome`)
  }

  expectPhasesExposedInOrder(phases: readonly ProgressPhase[]) {
    this.#expectAction('preparation')
    const exposed = this.#observed.map(({ phase }) => phase)
      .filter((phase, index, all) => index === 0 || all[index - 1] !== phase)
    expect(exposed).toEqual(phases)
  }

  expectWrittenSectionsCountedOneByOneUpToTheTotal() {
    this.#expectAction('preparation')
    // Writing starts by planning the sections, which only then are counted.
    const counts = this.#observedDuring('resume-sections').flatMap(({ sectionCount }) => sectionCount === null ? [] : [sectionCount])
    const total = counts[0]?.total ?? expect.fail('Expected Resume Sections to be written')
    expect(total).toBeGreaterThan(1)
    expect(counts.every((count) => count.total === total)).toBe(true)
    expect([...new Set(counts.map(({ written }) => written))]).toEqual(Array.from({ length: total + 1 }, (_unused, index) => index))
  }

  expectNoSectionExposedBeforeWritingSections() {
    this.#expectAction('preparation')
    const writing = this.#observed.findIndex(({ phase }) => phase === 'resume-sections')
    if (writing < 0) expect.fail('Expected Resume Sections to be written')
    const beforeWriting = this.#observed.slice(0, writing)
    expect(beforeWriting.length).toBeGreaterThan(0)
    expect(beforeWriting.map(({ sections, sectionCount }) => ({ sections, sectionCount })))
      .toEqual(beforeWriting.map(() => ({ sections: [], sectionCount: null })))
  }

  expectEverySectionValidatedDuring(phases: readonly ProgressPhase[]) {
    this.#expectAction('preparation')
    for (const phase of phases) {
      const during = this.#observedDuring(phase)
      expect(during.length, `Expected the ${phase} phase to be exposed`).toBeGreaterThan(0)
      for (const { sections, sectionCount } of during) {
        expect(sections.length).toBeGreaterThan(1)
        expect(sections.every(({ status }) => status === 'validated')).toBe(true)
        expect(sectionCount).toEqual({ written: sections.length, total: sections.length })
      }
    }
  }

  expectFirstExperienceUnvalidatedWhenWritingResumesAfterCoherence() {
    this.#expectAction('preparation')
    const firstCoherence = this.#observed.findIndex(({ phase }) => phase === 'coherence')
    const rewriting = this.#observed.slice(firstCoherence).find(({ phase }) => phase === 'resume-sections')
      ?? expect.fail('Expected Resume Sections to be written again after coherence')
    const firstExperience = rewriting.sections.find(({ key }) => key === 'experiences.0')
    expect(firstExperience).toMatchObject({ status: 'planned' })
    expect(firstExperience).not.toHaveProperty('content')
    expect(rewriting.sectionCount).toEqual({ written: rewriting.sections.length - 1, total: rewriting.sections.length })
  }

  expectLayingOutThePagesWithoutStandInSections() {
    this.#expectAction('held-preview')
    expect(this.#readOpenView().preparationProgress).toEqual({ phase: 'overflow-reduction', sections: [], sectionCount: null })
  }

  expectDownloadablePdf() {
    this.#expectAction('preview')
    expect(this.#lastRender?.pdf).toBeInstanceOf(Uint8Array)
  }

  expectPreparationFailed() {
    this.#expectAction('preparation')
    expect(this.#readOpenView().preparationOutcome).toMatchObject({ status: 'failed' })
  }

  /** After a preparation that exposed its phases, or after the preview rendered the PDF it was laying out. */
  expectNoPhase() {
    if (this.#action === null || this.#action === 'held-preview') expect.fail('Prepare or preview before reading the phase')
    expect(this.#observed.length, 'Expected the preparation to expose its phases first').toBeGreaterThan(0)
    expect(this.#readOpenView().preparationProgress).toBeNull()
  }

  #observedDuring(phase: ProgressPhase) {
    return this.#observed.filter((progress) => progress.phase === phase)
  }

  #checkCoherence({ input, options }: Readonly<{ input: ResumeCoherenceInput; options: TestOptions }>) {
    const coherent = { coherent: true, languageMatches: true, issues: [] }
    const role = input.document.experiences[0]?.role
    if (options.coherence !== 'rewrite-first-experience-once' || this.#coherenceChecks > 1 || role == null) return coherent
    return { ...coherent, coherent: false, issues: [{ fieldId: role.id, kind: 'mixed-association' as const }] }
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') expect.fail(`Expected an open Candidate Session, got ${view.status}`)
    return view
  }
}

/** Its name and email make the prepared resume complete enough to download. */
const sourceDocumentText = 'Alex Morgan\nalex.morgan@example.com\nSource professional evidence'

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
