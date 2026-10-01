import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyDependencies, CandidateJourneyView, CandidateSession,
  ResumeSectionModelFailure, ResumeSectionWritingInput } from '@resume-tailoring/application/candidate-journey'
import { createFixtureResumeSectionModels, readGroupedResumeSection, structuredResumeJobMatch,
  structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'

describe('Candidate Journey section-by-section resume preparation', () => {
  it('writes each planned Resume Section once from only the Candidate Facts it may cite', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectEachSectionWrittenFromItsOwnFacts()
  })

  it('writes at most four Resume Sections at a time', async () => {
    const system = createSystemUnderTest({ writing: 'slow' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResumeWhileSectionsAreSlow()

    system.expectAtMostFourSectionsInFlight()
  })

  it('reveals each validated Resume Section while a slower section is still a placeholder', async () => {
    const system = createSystemUnderTest({ heldSection: 'skills' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResumeWhileSkillsAreHeld()

    system.expectValidatedSectionsRevealedAroundTheSkillsPlaceholder()
  })

  it('keeps export unavailable until the held section and the coherence check finish', async () => {
    const system = createSystemUnderTest({ heldSection: 'skills' })
    await system.givenMatchedCandidateSession()
    await system.prepareTailoredResumeWhileSkillsAreHeld()

    await system.releaseHeldSection()

    system.expectCompleteResumePreparedWithEverySectionValidated()
  })

  it('rewrites only the section whose validation failed and prepares the whole resume', async () => {
    const system = createSystemUnderTest({ skillsValidation: 'unsupported-once' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectOnlySkillsRewrittenAndResumePrepared()
  })

  it('keeps validated sections and asks for a retry when a section still fails after its rewrite', async () => {
    const system = createSystemUnderTest({ skillsValidation: 'unsupported-twice' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'unsupported-content', recovery: 'retry' })
    system.expectSavedSections({ validated: ['value-proposition', 'experiences.0', 'experiences.1', 'education',
      'languages', 'projects', 'certifications'], failed: ['skills'] })
  })

  it('never retries a section whose writing timed out', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'timeout' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsWrittenOnceAndPreparationRetryable()
  })

  it('rewrites a section once after a transient writing failure', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'transient' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectOnlySkillsRewrittenAndResumePrepared()
  })

  it('asks for a content correction when the assembled resume is not coherent', async () => {
    const system = createSystemUnderTest({ coherence: 'incoherent' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'unsupported-content', recovery: 'correct-content' })
    system.expectEveryValidatedSectionKeptVisible()
  })

  it('asks for a retry when the coherence check itself times out', async () => {
    const system = createSystemUnderTest({ coherence: 'timeout' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'unavailable', recovery: 'retry' })
  })

  it('asks for renewed consent when a section model requires it', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'consent-required' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'processing-consent-required', recovery: 'renew-consent' })
  })

  it('rewrites only the sections that are not yet validated when a failed preparation is retried', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'timeout' })
    await system.givenFailedPreparation()

    await system.retryPreparation()

    system.expectOnlySkillsWrittenOnRetryAndResumePrepared()
  })

  it('resumes only the pending sections after a reload during preparation', async () => {
    const system = createSystemUnderTest({ heldSection: 'skills' })
    await system.givenPreparationInterruptedByReloadWhileSkillsAreHeld()

    await system.retryPreparation()

    system.expectOnlySkillsWrittenOnRetryAndResumePrepared()
  })

  it('rewrites a saved section that cites a Candidate Fact that is no longer attested', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'timeout' })
    await system.givenFailedPreparation()
    await system.givenReloadWithSavedSectionCitingUnattestedFact('education')

    await system.retryPreparation()

    system.expectRetryWrote(['skills', 'education'])
  })

  it('checks coherence again without rewriting any section when every section was validated', async () => {
    const system = createSystemUnderTest({ coherence: 'incoherent-once' })
    await system.givenFailedPreparation()

    await system.retryPreparation()

    system.expectRetryWrote([])
  })

  it('writes every section again when the inputs of the preparation change', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'timeout' })
    await system.givenFailedPreparation()

    await system.retryPreparation({ locale: 'fr' })

    system.expectRetryWrote(['value-proposition', 'experiences.0', 'experiences.1', 'skills', 'education',
      'languages', 'projects', 'certifications'])
  })

  it('writes the Normalized Resume through the same sections without the Job Posting', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()

    await system.prepareNormalizedResume()

    system.expectNormalizedSectionsWithoutPostingContext()
  })
})

function createSystemUnderTest(options: TestOptions = {}) {
  return new SectionPreparationTestSystem(options)
}

