import { describe, expect, it } from 'vitest'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeDocumentRenderer,
  createFakeResumeSectionModels } from '@resume-tailoring/application/testing'

describe('Candidate Journey fitted PDF', () => {
  it('fits a prepared Tailored Resume to its Page Budget in one renderer operation', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectRendererCalls({ fits: 1, renders: 0 })
  })

  it('shows the fitted PDF in the preview without rendering the same document again', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()

    const preview = await system.previewTailoredResume()

    system.expectFittedPdfIn(preview)
    system.expectRendererCalls({ fits: 1, renders: 0 })
  })

  it('renders the preview as before once the Candidate edits the fitted resume', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()
    await system.givenEditedContacts()

    const preview = await system.previewTailoredResume()

    system.expectRenderedPdfIn(preview)
    system.expectRendererCalls({ fits: 1, renders: 1 })
  })

  it('renders the preview as before when the fitting operation could not render the resume', async () => {
    const system = createSystemUnderTest({ fitting: 'unavailable' })
    await system.givenPreparedTailoredResume()

    const preview = await system.previewTailoredResume()

    system.expectRenderedPdfIn(preview)
    system.expectRendererCalls({ fits: 1, renders: 1 })
  })
})

function createSystemUnderTest(options: TestOptions = {}) { return new FittedPdfSystem(options) }

type TestOptions = Readonly<{
  /** `unavailable` answers the fitting operation with an unavailable render. */
  fitting?: 'unavailable'
}>

const fittedPdf = new TextEncoder().encode('%PDF-fitted')
const renderedPdf = new TextEncoder().encode('%PDF-rendered')

class FittedPdfSystem {
  readonly #journey: CandidateJourney
  #fitCount = 0
  #renderCount = 0

  constructor(options: TestOptions) {
    const renderer = createFakeResumeDocumentRenderer()
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: ({ section }) => Promise.resolve({ ok: true, value: readGroupedResumeSection(section) }) }),
      resumeDocumentRenderer: createFakeResumeDocumentRenderer({
        render: async (request) => {
          this.#renderCount += 1
          return { ...await renderer.render(request), pdf: renderedPdf }
        },
        fitToPageBudget: async (request) => {
          this.#fitCount += 1
          const fit = await renderer.fitToPageBudget(request)
          return options.fitting === 'unavailable'
            ? { ...fit, render: { assessment: { ...fit.render.assessment, layout: { status: 'unavailable',
              revision: request.draft.revision } }, pdf: null } }
            : { ...fit, render: { ...fit.render, pdf: fittedPdf } }
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

  async givenPreparedTailoredResume() {
    await this.givenConsentedSession()
    await this.prepareTailoredResume()
  }

  async givenEditedContacts() {
    this.#journey.updateResumeContacts({ identity: { kind: 'personal-information', value: 'Alex M. Morgan' },
      contactDetails: [{ kind: 'email', value: 'alex.morgan@example.com' }] })
    await expect.poll(() => this.#readOpenView().session.tailoredResume?.identity?.value).toBe('Alex M. Morgan')
  }

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'prepared').toBe(true)
  }

  /** Renders the preview as the interface does, with the saved Tailored Resume and its photo. */
  async previewTailoredResume() {
    const view = this.#readOpenView()
    const document = view.session.tailoredResume ?? expect.fail('Expected a Tailored Resume')
    return this.#journey.renderResumeDocument({ document, unsupportedFieldIds: view.resumeReview?.unsupportedFieldIds ?? [],
      photoDataUrl: view.session.resumePhoto?.dataUrl })
  }

  expectRendererCalls(calls: Readonly<{ fits: number; renders: number }>) {
    expect({ fits: this.#fitCount, renders: this.#renderCount }).toEqual(calls)
  }

  expectFittedPdfIn(preview: ResumeRenderResult) {
    expect(preview.pdf).toEqual(fittedPdf)
    expect(preview.assessment.exportEligibility.status).toBe('eligible')
    expect(this.#readOpenView().resumeReview?.assessment?.exportEligibility.status).toBe('eligible')
  }

  expectRenderedPdfIn(preview: ResumeRenderResult) {
    expect(preview.pdf).toEqual(renderedPdf)
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') expect.fail(`Expected an open Candidate Session, got ${view.status}`)
    return view
  }
}

const sourceDocumentText = 'Alex Morgan\nalex.morgan@example.com\nSource professional evidence'

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
