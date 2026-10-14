import { describe, expect, it } from 'vitest'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, ResumeCoherenceInput, ResumeDocumentCoherence, ResumeRenderResult,
  ResumeSectionContent } from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import { createFakeCandidateJourneyDependencies, createFakeResumeDocumentRenderer,
  createFakeResumeSectionModels } from '@resume-tailoring/application/testing'

describe('Candidate Journey Page Budget fitting during the coherence check', () => {
  it('starts fitting the Page Budget of the assembled document before the coherence check answers', async () => {
    const system = createSystemUnderTest({ coherence: 'unanswered' })
    await system.givenConsentedSession()

    await system.startTailoredResumePreparationUntilCoherenceIsChecked()

    system.expectFittedDocuments(['assembled'])
    system.expectCoherenceUnanswered()
  })

  it('keeps the fitted resume without fitting again when coherence accepts the document unchanged', async () => {
    const system = createSystemUnderTest({ coherence: 'accepts', answers: 'fitting-first' })
    await system.givenPreparedTailoredResume()

    const preview = await system.previewTailoredResume()

    system.expectFittedDocuments(['assembled'])
    system.expectPreviewShowingTheFit({ preview, fitNumber: 1 })
  })

  it('waits for the fitting already running when coherence accepts the document unchanged before it ends', async () => {
    const system = createSystemUnderTest({ coherence: 'accepts', answers: 'coherence-first' })
    await system.givenPreparedTailoredResume()

    const preview = await system.previewTailoredResume()

    system.expectFittedDocuments(['assembled'])
    system.expectPreviewShowingTheFit({ preview, fitNumber: 1 })
  })

  it('fits once more the document coherence accepted after removing a redundant field', async () => {
    const system = createSystemUnderTest({ coherence: 'removes-redundant-project', answers: 'fitting-first' })
    await system.givenPreparedTailoredResume()

    const preview = await system.previewTailoredResume()

    system.expectFittedDocuments(['assembled', 'without-project'])
    system.expectPreviewShowingTheFit({ preview, fitNumber: 2 })
  })

  it('fits the rewritten document the second coherence check accepted after sending a section back', async () => {
    const system = createSystemUnderTest({ coherence: 'sends-projects-back-once', answers: 'fitting-first' })
    await system.givenPreparedTailoredResume()

    const preview = await system.previewTailoredResume()

    system.expectFittedDocuments(['assembled', 'rewritten-projects'])
    system.expectPreviewShowingTheFit({ preview, fitNumber: 2 })
  })

  it('never shows the fitted resume of a preparation the coherence check failed', async () => {
    const system = createSystemUnderTest({ coherence: 'fails', answers: 'fitting-first' })
    await system.givenFailedPreparation()

    const preview = await system.previewTheFittedDocument()

    system.expectFittedDocuments(['assembled'])
    system.expectNoFittedResumeShown(preview)
  })
})

function createSystemUnderTest(options: TestOptions) { return new SpeculativeFitSystem(options) }

type TestOptions = Readonly<{
  coherence: 'unanswered' | 'accepts' | 'removes-redundant-project' | 'sends-projects-back-once' | 'fails'
  /** Which of the first coherence answer and the first fitting ends first. */
  answers?: 'fitting-first' | 'coherence-first'
}>

type FittedDocument = 'assembled' | 'without-project' | 'rewritten-projects'

const rewrittenSuffix = ' (rewritten)'

class SpeculativeFitSystem {
  readonly #journey: CandidateJourney
  readonly #options: TestOptions
  readonly #fittedDocuments: TailoredResume[] = []
  readonly #firstFitting = createGate()
  readonly #layoutPhase = createGate()
  #coherenceChecks = 0
  #coherenceAnswers = 0
  #renderCount = 0
  #acted = false

