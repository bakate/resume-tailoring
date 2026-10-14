import { describe, expect, it } from 'vitest'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, ResumeCoherenceInput } from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeMatchEvidenceMatcher, createFakeResumeDocumentRenderer,
  createFakeResumeSectionModels } from '@resume-tailoring/application/testing'

describe('Candidate Journey renderer warm-up', () => {
  it('warms the renderer up when Resume Section writing starts, before the first section is written', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectStepsInOrder(['match-evidence', 'renderer-warm-up', 'resume-section', 'render'])
  })

  it('sends the warm-up without any Candidate content', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectWarmUpsWithoutArguments()
  })

  it('warms the renderer up once per preparation, even when coherence sends sections back for rewriting', async () => {
    const system = createSystemUnderTest({ coherence: 'rewrite-once' })
    await system.givenConsentedSession()

    await system.prepareTailoredResume()

    system.expectWarmUpCount(1)
  })

  it('warms the renderer up again for the next preparation', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedTailoredResume()

    await system.prepareTailoredResume()

    system.expectWarmUpCount(2)
  })
})

function createSystemUnderTest(options: TestOptions = {}) { return new RendererWarmUpSystem(options) }

type TestOptions = Readonly<{
  /** `rewrite-once` finds the first experience's role mixed up on the first check only. */
  coherence?: 'rewrite-once'
}>

type Step = 'match-evidence' | 'renderer-warm-up' | 'resume-section' | 'render'

class RendererWarmUpSystem {
  readonly #journey: CandidateJourney
  readonly #steps: Step[] = []
  readonly #warmUpArguments: unknown[][] = []
  #coherenceCheckCount = 0

  constructor(options: TestOptions) {
    const renderer = createFakeResumeDocumentRenderer()
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      matchEvidenceMatcher: { match: (request) => {
        this.#steps.push('match-evidence')
        return createFakeMatchEvidenceMatcher().match(request)
      } },
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: ({ section }) => {
          this.#steps.push('resume-section')
          return Promise.resolve({ ok: true, value: readGroupedResumeSection(section) })
        },
        checkCoherence: (input) => {
          this.#coherenceCheckCount += 1
          return Promise.resolve({ ok: true, value: this.#checkCoherence({ input, options }) })
        },
      }),
      resumeDocumentRenderer: {
        render: (request) => {
          this.#steps.push('render')
          return renderer.render(request)
        },
        warmUp: (...warmUpArguments: unknown[]) => {
          this.#steps.push('renderer-warm-up')
          this.#warmUpArguments.push(warmUpArguments)
        },
      },
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

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText(sourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'prepared').toBe(true)
  }

  /** Each step in order, ignoring repetitions of the step before it. */
  expectStepsInOrder(steps: readonly Step[]) {
    expect(this.#steps.filter((step, position) => step !== this.#steps[position - 1])).toEqual(steps)
  }

  expectWarmUpsWithoutArguments() {
    expect(this.#warmUpArguments).toEqual([[]])
  }

  expectWarmUpCount(count: number) {
    expect(this.#steps.filter((step) => step === 'renderer-warm-up')).toHaveLength(count)
  }

  #checkCoherence({ input, options }: Readonly<{ input: ResumeCoherenceInput; options: TestOptions }>) {
    const coherent = { coherent: true, languageMatches: true, issues: [] }
    const role = input.document.experiences[0]?.role
    if (options.coherence !== 'rewrite-once' || this.#coherenceCheckCount > 1 || role == null) return coherent
    return { ...coherent, coherent: false, issues: [{ fieldId: role.id, kind: 'mixed-association' as const }] }
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
