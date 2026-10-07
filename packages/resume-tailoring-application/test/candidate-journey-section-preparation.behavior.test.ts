import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, CandidateSession,
  ResumeCoherenceInput, ResumeDocumentCoherence, ResumeRejectedField, ResumeSectionContent, ResumeSectionModelFailure,
  ResumeSectionWritingInput,
} from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch,
  structuredResumeSource, writeResumeSectionFromFacts } from '@resume-tailoring/application/structured-resume-fixtures'
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

  it('rewrites a section with the fields its validation rejected and the proposition it found unsupported', async () => {
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

  it('accepts an experience context that cites an achievement of the same experience on its first write', async () => {
    const system = createSystemUnderTest({ writtenExperience: 'context-citing-achievement' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectFirstExperienceWrittenOnceWithItsWidenedContext()
  })

  it('copies an experience from its Candidate Facts when its rewrite still fails, and prepares the whole resume', async () => {
    const system = createSystemUnderTest({ writtenExperience: 'role-citing-achievement' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectFirstExperienceCopiedFromItsFactsAndResumePrepared()
  })

  it('rewrites a section once after a writing timeout', async () => {
    const system = createSystemUnderTest({ skillsWritingFailure: 'timeout' })
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

  it('prepares the resume when the second coherence check objects to a field the first accepted unchanged', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-projects-then-unchanged-education' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectOnlyProjectsRewrittenWithTheRejectedFieldAndResumePrepared()
  })

  it('rewrites a section the coherence check rejects from its previous version', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-projects-once' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectProjectsRewrittenFromTheirPreviousVersion()
  })

  it('keeps the coherence feedback when a section rewritten for coherence then fails its validation', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-skills-once', skillsValidation: 'unsupported-on-rewrite',
      writtenSkills: 'versioned' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsRewrittenWithBothRejectionsAndTheirLatestVersion()
  })

  it('keeps the coherence feedback when writing a section rewritten for coherence gets an invalid provider response', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-skills-once', skillsWritingFailure: 'invalid-provider-response',
      skillsWritingFailureOn: 'rewrite' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsWrittenAgainWithTheCoherenceFeedback()
  })

  it('removes a redundancy the second coherence check finds in a field the first accepted', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-projects-then-redundant-language' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectLastRejectedFieldRemovedAndResumePrepared()
  })

  it('still checks an unchanged field of a section rewritten for coherence', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-skills-then-unchanged-category' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'incoherent-content', recovery: 'retry' })
    system.expectSavedSections({ validated: ['value-proposition', 'experiences.0', 'experiences.1', 'education',
      'languages', 'projects', 'certifications'], failed: ['skills'] })
  })

  it('keeps an experience achievement the coherence check finds redundant with another section', async () => {
    const system = createSystemUnderTest({ coherence: 'redundant-achievement-always' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectRedundantAchievementKeptAndResumePrepared()
  })

  it('keeps the Value Proposition the coherence check finds redundant with the experiences it restates', async () => {
    const system = createSystemUnderTest({ coherence: 'redundant-value-proposition-always' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectRedundantValuePropositionKeptAndResumePrepared()
  })

  it('keeps the coherence feedback when a section rewritten for coherence comes back with an unsupported structure', async () => {
    const system = createSystemUnderTest({ coherence: 'mixed-skills-once', writtenSkills: 'uncited-on-rewrite' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsWrittenAgainWithTheCoherenceFeedback()
  })

  it('removes a field the coherence check finds redundant without rewriting or checking again', async () => {
    const system = createSystemUnderTest({ coherence: 'redundant-projects-always' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectRedundantProjectRemovedAndResumePrepared()
  })

  it('removes a skill the coherence check finds duplicated without rewriting or checking again', async () => {
    const system = createSystemUnderTest({ writtenSkills: 'duplicated', coherence: 'duplicated-skill-always' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectDuplicatedSkillRemovedAndResumePrepared()
  })

  it('rewrites the skills instead of removing every copy the coherence check names as duplicated', async () => {
    const system = createSystemUnderTest({ writtenSkills: 'duplicated', coherence: 'every-copy-duplicated-once' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsRewrittenForTheDuplicateAndResumePrepared()
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

  it('puts the achievements that prove the Job Posting first in each experience', async () => {
    const system = createSystemUnderTest({ writtenAchievements: 'relevant-last' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectAchievementOrder(['billing', 'billing-team'])
  })

  it('keeps the written achievement order of a Normalized Resume', async () => {
    const system = createSystemUnderTest({ writtenAchievements: 'relevant-last' })
    await system.givenMatchedCandidateSession()

    await system.prepareNormalizedResume()

    system.expectAchievementOrder(['billing-team', 'billing'])
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

  it('prepares the resume when the coherence check names a language issue although the language matches', async () => {
    const system = createSystemUnderTest({ coherence: 'language-issue-while-language-matches' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparedWithoutRewriting()
  })

  it('rewrites only the section with a language issue when a coherent verdict also names a coherence issue', async () => {
    const system = createSystemUnderTest({ coherence: 'coherence-issue-while-coherent' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectOnlyEducationRewrittenForLanguageAndResumePrepared()
  })

  it('fails only the still incoherent section when the rewritten resume is named for a language that matches', async () => {
    const system = createSystemUnderTest({ coherence: 'language-issues-while-language-matches-after-rewrite' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ reason: 'incoherent-content', recovery: 'retry' })
    system.expectSavedSections({ validated: ['value-proposition', 'experiences.0', 'experiences.1', 'education',
      'languages', 'projects', 'certifications'], failed: ['skills'] })
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
    const system = createSystemUnderTest({ skillsWritingFailure: 'provider-unavailable' })
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
    const system = createSystemUnderTest({ skillsWritingFailure: 'provider-unavailable' })
    await system.givenFailedPreparation()
    await system.givenReloadWithSavedSectionCitingUnattestedFact('education')

    await system.retryPreparation()

    system.expectRetryWrote(['skills', 'education'])
  })

  it('lists an ongoing role first, then roles by end date and start date', async () => {
    const system = createSystemUnderTest({ experienceDates: [['2015', '2017'], ['2019', 'Present'], ['2017', '2019'],
      ['2018', '2019']] })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectExperienceOrder(['experiences.1', 'experiences.3', 'experiences.2', 'experiences.0'])
  })

  it('orders roles of the same year by month, whatever the language of the dates', async () => {
    const system = createSystemUnderTest({ experienceDates: [['Jan 2020', 'June 2021'], ['09/2020', 'nov. 2021'],
      ['2021-03', "Aujourd'hui"], ['févr. 2020', '2021-06']] })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectExperienceOrder(['experiences.2', 'experiences.1', 'experiences.3', 'experiences.0'])
  })

  it('keeps source order between roles with the same dates and lists undated experiences last', async () => {
    const system = createSystemUnderTest({ experienceDates: [[null, null], ['2020', '2022'], ['Summer', 'Autumn'],
      ['2020', '2022'], [null, '2016']] })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()
    await system.prepareTailoredResume()

    system.expectExperienceOrder(['experiences.1', 'experiences.3', 'experiences.4', 'experiences.0', 'experiences.2'])
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

/** The start and end date of each experience of the source, in source order; null when the source gives none. */
type ExperienceDates = readonly [string | null, string | null]

type TestOptions = Readonly<{
  experienceDates?: readonly ExperienceDates[]
  writing?: 'slow'
  heldSection?: 'skills'
  skillsValidation?: 'unsupported-once' | 'unsupported-twice' | 'unsupported-on-rewrite'
  skillsWritingFailure?: ResumeSectionModelFailure
  skillsWritingFailureOn?: 'rewrite'
  writtenPunctuation?: 'em-dash'
  /** The writer lists an achievement citing only the experience context before the one the Match Analysis found relevant. */
  writtenAchievements?: 'relevant-last'
  /**
   * The writer always widens the first experience's context, which its structure allows, or its role, which fails
   * the structure check, with an achievement fact of the same experience.
   */
  writtenExperience?: 'context-citing-achievement' | 'role-citing-achievement'
  writtenSkills?: 'duplicated' | 'versioned' | 'uncited-on-rewrite'
  coherence?: 'mixed-projects-once' | 'mixed-projects-twice' | 'redundant-projects-always' | 'document-level-issue'
    | 'redundant-projects-and-mixed-skills-twice' | 'chronology-on-source-dates'
    | 'unnamed-language-mismatch' | 'language-issue-while-language-matches'
    | 'coherence-issue-while-coherent' | 'mixed-projects-then-unchanged-education'
    | 'duplicated-skill-always' | 'every-copy-duplicated-once' | 'mixed-skills-once' | 'mixed-skills-then-unchanged-category'
    | 'mixed-projects-then-redundant-language'
    | 'redundant-achievement-always' | 'redundant-value-proposition-always' | 'language-issues-while-language-matches-after-rewrite' | 'timeout'
}>

class SectionPreparationTestSystem {
  readonly #options: TestOptions
  // The in-memory persistence a reloaded Candidate Journey restores from.
  readonly #persistence: ReturnType<typeof createInMemoryCandidateSessionPersistence>
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
    this.#persistence = createInMemoryCandidateSessionPersistence({ session: createMatchedSession(options) })
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
    expect(this.#rejectedFields).toEqual([expect.objectContaining({ unsupportedProposition: 'Kubernetes appears in none of the cited facts' })])
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

  expectOnlyEducationRewrittenForLanguageAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writtenSectionKeys().filter((key) => key === 'projects')).toHaveLength(1)
    const educationWrites = this.#writingInputs.filter(({ section }) => section.key === 'education')
    expect(educationWrites.map(({ rejectedFields }) => rejectedFields)).toEqual([[], this.#rejectedFields])
    expect(this.#rejectedFields).toEqual([expect.objectContaining({ reason: 'language' })])
  }

  expectProjectsRewrittenFromTheirPreviousVersion() {
    const [first, rewrite] = this.#writingInputs.filter(({ section }) => section.key === 'projects')
    expect(first?.previousContent).toBeNull()
    expect(rewrite?.previousContent).toEqual(readGroupedResumeSection({ key: 'projects', kind: 'projects' }))
  }

  expectSkillsRewrittenWithBothRejectionsAndTheirLatestVersion() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const [, coherenceRewrite, validationRewrite] = this.#writingInputs.filter(({ section }) => section.key === 'skills')
    const [coherenceRejection, validationRejection] = this.#rejectedFields
    expect(coherenceRewrite?.rejectedFields).toEqual([coherenceRejection])
    expect(validationRewrite?.rejectedFields).toEqual([coherenceRejection, validationRejection])
    expect(validationRewrite?.previousContent).toEqual(withSkillsVersion({ version: 2,
      content: readGroupedResumeSection({ key: 'skills', kind: 'skills' }) }))
  }

  expectSkillsWrittenAgainWithTheCoherenceFeedback() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const [, failedRewrite, retriedRewrite] = this.#writingInputs.filter(({ section }) => section.key === 'skills')
    expect(retriedRewrite?.rejectedFields).toEqual(failedRewrite?.rejectedFields)
    expect(retriedRewrite?.previousContent).toEqual(failedRewrite?.previousContent)
    expect(retriedRewrite?.rejectedFields).toEqual(this.#rejectedFields)
  }

  expectLastRejectedFieldRemovedAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const removed = this.#rejectedFields.at(-1)
    expect(removed?.reason).toBe('redundant')
    expect(JSON.stringify(this.#expectOutcome()?.session.tailoredResume)).not.toContain(`"${removed?.fieldId ?? ''}"`)
  }

  expectRedundantAchievementKeptAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs, 'An experience is not rewritten for a redundancy').toHaveLength(8)
    const [kept] = this.#rejectedFields
    const achievements = this.#expectOutcome()?.session.tailoredResume?.experiences.flatMap(({ achievements }) => achievements)
    expect(achievements?.map(({ id }) => id)).toContain(kept?.fieldId)
  }

  expectRedundantValuePropositionKeptAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs, 'The Value Proposition is not rewritten for a redundancy').toHaveLength(8)
    const [kept] = this.#rejectedFields
    const paragraphs = this.#expectOutcome()?.session.tailoredResume?.valueProposition.paragraphs
    expect(paragraphs?.map(({ id }) => id)).toContain(kept?.fieldId)
  }

  expectRedundantProjectRemovedAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs, 'No section is rewritten for a redundancy').toHaveLength(8)
    expect(this.#coherenceChecks, 'Removing a duplicate needs no second check').toBe(1)
    const [removed] = this.#rejectedFields
    expect(removed).toEqual(expect.objectContaining({ reason: 'redundant' }))
    expect(JSON.stringify(this.#expectOutcome()?.session.tailoredResume)).not.toContain(removed?.text)
  }

  expectDuplicatedSkillRemovedAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs, 'No section is rewritten for a duplicated skill').toHaveLength(8)
    expect(this.#coherenceChecks, 'Removing a duplicate needs no second check').toBe(1)
    const [removed] = this.#rejectedFields
    expect(removed?.fieldId).toBeDefined()
    const skills = this.#expectOutcome()?.session.tailoredResume?.sections
      .flatMap((section) => section.section === 'skills' ? section.groups.flatMap(({ items }) => items) : [])
    expect(skills?.map(({ id }) => id)).not.toContain(removed?.fieldId)
    expect(skills).not.toHaveLength(0)
  }

  expectSkillsRewrittenForTheDuplicateAndResumePrepared() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const skillsWrites = this.#writingInputs.filter(({ section }) => section.key === 'skills')
    expect(skillsWrites.map(({ rejectedFields }) => rejectedFields)).toEqual([[], this.#rejectedFields])
  }

  expectPreparedResumeWithEnDashesOnly() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const resume = JSON.stringify(this.#expectOutcome()?.session.tailoredResume)
    expect(resume).not.toContain('—')
    expect(resume).toContain(' – détail')
  }

  expectAchievementOrder(achievementIds: readonly string[]) {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    const experience = this.#expectOutcome()?.session.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0')
    expect(experience?.achievements.map(({ id }) => id)).toEqual(achievementIds)
  }

  expectExperienceOrder(experienceIds: readonly string[]) {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(view?.session.tailoredResume?.experiences.map(({ id }) => id)).toEqual(experienceIds)
    // The preview reveals the sections in this order while they are written.
    expect(view?.session.preparation?.sections?.filter(({ kind }) => kind === 'experience').map(({ key }) => key))
      .toEqual(experienceIds)
  }

  expectPreparedWithoutRewriting() {
    expect(this.#expectOutcome()?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writingInputs).toHaveLength(8)
    expect(this.#coherenceChecks).toBe(1)
  }

  expectPreparationFailure(failure: Readonly<{ reason: string; recovery: string }>) {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', ...failure })
    // Nothing is published, so no partial Tailored Resume can be rendered or exported.
    expect(view?.session.tailoredResume).toBeNull()
    expect(view?.session.preparedResumeRevision).toBeUndefined()
  }

  expectFirstExperienceWrittenOnceWithItsWidenedContext() {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writtenSectionKeys().filter((key) => key === 'experiences.0')).toHaveLength(1)
    expect(view?.session.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0')?.context).toMatchObject({
      text: 'Customer billing team building accessible screens',
      factIds: ['source-fact-experiences-0-context-0', 'source-fact-experiences-0-achievements-0'] })
  }

  expectFirstExperienceCopiedFromItsFactsAndResumePrepared() {
    const view = this.#expectOutcome()
    expect(view?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(this.#writtenSectionKeys().filter((key) => key === 'experiences.0')).toHaveLength(2)
    const experience = view?.session.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0')
    expect(experience).toMatchObject({
      role: { text: 'Frontend Engineer', factIds: ['source-fact-experiences-0-role-0'] },
      organization: { text: 'Northwind', factIds: ['source-fact-experiences-0-organization-0'] },
      startDate: { text: '2021' }, endDate: { text: '2024' },
      context: { text: 'Customer billing team', factIds: ['source-fact-experiences-0-context-0'] },
      achievements: [{ text: 'Built accessible billing screens', factIds: ['source-fact-experiences-0-achievements-0'] }],
    })
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

function createMatchedSession({ experienceDates }: TestOptions): CandidateSession {
  const startedAt = Date.now()
  return {
    expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000068',
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: { grantedAt: startedAt, policy: testProcessingPolicy },
    sourceIntake: experienceDates === undefined ? structuredResumeSource : createDatedSource(experienceDates), tailoredResume: null,
  }
}

/** The fixture source with its experiences replaced by one per entry, each dated as given. */
function createDatedSource(experienceDates: readonly ExperienceDates[]): CandidateSession['sourceIntake'] {
  const experienceFacts = experienceDates.flatMap(([startDate, endDate], index) => [
    ['role', `Role ${String(index)}`], ['organization', `Organization ${String(index)}`], ['startDate', startDate],
    ['endDate', endDate], ['achievements', `Delivered outcome ${String(index)}`],
  ].flatMap(([name, value]) => value === null || value === undefined ? [] : [{
    id: `source-fact-experiences-${String(index)}-${name ?? ''}-0` as const, path: `experiences.${String(index)}.${name ?? ''}.0`,
    status: 'attested' as const, value }]))
  return { ...structuredResumeSource, candidateFacts: [...experienceFacts,
    ...structuredResumeSource.candidateFacts.filter(({ path }) => !path.startsWith('experiences.'))] }
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
        const failingWrite = options.skillsWritingFailureOn === 'rewrite' ? 2 : 1
        if (input.section.kind === 'skills' && failure !== undefined && models.onSkillsWrite() === failingWrite) {
          return { ok: false, error: { type: failure } }
        }
        const written = options.experienceDates !== undefined && input.section.kind === 'experience'
          ? writeResumeSectionFromFacts(input) : readGroupedResumeSection(input.section)
        const content = options.writtenSkills === 'duplicated' ? withDuplicatedSkill(written)
          : options.writtenSkills === 'versioned' ? withSkillsVersion({ content: written, version: input.rejectedFields.length + 1 })
            // The first rewrite cites a fact the section was not given, which fails the structure check.
            : options.writtenSkills === 'uncited-on-rewrite' && input.previousContent !== null && models.onSkillsWrite() === 1
              ? withUncitedSkills(written) : written
        const widened = options.writtenExperience === undefined ? content
          : withFieldCitingAchievement({ content, field: options.writtenExperience === 'role-citing-achievement' ? 'role' : 'context' })
        const ordered = options.writtenAchievements === 'relevant-last' ? withContextAchievementFirst(widened) : widened
        return { ok: true, value: options.writtenPunctuation === 'em-dash' ? withEmDashes(ordered) : ordered }
      },
      validateFields: ({ section, fields }) => {
        const validation = section.kind === 'skills' ? models.onSkillsValidation() : 0
        const unsupported = (options.skillsValidation === 'unsupported-once' && validation === 1)
          || (options.skillsValidation === 'unsupported-twice' && validation <= 2)
          || (options.skillsValidation === 'unsupported-on-rewrite' && validation === 2)
        const rejected = unsupported && section.kind === 'skills' ? fields[0] : undefined
        // The validator names the proposition it found unsupported, as a cited fact that does not mention it.
        const unsupportedProposition = 'Kubernetes appears in none of the cited facts'
        if (rejected !== undefined) models.onRejectedField({ fieldId: rejected.id, text: rejected.text, reason: 'unsupported', unsupportedProposition })
        return Promise.resolve({ ok: true, value: { fields: fields.map(({ id }) => id === rejected?.id
          ? { fieldId: id, supported: false, unsupportedProposition } : { fieldId: id, supported: true }) } })
      },
      checkCoherence: ({ document }) => {
        if (options.coherence === 'timeout') return Promise.resolve({ ok: false, error: { type: 'timeout' } })
        return Promise.resolve({ ok: true, value: readCoherence({ coherence: options.coherence, check: models.onCoherenceCheck(),
          document, onRejectedField: models.onRejectedField }) })
      },
    }),
  })
}

/** Marks the Skills a writer wrote with how much feedback it had, so each version differs from the previous one. */
function withSkillsVersion({ content, version }: Readonly<{ content: ResumeSectionContent; version: number }>): ResumeSectionContent {
  if (content.kind !== 'skills') return content
  return { ...content, groups: content.groups.map((group) => ({ ...group,
    items: group.items.map((item) => ({ ...item, text: `${item.text} v${String(version)}` })) })) }
}

function withUncitedSkills(content: ResumeSectionContent): ResumeSectionContent {
  if (content.kind !== 'skills') return content
  return { ...content, groups: content.groups.map((group) => ({ ...group,
    items: group.items.map((item) => ({ ...item, factIds: ['source-fact-uncited-0'] })) })) }
}

/** Repeats the first skill in a group of its own under another id, as a writing model sometimes does. */
function withDuplicatedSkill(content: ResumeSectionContent): ResumeSectionContent {
  const first = content.kind === 'skills' ? content.groups[0]?.items[0] : undefined
  if (content.kind !== 'skills' || first === undefined) return content
  return { ...content, groups: [...content.groups, { id: 'skills-copy', category: null, items: [{ ...first, id: `${first.id}-copy` }] }] }
}

function withContextAchievementFirst(content: ResumeSectionContent): ResumeSectionContent {
  if (content.kind !== 'experience' || content.experience.id !== 'experiences.0') return content
  return { kind: 'experience', experience: { ...content.experience, achievements: [
    { id: 'billing-team', text: 'Worked in the customer billing team', factIds: ['source-fact-experiences-0-context-0'] },
    ...content.experience.achievements] } }
}

function withFieldCitingAchievement({ content, field }: Readonly<{
  content: ResumeSectionContent; field: 'context' | 'role'
}>): ResumeSectionContent {
  if (content.kind !== 'experience' || content.experience.id !== 'experiences.0') return content
  const text = field === 'role' ? 'Frontend Engineer building accessible screens' : 'Customer billing team building accessible screens'
  return { kind: 'experience', experience: { ...content.experience, [field]: { id: `experiences.0.${field}`, text,
    factIds: [`source-fact-experiences-0-${field}-0`, 'source-fact-experiences-0-achievements-0'] } } }
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
  if (coherence === 'language-issues-while-language-matches-after-rewrite') {
    // As in production: Skills stay incoherent, and once rewritten, the language matches yet language issues are named.
    const skill = document.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])[0]?.items[0]
    const education = document.sections.flatMap((section) => section.section === 'education' ? section.fields : [])[0]
    const paragraph = document.valueProposition.paragraphs[0]
    if (skill === undefined || education === undefined || paragraph === undefined) return coherent
    const languageIssues = [{ fieldId: 'document.purpose', kind: 'language' as const },
      { fieldId: education.id, kind: 'language' as const }, { fieldId: paragraph.id, kind: 'language' as const }]
    return { coherent: false, languageMatches: check > 1,
      issues: [{ fieldId: skill.id, kind: 'skill-category' }, ...(check > 1 ? languageIssues : languageIssues.slice(1, 2))] }
  }
  if (coherence === 'coherence-issue-while-coherent') {
    // The verdict contradicts itself on the first check: the resume is coherent, yet it names a project as misattributed.
    const project = document.sections.flatMap((section) => section.section === 'projects' ? section.fields : [])[0]
    const education = document.sections.flatMap((section) => section.section === 'education' ? section.fields : [])[0]
    if (check > 1 || project === undefined || education === undefined) return coherent
    onRejectedField({ fieldId: education.id, text: education.text, reason: 'language' })
    return { ...coherent, languageMatches: false, issues: [{ fieldId: project.id, kind: 'mixed-association' },
      { fieldId: education.id, kind: 'language' }] }
  }
  if (coherence === 'language-issue-while-language-matches') {
    // The verdict contradicts itself: the language matches, yet it names an education field as a language issue.
    // As in production, it is also not coherent while naming nothing else, which leaves nothing to rewrite.
    const education = document.sections.flatMap((section) => section.section === 'education' ? section.fields : [])[0]
    return education === undefined ? coherent
      : { ...coherent, coherent: false, issues: [{ fieldId: education.id, kind: 'language' }] }
  }
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
  if (coherence === 'redundant-value-proposition-always') {
    // Against its instructions, the check names the Value Proposition that restates the experiences.
    const paragraph = document.valueProposition.paragraphs[0]
    if (paragraph === undefined) return coherent
    onRejectedField({ fieldId: paragraph.id, text: paragraph.text, reason: 'redundant' })
    return { ...coherent, coherent: false, issues: [{ fieldId: paragraph.id, kind: 'redundant' }] }
  }
  if (coherence === 'redundant-achievement-always') {
    // Against its instructions, the check names the experience achievement that a project repeats.
    const achievement = document.experiences[0]?.achievements[0]
    if (achievement === undefined) return coherent
    onRejectedField({ fieldId: achievement.id, text: achievement.text, reason: 'redundant' })
    return { ...coherent, coherent: false, issues: [{ fieldId: achievement.id, kind: 'redundant' }] }
  }
  if (coherence === 'mixed-projects-then-redundant-language') {
    // Only the second check notices that a Languages entry repeats another one.
    const language = document.sections.flatMap((section) => section.section === 'languages' ? section.fields : [])[0]
    if (check === 1 || language === undefined) return readCoherence({ coherence: 'mixed-projects-once', check, document, onRejectedField })
    onRejectedField({ fieldId: language.id, text: language.text, reason: 'redundant' })
    return { ...coherent, coherent: false, issues: [{ fieldId: language.id, kind: 'redundant' }] }
  }
  if (coherence === 'mixed-skills-then-unchanged-category') {
    // After the Skills rewrite moved items, the category label it kept unchanged no longer describes them.
    const category = document.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])[0]?.category
    if (check === 1 || category === null || category === undefined) {
      return readCoherence({ coherence: 'mixed-skills-once', check, document, onRejectedField })
    }
    return { ...coherent, coherent: false, issues: [{ fieldId: category.id, kind: 'skill-category' }] }
  }
  if (coherence === 'mixed-skills-once') {
    // A skill is associated with the wrong experience in the first assembled document only.
    const skill = document.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])[0]?.items[0]
    if (check > 1 || skill === undefined) return coherent
    onRejectedField({ fieldId: skill.id, text: skill.text, reason: 'mixed-association' })
    return { ...coherent, coherent: false, issues: [{ fieldId: skill.id, kind: 'mixed-association' }] }
  }
  const skills = document.sections.flatMap((section) => section.section === 'skills' ? section.groups : []).flatMap(({ items }) => items)
  const copies = skills.filter(({ text }) => text === skills[0]?.text)
  if (coherence === 'duplicated-skill-always') {
    // The copy of a skill repeats it on every check.
    const copy = copies[1]
    if (copy === undefined) return coherent
    onRejectedField({ fieldId: copy.id, text: copy.text, reason: 'duplicated-skill' })
    return { ...coherent, coherent: false, issues: [{ fieldId: copy.id, kind: 'duplicated-skill' }] }
  }
  if (coherence === 'every-copy-duplicated-once') {
    // Against its instructions, the first check names both copies of a skill.
    if (check > 1 || copies.length < 2) return coherent
    for (const copy of copies) onRejectedField({ fieldId: copy.id, text: copy.text, reason: 'duplicated-skill' })
    return { ...coherent, coherent: false, issues: copies.map(({ id }) => ({ fieldId: id, kind: 'duplicated-skill' as const })) }
  }
  if (coherence === 'mixed-projects-then-unchanged-education') {
    // The second check objects to the Education entry the first check saw unchanged and accepted.
    const education = document.sections.flatMap((section) => section.section === 'education' ? section.fields : [])[0]
    if (check === 1 || education === undefined) return readCoherence({ coherence: 'mixed-projects-once', check, document, onRejectedField })
    return { ...coherent, coherent: false, issues: [{ fieldId: education.id, kind: 'mixed-association' }] }
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