type TestOptions = Readonly<{
  writing?: 'slow'
  heldSection?: 'skills'
  skillsValidation?: 'unsupported-once' | 'unsupported-twice'
  skillsWritingFailure?: Exclude<ResumeSectionModelFailure, 'permanent'>
  coherence?: 'incoherent' | 'incoherent-once' | 'timeout'
}>

class SectionPreparationTestSystem {
  readonly #options: TestOptions
  // The in-memory persistence a reloaded Candidate Journey restores from.
  readonly #store: SessionStore = { session: createMatchedSession() }
  #journey: CandidateJourney
  readonly #writingInputs: ResumeSectionWritingInput[] = []
  readonly #pendingWrites: (() => void)[] = []
  #releaseHeldSection: (() => void) | null = null
  #retryStart = 0
  #writesInFlight = 0
  #maximumWritesInFlight = 0
  #skillsWrites = 0
  #skillsValidations = 0
  #outcome: CandidateJourneyView | null = null

  constructor(options: TestOptions) {
    this.#options = options
    this.#journey = this.#createJourney({ heldSection: options.heldSection })
  }

  #createJourney({ heldSection }: Readonly<{ heldSection: TestOptions['heldSection'] }>) {
    return createCandidateJourney({ dependencies: createDependencies({ options: this.#options, store: this.#store, models: {
      onWrite: async (input) => {
        this.#writingInputs.push(input)
        this.#writesInFlight += 1
        this.#maximumWritesInFlight = Math.max(this.#maximumWritesInFlight, this.#writesInFlight)
        if (this.#options.writing === 'slow') await new Promise<void>((resolve) => { this.#pendingWrites.push(resolve) })
        if (heldSection === input.section.kind) await new Promise<void>((resolve) => { this.#releaseHeldSection = resolve })
        this.#writesInFlight -= 1
      },
      onSkillsWrite: () => ++this.#skillsWrites,
      onSkillsValidation: () => ++this.#skillsValidations,
    } }) })
  }

  async givenMatchedCandidateSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation()
    await this.#preparationFinished()
  }

  async prepareNormalizedResume() {
    this.#journey.startTailoredResumePreparation({ purpose: 'normalized' })
    await this.#preparationFinished()
  }

