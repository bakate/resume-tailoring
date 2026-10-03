import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, CandidateSession,
  ResumeCoherenceInput, ResumeDocumentCoherence, ResumeRejectedField, ResumeSectionContent, ResumeSectionModelFailure,
  ResumeSectionWritingInput,
} from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch,
  structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeSectionModels, createInMemoryCandidateSessionPersistence,
  testProcessingPolicy } from '@resume-tailoring/application/testing'
import type { TailoredResumeField } from '@resume-tailoring/application/tailored-resume'
import type { CandidateJourneyDependencies } from '@resume-tailoring/application/ports'

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

  it('rewrites a section with the fields its validation rejected', async () => {
    const system = createSystemUnderTest({ skillsValidation: 'unsupported-once' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsRewrittenWithTheirRejectedFields()
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

  it('rewrites only the sections the coherence check rejects, with the fields it named', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-projects-once' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectOnlyProjectsRewrittenWithTheRejectedFieldAndResumePrepared()
  })

  it('removes a field the coherence check finds redundant without rewriting or checking again', async () => {
    const system = createSystemUnderTest({ coherence: 'redundant-projects-always' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectRedundantProjectRemovedAndResumePrepared()
  })

  it('keeps the other sections and asks for a retry when the resume is still incoherent after the rewrite', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-projects-twice' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'incoherent-content', recovery: 'retry' })
    system.expectSavedSections({ validated: ['value-proposition', 'experiences.0', 'experiences.1', 'skills', 'education',
      'languages', 'certifications'], failed: ['projects'] })
  })

  it('rewrites only the sections the coherence check rejected when an incoherent preparation is retried', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-projects-twice' })
    await system.givenFailedPreparation()

    await system.retryPreparation()

    system.expectRetryWrote(['projects'])
  })

  it('replaces every em dash a writer produces with an en dash', async () => {
    const system = createSystemUnderTest({ writtenPunctuation: 'em-dash' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparedResumeWithEnDashesOnly()
  })

  it('rewrites only the still incoherent section on retry when a redundancy was removed', async () => {
    const system = createSystemUnderTest({ coherence: 'redundant-projects-and-mixed-skills-twice' })
    await system.givenFailedPreparation()

    await system.retryPreparation()

    system.expectRetryWrote(['skills'])
  })

  it('prepares the resume when the coherence check objects to experience dates copied from the source', async () => {
    const system = createSystemUnderTest({ coherence: 'chronology-on-source-dates' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparedWithoutRewriting()
  })

  it('prepares the resume when the coherence check objects only to fields outside any Resume Section', async () => {
    const system = createSystemUnderTest({ coherence: 'document-level-issue' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparedWithoutRewriting()
  })

  it('asks to retry the check when the resume language does not match without naming a field', async () => {
    const system = createSystemUnderTest({ coherence: 'unnamed-language-mismatch' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'unavailable', recovery: 'retry' })
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
  writtenPunctuation?: 'em-dash'
  coherence?: 'mixed-projects-once' | 'mixed-projects-twice' | 'redundant-projects-always' | 'document-level-issue'
    | 'redundant-projects-and-mixed-skills-twice' | 'chronology-on-source-dates'
    | 'unnamed-language-mismatch' | 'timeout'
}>

class SectionPreparationTestSystem {
  readonly #options: TestOptions
  // The in-memory persistence a reloaded Candidate Journey restores from.
  readonly #persistence = createInMemoryCandidateSessionPersistence({ session: createMatchedSession() })
  #journey: CandidateJourney
  readonly #writingInputs: ResumeSectionWritingInput[] = []
  readonly #pendingWrites: (() => void)[] = []
  #releaseHeldSection: (() => void) | null = null
  #retryStart = 0
  #writesInFlight = 0
  #maximumWritesInFlight = 0
  #skillsWrites = 0
  #skillsValidations = 0
  #coherenceChecks = 0
  readonly #rejectedFields: ResumeRejectedField[] = []
  #outcome: CandidateJourneyView | null = null

  constructor(options: TestOptions) {
    this.#options = options
    this.#journey = this.#createJourney({ heldSection: options.heldSection })
  }

  #createJourney({ heldSection }: Readonly<{ heldSection: TestOptions['heldSection'] }>) {
    return createCandidateJourney({ dependencies: createDependencies({ options: this.#options, persistence: this.#persistence, models: {
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
      onRejectedField: (field) => { this.#rejectedFields.push(field) },
      onCoherenceCheck: () => ++this.#coherenceChecks,
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
    const session = this.#readStoredSession()
    const preparation = session.preparation
    if (preparation?.sections === undefined) expect.fail('Expected a saved sections snapshot')
    // A Candidate Fact removed from the Source Intake since the section was validated.
    const sections = preparation.sections.map((section) => section.key !== key || section.status !== 'validated' ? section
      : { ...section, content: { kind: 'education' as const, fields: [{ id: 'education-0', text: 'Computer Science degree',
        factIds: ['source-fact-education-1-qualification-0' as const] }] } })
    this.#persistence.save({ session: { ...session, preparation: { ...preparation, sections } } })
    await this.#reload()
  }

  async retryPreparation() {
    this.#retryStart = this.#writingInputs.length
    this.#journey.startTailoredResumePreparation()
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

  #readStoredSession() {
    const session = this.#persistence.readStoredSession()
    if (session === null) return expect.fail('Expected a stored Candidate Session')
    return session
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
    expect(this.#readStoredSession().preparation?.sections).toEqual(sections)
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
    expect(this.#readStoredSession().preparation).toMatchObject({ status: 'failed', failure: 'unavailable', sections })
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

  expectSkillsRewrittenWithTheirRejectedFields() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#rejectedFields).toHaveLength(1)
    const skillsWrites = this.#writingInputs.filter(({ section }) => section.kind === 'skills')
    expect(skillsWrites.map(({ rejectedFields }) => rejectedFields)).toEqual([[], this.#rejectedFields])
    for (const input of this.#writingInputs.filter(({ section }) => section.kind !== 'skills')) {
      expect(input.rejectedFields, input.section.key).toEqual([])
    }
    expect(JSON.stringify(this.#expectOutcome()?.session)).not.toContain('rejectedFields')
  }

  expectOnlyProjectsRewrittenWithTheRejectedFieldAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs).toHaveLength(9)
    const projectsWrites = this.#writingInputs.filter(({ section }) => section.key === 'projects')
    expect(projectsWrites.map(({ rejectedFields }) => rejectedFields)).toEqual([[], this.#rejectedFields])
    expect(this.#rejectedFields).toEqual([expect.objectContaining({ reason: 'mixed-association' })])
    expect(JSON.stringify(this.#expectOutcome()?.session)).not.toContain('rejectedFields')
  }

  expectRedundantProjectRemovedAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs, 'No section is rewritten for a redundancy').toHaveLength(8)
    expect(this.#coherenceChecks, 'Removing a duplicate needs no second check').toBe(1)
    const [removed] = this.#rejectedFields
    expect(removed).toEqual(expect.objectContaining({ reason: 'redundant' }))
    expect(JSON.stringify(this.#expectOutcome()?.session.tailoredResume)).not.toContain(removed?.text)
  }

  expectPreparedResumeWithEnDashesOnly() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const resume = JSON.stringify(this.#expectOutcome()?.session.tailoredResume)
    expect(resume).not.toContain('—')
    expect(resume).toContain(' – détail')
  }

  expectPreparedWithoutRewriting() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs).toHaveLength(8)
    expect(this.#coherenceChecks).toBe(1)
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
    expect(this.#readStoredSession().preparation?.sections).toEqual(sections)
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
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: { grantedAt: startedAt, policy: testProcessingPolicy },
    sourceIntake: structuredResumeSource, tailoredResume: null,
  }
}

function createDependencies({ options, persistence, models }: Readonly<{
  options: TestOptions
  persistence: CandidateJourneyDependencies['persistence']
  models: Readonly<{ onWrite: (input: ResumeSectionWritingInput) => Promise<void>
    onSkillsWrite: () => number; onSkillsValidation: () => number
    onRejectedField: (field: ResumeRejectedField) => void; onCoherenceCheck: () => number }>
}>): CandidateJourneyDependencies {
  return createFakeCandidateJourneyDependencies({
    persistence,
    resumeSectionModels: createFakeResumeSectionModels({
      writeSection: async (input) => {
        await models.onWrite(input)
        const failure = options.skillsWritingFailure
        if (input.section.kind === 'skills' && failure !== undefined && models.onSkillsWrite() === 1) return { ok: false, error: { type: failure } }
        const content = readGroupedResumeSection(input.section)
        return { ok: true, value: options.writtenPunctuation === 'em-dash' ? withEmDashes(content) : content }
      },
      validateFields: ({ section, fields }) => {
        const validation = section.kind === 'skills' ? models.onSkillsValidation() : 0
        const unsupported = (options.skillsValidation === 'unsupported-once' && validation === 1)
          || (options.skillsValidation === 'unsupported-twice' && validation <= 2)
        const rejected = unsupported && section.kind === 'skills' ? fields[0] : undefined
        if (rejected !== undefined) models.onRejectedField({ fieldId: rejected.id, text: rejected.text, reason: 'unsupported' })
        return Promise.resolve({ ok: true, value: { fields: fields.map(({ id }) => ({ fieldId: id, supported: id !== rejected?.id })) } })
      },
      checkCoherence: ({ document }) => {
        if (options.coherence === 'timeout') return Promise.resolve({ ok: false, error: { type: 'timeout' } })
        return Promise.resolve({ ok: true, value: readCoherence({ coherence: options.coherence, check: models.onCoherenceCheck(),
          document, onRejectedField: models.onRejectedField }) })
      },
    }),
  })
}

/** Appends an em-dashed detail to every written field, as a writing model often does. */
function withEmDashes(content: ResumeSectionContent): ResumeSectionContent {
  const dashed = (field: TailoredResumeField) => ({ ...field, text: `${field.text} — détail` })
  if (content.kind === 'value-proposition') return { ...content, paragraphs: content.paragraphs.map(dashed) }
  if (content.kind === 'experience') {
    return { ...content, experience: { ...content.experience, achievements: content.experience.achievements.map(dashed) } }
  }
  if (content.kind === 'skills') return { ...content, groups: content.groups.map((group) => ({ ...group, items: group.items.map(dashed) })) }
  return { ...content, fields: content.fields.map(dashed) }
}

function readCoherence({ coherence, check, document, onRejectedField }: Readonly<{
  coherence: TestOptions['coherence']; check: number; document: ResumeCoherenceInput['document']
  onRejectedField: (field: ResumeRejectedField) => void
}>): ResumeDocumentCoherence {
  const coherent = { coherent: true, languageMatches: true, issues: [] }
  if (coherence === 'document-level-issue') {
    return { ...coherent, coherent: false, issues: [{ fieldId: 'targetRole', kind: 'mixed-association' }] }
  }
  if (coherence === 'unnamed-language-mismatch') return { ...coherent, languageMatches: false }
  if (coherence === 'chronology-on-source-dates') {
    // Two experiences overlap in time, as concurrent roles at one employer do; their dates come from the source.
    const startDate = document.experiences[1]?.startDate
    return startDate === null || startDate === undefined ? coherent
      : { ...coherent, coherent: false, issues: [{ fieldId: startDate.id, kind: 'chronology' }] }
  }
  if (coherence === 'redundant-projects-and-mixed-skills-twice') {
    // Projects repeat the experiences on every check; Skills stay incoherent through the first preparation only.
    const project = document.sections.flatMap((section) => section.section === 'projects' ? section.fields : [])[0]
    const skill = document.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])[0]?.items[0]
    const issues = [...(project === undefined ? [] : [{ fieldId: project.id, kind: 'redundant' as const }]),
      ...(skill === undefined || check > 2 ? [] : [{ fieldId: skill.id, kind: 'mixed-association' as const }])]
    return issues.length === 0 ? coherent : { ...coherent, coherent: false, issues }
  }
  const rejections = coherence === 'mixed-projects-once' ? 1 : coherence === 'mixed-projects-twice' ? 2
    : coherence === 'redundant-projects-always' ? Infinity : 0
  const kind = coherence === 'redundant-projects-always' ? 'redundant' : 'mixed-association'
  // The Projects entry repeats or misattributes an experience achievement in the assembled document.
  const field = document.sections.flatMap((section) => section.section === 'projects' ? section.fields : [])[0]
  if (check > rejections || field === undefined) return coherent
  onRejectedField({ fieldId: field.id, text: field.text, reason: kind })
  return { ...coherent, coherent: false, issues: [{ fieldId: field.id, kind }] }
}

