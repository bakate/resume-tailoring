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

  it('asks for a content correction when a section fails validation after its rewrite', async () => {
    const system = createSystemUnderTest({ skillsValidation: 'unsupported-always' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'unsupported-content', recovery: 'correct-content' })
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

  it('asks for renewed consent when a section model requires it', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'consent-required' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'processing-consent-required', recovery: 'renew-consent' })
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
  skillsValidation?: 'unsupported-once' | 'unsupported-always'
  skillsWritingFailure?: Exclude<ResumeSectionModelFailure, 'permanent'>
  coherence?: 'incoherent'
}>

class SectionPreparationTestSystem {
  readonly #journey: CandidateJourney
  readonly #writingInputs: ResumeSectionWritingInput[] = []
  readonly #pendingWrites: (() => void)[] = []
  readonly #persisted: { session: CandidateSession | null } = { session: null }
  #releaseHeldSection: (() => void) | null = null
  #writesInFlight = 0
  #maximumWritesInFlight = 0
  #skillsValidations = 0
  #outcome: CandidateJourneyView | null = null

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createDependencies({ options, models: {
      onWrite: async (input) => {
        this.#writingInputs.push(input)
        this.#writesInFlight += 1
        this.#maximumWritesInFlight = Math.max(this.#maximumWritesInFlight, this.#writesInFlight)
        if (options.writing === 'slow') await new Promise<void>((resolve) => { this.#pendingWrites.push(resolve) })
        if (options.heldSection === input.section.kind) await new Promise<void>((resolve) => { this.#releaseHeldSection = resolve })
        this.#writesInFlight -= 1
      },
      onSkillsValidation: () => ++this.#skillsValidations,
    }, persisted: this.#persisted }) })
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
    expect(this.#persisted.session?.preparation?.sections).toEqual(sections)
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
    expect(this.#persisted.session?.preparation).toMatchObject({ status: 'failed', failure: 'unsupported-content', sections })
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
    expect(view?.session.tailoredResume).toBeNull()
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

function createDependencies({ options, models, persisted }: Readonly<{
  options: TestOptions
  models: Readonly<{ onWrite: (input: ResumeSectionWritingInput) => Promise<void>; onSkillsValidation: () => number }>
  persisted: { session: CandidateSession | null }
}>): CandidateJourneyDependencies {
  let session = createMatchedSession()
  let skillsWrites = 0
  return {
    createSessionId: () => crypto.randomUUID(), now: () => session.startedAt,
    languageModelGateway: { processingPolicy: policy },
    resumeSectionModels: createFixtureResumeSectionModels({
      writeSection: async (input) => {
        await models.onWrite(input)
        const failure = options.skillsWritingFailure
        if (input.section.kind === 'skills' && failure !== undefined && skillsWrites++ === 0) return { ok: false, error: { type: failure } }
        return { ok: true, value: readGroupedResumeSection(input.section) }
      },
      validateFields: ({ section, fields }) => {
        const validation = section.kind === 'skills' ? models.onSkillsValidation() : 0
        const unsupported = options.skillsValidation === 'unsupported-always'
          || (options.skillsValidation === 'unsupported-once' && validation === 1)
        return Promise.resolve({ ok: true, value: { fields: fields.map(({ id }, index) => ({ fieldId: id,
          supported: !(unsupported && section.kind === 'skills' && index === 0) })) } })
      },
      checkCoherence: () => Promise.resolve({ ok: true, value: { coherent: options.coherence !== 'incoherent', languageMatches: true } }),
    }),
    persistence: { delete: () => ({ ok: true, value: null }),
      restore: () => ({ ok: true, value: { notice: null, session } }),
      save: ({ session: nextSession }) => { session = nextSession; persisted.session = nextSession; return { ok: true, value: nextSession } } },
    jobPostingDocumentReader: { read: () => Promise.resolve({ ok: true, value: { text: '' } }) },
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: false, error: 'job-posting-extraction-unavailable' }) },
    matchEvidenceMatcher: { match: () => Promise.resolve({ ok: false, error: 'match-evidence-unavailable' }) },
    sourceDocumentReader: { read: () => Promise.resolve({ ok: true, value: { pageCount: null, text: '' } }) },
    sourceProfileExtractor: { extract: () => Promise.resolve({ ok: false, error: 'source-profile-extraction-unavailable' }) },
  }
}

const policy = { provider: 'Test', purposes: [], retentionPolicy: 'None',
  storageBehavior: 'Browser-local', transmittedDataCategories: [], version: 'test' } as const