  async prepareTailoredResumeWhileSectionsAreSlow() {
    this.#journey.startTailoredResumePreparation()
    await expect.poll(() => this.#pendingWrites.length).toBe(4)
    while (this.#readOpenView().operation !== null) {
      this.#pendingWrites.splice(0).forEach((release) => { release() })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    this.#outcome = this.#journey.readView()
  }

  async prepareTailoredResumeWhileSkillsAreHeld() {
    this.#journey.startTailoredResumePreparation()
    await expect.poll(() => this.#readSections().filter(({ status }) => status === 'validated').length).toBe(7)
    this.#outcome = this.#journey.readView()
  }

  async releaseHeldSection() {
    if (this.#releaseHeldSection === null) expect.fail('Hold a section before releasing it')
    this.#releaseHeldSection()
    await this.#preparationFinished()
  }

  async givenFailedPreparation() {
    await this.givenMatchedCandidateSession()
    await this.prepareTailoredResume()
    expect(this.#readOpenView().preparationOutcome).toMatchObject({ status: 'failed' })
  }

  async givenPreparationInterruptedByReloadWhileSkillsAreHeld() {
    await this.givenMatchedCandidateSession()
    await this.prepareTailoredResumeWhileSkillsAreHeld()
    await this.#reload()
    expect(this.#readOpenView().session.preparation?.status).toBe('interrupted')
  }

  async givenReloadWithSavedSectionCitingUnattestedFact(key: string) {
    const preparation = this.#store.session.preparation
    if (preparation?.sections === undefined) expect.fail('Expected a saved sections snapshot')
    // A Candidate Fact removed from the Source Intake since the section was validated.
    const sections = preparation.sections.map((section) => section.key !== key || section.status !== 'validated' ? section
      : { ...section, content: { kind: 'education' as const, fields: [{ id: 'education-0', text: 'Computer Science degree',
        factIds: ['source-fact-education-1-qualification-0' as const] }] } })
    this.#store.session = { ...this.#store.session, preparation: { ...preparation, sections } }
    await this.#reload()
  }

  async retryPreparation(request: Readonly<{ locale?: 'fr' }> = {}) {
    this.#retryStart = this.#writingInputs.length
    this.#journey.startTailoredResumePreparation(request)
    await this.#preparationFinished()
  }

  async #reload() {
    this.#journey = this.#createJourney({ heldSection: undefined })
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  #readSections() {
    return this.#readOpenView().session.preparation?.sections ?? []
  }

  async #preparationFinished() {
    await expect.poll(() => this.#readOpenView().operation).toBeNull()
    this.#outcome = this.#journey.readView()
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') expect.fail('Expected an open Candidate Session')
    return view
  }

  #expectOutcome() {
    expect(this.#outcome?.status, 'Prepare a resume before reading the outcome').toBe('candidate-session-open')
    return this.#outcome?.status === 'candidate-session-open' ? this.#outcome : null
  }

  #writtenSectionKeys() {
    return this.#writingInputs.map(({ section }) => section.key)
  }

  expectEachSectionWrittenFromItsOwnFacts() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writtenSectionKeys()).toEqual(['value-proposition', 'experiences.0', 'experiences.1', 'skills',
      'education', 'languages', 'projects', 'certifications'])
    for (const { section, candidateFacts } of this.#writingInputs.filter(({ section }) => section.kind !== 'value-proposition')) {
      expect(candidateFacts.every(({ path }) => path.startsWith(`${section.key}.`)), section.key).toBe(true)
    }
    const valueProposition = this.#writingInputs.find(({ section }) => section.kind === 'value-proposition')
    expect(valueProposition?.candidateFacts).toEqual(structuredResumeSource.candidateFacts)
    expect(valueProposition).toMatchObject({ targetRole: 'Frontend Engineer', jobRequirements: ['React'],
      relevantFactIds: ['source-fact-experiences-0-achievements-0', 'source-fact-skills-0-name-0'],
      locale: 'en', purpose: 'tailored' })
    expect(JSON.stringify(this.#writingInputs)).not.toContain(structuredResumeJobMatch.jobPosting.originalContent)
    expect(JSON.stringify(this.#writingInputs)).not.toContain('Alex Morgan')
  }

  expectValidatedSectionsRevealedAroundTheSkillsPlaceholder() {
    const view = this.#expectOutcome()
    expect(view?.operation).toBe('preparing-tailored-resume')
    expect(view?.session.tailoredResume).toBeNull()
    const sections = view?.session.preparation?.sections ?? []
    expect(sections.map(({ key, status }) => [key, status])).toEqual([['value-proposition', 'validated'],
      ['experiences.0', 'validated'], ['experiences.1', 'validated'], ['skills', 'writing'], ['education', 'validated'],
      ['languages', 'validated'], ['projects', 'validated'], ['certifications', 'validated']])
    expect(sections.find(({ key }) => key === 'skills')).not.toHaveProperty('content')
    expect(sections.find(({ key }) => key === 'education')).toMatchObject({ attempt: 1,
      content: readGroupedResumeSection({ key: 'education', kind: 'education' }) })
    expect(this.#store.session.preparation?.sections).toEqual(sections)
  }

  expectCompleteResumePreparedWithEverySectionValidated() {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(view?.session.tailoredResume?.sections.map(({ section }) => section))
      .toEqual(['skills', 'education', 'languages', 'projects', 'certifications'])
    expect(view?.session.preparation?.sections?.every(({ status }) => status === 'validated')).toBe(true)
  }

  expectEveryValidatedSectionKeptVisible() {
    const sections = this.#expectOutcome()?.session.preparation?.sections ?? []
    expect(sections).toHaveLength(8)
    expect(sections.every((section) => section.status === 'validated' && section.content.kind === section.kind)).toBe(true)
    expect(this.#store.session.preparation).toMatchObject({ status: 'failed', failure: 'unsupported-content', sections })
  }

  expectAtMostFourSectionsInFlight() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#maximumWritesInFlight).toBe(4)
    expect(this.#writingInputs).toHaveLength(8)
  }

  expectOnlySkillsRewrittenAndResumePrepared() {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writtenSectionKeys().filter((key) => key === 'skills')).toHaveLength(2)
    expect(this.#writingInputs).toHaveLength(9)
    expect(view?.session.tailoredResume?.sections.map(({ section }) => section))
      .toEqual(['skills', 'education', 'languages', 'projects', 'certifications'])
  }

  expectSkillsWrittenOnceAndPreparationRetryable() {
    expect(this.#writtenSectionKeys().filter((key) => key === 'skills')).toHaveLength(1)
    this.expectPreparationFailure({ reason: 'unavailable', recovery: 'retry' })
  }

  expectPreparationFailure(failure: Readonly<{ reason: string; recovery: string }>) {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', ...failure })
    // Nothing is published, so no partial Tailored Resume can be rendered or exported.
    expect(view?.session.tailoredResume).toBeNull()
    expect(view?.session.preparedResumeRevision).toBeUndefined()
  }

  expectSavedSections(expected: Readonly<{ validated: readonly string[]; failed: readonly string[] }>) {
    const sections = this.#expectOutcome()?.session.preparation?.sections ?? []
    expect(sections.filter(({ status }) => status === 'validated').map(({ key }) => key)).toEqual(expected.validated)
    expect(sections.filter(({ status }) => status === 'failed').map(({ key }) => key)).toEqual(expected.failed)
    expect(this.#store.session.preparation?.sections).toEqual(sections)
  }

  expectRetryWrote(keys: readonly string[]) {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs.slice(this.#retryStart).map(({ section }) => section.key).sort()).toEqual([...keys].sort())
  }

  expectOnlySkillsWrittenOnRetryAndResumePrepared() {
    this.expectRetryWrote(['skills'])
    expect(this.#expectOutcome()?.session.tailoredResume?.sections.map(({ section }) => section))
      .toEqual(['skills', 'education', 'languages', 'projects', 'certifications'])
  }

  expectNormalizedSectionsWithoutPostingContext() {
    const view = this.#expectOutcome()
    expect(view?.session.tailoredResume).toMatchObject({ purpose: 'normalized', targetRole: null })
    expect(view?.session.tailoredResume?.experiences.map(({ chronology }) => chronology)).not.toContain('relevant')
    for (const input of this.#writingInputs) {
      expect(input).toMatchObject({ purpose: 'normalized', targetRole: null, jobRequirements: [], relevantFactIds: [] })
    }
  }
}

function createMatchedSession(): CandidateSession {
  const startedAt = Date.now()
  return {
    expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000068',
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: { grantedAt: startedAt, policy },
    sourceIntake: structuredResumeSource, tailoredResume: null,
  }
}

type SessionStore = { session: CandidateSession }

function createDependencies({ options, store, models }: Readonly<{
  options: TestOptions
  store: SessionStore
  models: Readonly<{ onWrite: (input: ResumeSectionWritingInput) => Promise<void>
    onSkillsWrite: () => number; onSkillsValidation: () => number }>
}>): CandidateJourneyDependencies {
  let coherenceChecks = 0
  return {
    createSessionId: () => crypto.randomUUID(), now: () => store.session.startedAt,
    languageModelGateway: { processingPolicy: policy },
    resumeSectionModels: createFixtureResumeSectionModels({
      writeSection: async (input) => {
        await models.onWrite(input)
        const failure = options.skillsWritingFailure
        if (input.section.kind === 'skills' && failure !== undefined && models.onSkillsWrite() === 1) return { ok: false, error: { type: failure } }
        return { ok: true, value: readGroupedResumeSection(input.section) }
      },
      validateFields: ({ section, fields }) => {
        const validation = section.kind === 'skills' ? models.onSkillsValidation() : 0
        const unsupported = (options.skillsValidation === 'unsupported-once' && validation === 1)
          || (options.skillsValidation === 'unsupported-twice' && validation <= 2)
        return Promise.resolve({ ok: true, value: { fields: fields.map(({ id }, index) => ({ fieldId: id,
          supported: !(unsupported && section.kind === 'skills' && index === 0) })) } })
      },
      checkCoherence: () => Promise.resolve(options.coherence === 'timeout' ? { ok: false, error: { type: 'timeout' } } : { ok: true, value: { languageMatches: true,
        coherent: options.coherence === undefined || (options.coherence === 'incoherent-once' && coherenceChecks++ > 0) } }),
    }),
    persistence: { delete: () => ({ ok: true, value: null }),
      restore: () => ({ ok: true, value: { notice: null, session: store.session } }),
      save: ({ session }) => { store.session = session; return { ok: true, value: session } } },
    jobPostingDocumentReader: { read: () => Promise.resolve({ ok: true, value: { text: '' } }) },
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: false, error: 'job-posting-extraction-unavailable' }) },
    matchEvidenceMatcher: { match: () => Promise.resolve({ ok: false, error: 'match-evidence-unavailable' }) },
    sourceDocumentReader: { read: () => Promise.resolve({ ok: true, value: { pageCount: null, text: '' } }) },
    sourceProfileExtractor: { extract: () => Promise.resolve({ ok: false, error: 'source-profile-extraction-unavailable' }) },
  }
}

const policy = { provider: 'Test', purposes: [], retentionPolicy: 'None',
  storageBehavior: 'Browser-local', transmittedDataCategories: [], version: 'test' } as const