  constructor(options: TestOptions) {
    this.#options = options
    const renderer = createFakeResumeDocumentRenderer()
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: ({ section, rejectedFields }) => Promise.resolve({ ok: true, value: rejectedFields.length === 0
          ? readGroupedResumeSection(section) : withRewrittenFields(readGroupedResumeSection(section)) }),
        checkCoherence: (input) => this.#checkCoherence(input),
      }),
      resumeDocumentRenderer: createFakeResumeDocumentRenderer({
        render: async (request) => {
          this.#renderCount += 1
          return renderer.render(request)
        },
        fitToPageBudget: async (request) => {
          this.#fittedDocuments.push(request.draft.document)
          const fitNumber = this.#fittedDocuments.length
          if (fitNumber === 1 && this.#options.answers === 'coherence-first') await this.#layoutPhase.opened
          const fit = await renderer.fitToPageBudget(request)
          if (fitNumber === 1) this.#firstFitting.open()
          return { ...fit, render: { ...fit.render, pdf: fittedPdf(fitNumber) } }
        },
      }),
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

  async startTailoredResumePreparationUntilCoherenceIsChecked() {
    this.#acted = true
    this.#startPreparation()
    await expect.poll(() => this.#coherenceChecks).toBe(1)
    await expect.poll(() => this.#fittedDocuments.length).toBe(1)
  }

  async givenPreparedTailoredResume() {
    await this.givenConsentedSession()
    this.#startPreparation()
    if (this.#options.answers === 'coherence-first') {
      await expect.poll(() => this.#readOpenView().preparationProgress?.phase).toBe('overflow-reduction')
      this.#layoutPhase.open()
    }
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'prepared').toBe(true)
  }

  async givenFailedPreparation() {
    await this.givenConsentedSession()
    this.#startPreparation()
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'failed').toBe(true)
  }

  /** Renders the preview as the interface does, with the saved Tailored Resume and its photo. */
  async previewTailoredResume() {
    this.#acted = true
    return this.#previewResume(this.#readOpenView().session.tailoredResume ?? expect.fail('Expected a Tailored Resume'))
  }

  /** Asks for the preview of the document the coherence check was checking when its fitting started. */
  async previewTheFittedDocument() {
    this.#acted = true
    return this.#previewResume(this.#fittedDocuments[0] ?? expect.fail('Expected a fitted document'))
  }

  expectFittedDocuments(documents: readonly FittedDocument[]) {
    this.#assertActed()
    expect(this.#fittedDocuments.map(readFittedDocument)).toEqual(documents)
  }

  expectCoherenceUnanswered() {
    this.#assertActed()
    expect({ checks: this.#coherenceChecks, answers: this.#coherenceAnswers }).toEqual({ checks: 1, answers: 0 })
  }

  /** The preview of the prepared resume shows the PDF of that fitting, without rendering the resume again. */
  expectPreviewShowingTheFit({ preview, fitNumber }: Readonly<{ preview: ResumeRenderResult; fitNumber: number }>) {
    this.#assertActed()
    expect(preview.pdf).toEqual(fittedPdf(fitNumber))
    expect(this.#renderCount).toBe(0)
  }

  /** No resume is published, and the fitted document is rendered rather than shown with the fitting's PDF. */
  expectNoFittedResumeShown(preview: ResumeRenderResult) {
    this.#assertActed()
    expect(this.#readOpenView().session.tailoredResume).toBeNull()
    expect(preview.pdf).not.toEqual(fittedPdf(1))
    expect(this.#renderCount).toBe(1)
  }

  #startPreparation() {
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
  }

  async #checkCoherence({ document }: ResumeCoherenceInput) {
    this.#coherenceChecks += 1
    const check = this.#coherenceChecks
    if (this.#options.coherence === 'unanswered') return new Promise<never>(() => undefined)
    if (check === 1 && this.#options.answers === 'fitting-first') await this.#firstFitting.opened
    this.#coherenceAnswers += 1
    if (this.#options.coherence === 'fails') return { ok: false, error: { type: 'timeout' } } as const
    return { ok: true, value: readCoherence({ coherence: this.#options.coherence, check, document }) } as const
  }

  async #previewResume(document: TailoredResume): Promise<ResumeRenderResult> {
    const view = this.#readOpenView()
    return this.#journey.renderResumeDocument({ document, unsupportedFieldIds: view.resumeReview?.unsupportedFieldIds ?? [],
      photoDataUrl: view.session.resumePhoto?.dataUrl })
  }

  #assertActed() {
    if (!this.#acted) expect.fail('Run the preparation or preview it before reading what it fitted')
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') expect.fail(`Expected an open Candidate Session, got ${view.status}`)
    return view
  }
}

function readCoherence({ coherence, check, document }: Readonly<{
  coherence: TestOptions['coherence']; check: number; document: ResumeCoherenceInput['document']
}>): ResumeDocumentCoherence {
  const coherent = { coherent: true, languageMatches: true, issues: [] }
  const project = readProjectFields(document)[0]
  if (project === undefined || coherence === 'accepts') return coherent
  if (coherence === 'removes-redundant-project') {
    return { ...coherent, coherent: false, issues: [{ fieldId: project.id, kind: 'redundant' }] }
  }
  return check > 1 ? coherent : { ...coherent, coherent: false, issues: [{ fieldId: project.id, kind: 'mixed-association' }] }
}

function readFittedDocument(document: TailoredResume): FittedDocument | 'unexpected' {
  const projects = readProjectFields(document)
  const assembled = readProjectFields({ sections: [{ section: 'projects', ...readGroupedProjects() }] })
  if (projects.some(({ text }) => text.endsWith(rewrittenSuffix))) return 'rewritten-projects'
  if (projects.length === assembled.length) return 'assembled'
  return projects.length === assembled.length - 1 ? 'without-project' : 'unexpected'
}

function readProjectFields(document: Pick<TailoredResume, 'sections'>) {
  return document.sections.flatMap((section) => section.section === 'projects' ? section.fields : [])
}

function readGroupedProjects() {
  const content = readGroupedResumeSection({ key: 'projects', kind: 'projects' })
  return content.kind === 'projects' ? { fields: content.fields } : expect.fail('Expected the fixture Projects')
}

function withRewrittenFields(content: ResumeSectionContent): ResumeSectionContent {
  return content.kind === 'projects'
    ? { ...content, fields: content.fields.map((field) => ({ ...field, text: `${field.text}${rewrittenSuffix}` })) }
    : content
}

function fittedPdf(fitNumber: number) {
  return new TextEncoder().encode(`%PDF-fitting-${String(fitNumber)}`)
}

/** A promise the harness resolves when the scenario allows the step it guards to finish. */
function createGate() {
  let open: () => void = () => undefined
  const opened = new Promise<void>((resolve) => { open = resolve })
  return { opened, open: () => { open() } }
}

const sourceDocumentText = 'Alex Morgan\nalex.morgan@example.com\nSource professional evidence'

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
