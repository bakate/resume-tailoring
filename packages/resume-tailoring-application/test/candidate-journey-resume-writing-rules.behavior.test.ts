import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, CandidateSession, ResumeFieldValidationInput,
  ResumeSectionContent } from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeSectionModels, createInMemoryCandidateSessionPersistence,
  testProcessingPolicy } from '@resume-tailoring/application/testing'
import type { TailoredResumeField } from '@resume-tailoring/application/tailored-resume'

describe('Candidate Journey resume writing rules enforced by code', () => {
  it.each([
    ['Frontend Engineer (CDI)'],
    ['Frontend Engineer – CDD'],
    ['Frontend Engineer, Freelance'],
    ['Frontend Engineer (stage)'],
    ['Frontend Engineer (CDD – 6 mois)'],
    ["Frontend Engineer (Stage de fin d'études)"],
    ['Frontend Engineer (CDI de chantier)'],
    ['Frontend Engineer – Contractor'],
    ['Frontend Engineer | Portage salarial'],
    ['Frontend Engineer - full-time'],
    ['Frontend Engineer freelance'],
  ])('keeps the contract type of "%s" out of the job title', async (writtenRole) => {
    const system = createSystemUnderTest({ writtenRole })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectFirstExperienceRole('Frontend Engineer')
  })

  it.each([['Contract Manager (Stage Lighting)'], ['Set Designer (Stage design)'], ['Responsable de stage']])(
    'keeps "%s", a job title that only looks like a contract type', async (writtenRole) => {
      const system = createSystemUnderTest({ writtenRole })
      await system.givenMatchedCandidateSession()

      await system.prepareTailoredResume()

      system.expectFirstExperienceRole(writtenRole)
    })

  it('drops the label of a skills group whose only item repeats it', async () => {
    const system = createSystemUnderTest({ writtenSkills: 'label-repeated-by-its-only-item' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillGroups([['Front-end', ['React', 'TypeScript']], [null, ['Accessibility WCAG']]])
  })

  it('heads a Tailored Resume with the headline its Value Proposition writer cites, validated with it', async () => {
    const system = createSystemUnderTest({ writtenHeadline: 'Frontend Engineer – React' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectHeadline({ text: 'Frontend Engineer – React',
      factIds: ['source-fact-experiences-0-role-0', 'source-fact-skills-0-name-0'] })
    system.expectHeadlineValidatedWithTheValueProposition()
  })

  it('heads a Tailored Resume with the latest role the Candidate held when the writer gives no headline', async () => {
    const system = createSystemUnderTest({ writtenRole: 'Frontend Engineer (CDI)' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectHeadline({ text: 'Frontend Engineer', factIds: ['source-fact-experiences-0-role-0'] })
  })

  it('heads it with the latest role, without a rewrite, when validation rejects only the written headline', async () => {
    const system = createSystemUnderTest({ writtenHeadline: 'Senior Frontend Engineer', headlineValidation: 'unsupported' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectHeadline({ text: 'Frontend Engineer', factIds: ['source-fact-experiences-0-role-0'] })
    system.expectValuePropositionWrittenOnce()
  })

  it('gives a Normalized Resume no headline', async () => {
    const system = createSystemUnderTest({ writtenHeadline: 'Frontend Engineer – React' })
    await system.givenMatchedCandidateSession()

    await system.prepareNormalizedResume()

    system.expectNoHeadline()
  })
})

function createSystemUnderTest(options: TestOptions = {}) {
  return new ResumeWritingRulesTestSystem(options)
}

type TestOptions = Readonly<{
  /** The first experience's role as the writer returns it, citing the role fact. */
  writtenRole?: string
  /** The Value Proposition headline as the writer returns it, citing the first role and the React skill. */
  writtenHeadline?: string
  /** The writer adds a group labelled "Accessibility" whose only item is "Accessibility WCAG". */
  writtenSkills?: 'label-repeated-by-its-only-item'
  /** Validation finds the written headline unsupported, and every other field supported. */
  headlineValidation?: 'unsupported'
}>

class ResumeWritingRulesTestSystem {
  readonly #journey: CandidateJourney
  readonly #validations: ResumeFieldValidationInput[] = []
  #valuePropositionWrites = 0
  #outcome: CandidateJourneyView | null = null

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      persistence: createInMemoryCandidateSessionPersistence({ session: createMatchedSession() }),
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: ({ section }) => {
          if (section.kind === 'value-proposition') this.#valuePropositionWrites += 1
          return Promise.resolve({ ok: true, value: write({ content: readGroupedResumeSection(section), options }) })
        },
        validateFields: (input) => {
          this.#validations.push(input)
          return Promise.resolve({ ok: true, value: { fields: input.fields.map(({ id }) => ({ fieldId: id,
            supported: !(options.headlineValidation === 'unsupported' && id === 'headline') })) } })
        },
      }),
    }) })
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

  expectFirstExperienceRole(text: string) {
    expect(this.#readResume().experiences.find(({ id }) => id === 'experiences.0')?.role?.text).toBe(text)
  }

  expectSkillGroups(groups: readonly (readonly [string | null, readonly string[]])[]) {
    const skills = this.#readResume().sections.flatMap((section) => section.section === 'skills' ? section.groups : [])
    expect(skills.map(({ category, items }) => [category?.text ?? null, items.map(({ text }) => text)])).toEqual(groups)
  }

  expectHeadline({ text, factIds }: Readonly<{ text: string; factIds: readonly string[] }>) {
    expect(this.#readResume().headline).toMatchObject({ text, factIds })
  }

  expectHeadlineValidatedWithTheValueProposition() {
    this.#readResume()
    const validated = this.#validations.filter(({ section }) => section.kind === 'value-proposition')
      .flatMap(({ fields }) => fields.map(({ text }) => text))
    expect(validated).toContain('Frontend Engineer – React')
  }

  expectValuePropositionWrittenOnce() {
    this.#readResume()
    expect(this.#valuePropositionWrites).toBe(1)
  }

  expectNoHeadline() {
    expect(this.#readResume().headline ?? null).toBeNull()
  }

  async #preparationFinished() {
    await expect.poll(() => this.#readOpenView().operation).toBeNull()
    this.#outcome = this.#journey.readView()
  }

  #readResume() {
    expect(this.#outcome, 'Prepare a resume before reading it').not.toBeNull()
    const view = this.#readOpenView()
    expect(view.preparationOutcome).toMatchObject({ status: 'prepared' })
    const resume = view.session.tailoredResume
    if (resume === null) return expect.fail('Expected a prepared resume')
    return resume
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') return expect.fail('Expected an open Candidate Session')
    return view
  }
}

/** The grouped fixture section, changed as the options say a writer returned it. */
function write({ content, options }: Readonly<{ content: ResumeSectionContent; options: TestOptions }>): ResumeSectionContent {
  if (content.kind === 'value-proposition') {
    const headline: TailoredResumeField | null = options.writtenHeadline === undefined ? null : { id: 'headline',
      text: options.writtenHeadline, factIds: ['source-fact-experiences-0-role-0', 'source-fact-skills-0-name-0'] }
    return { ...content, headline }
  }
  if (content.kind === 'experience' && content.experience.id === 'experiences.0' && options.writtenRole !== undefined) {
    return { kind: 'experience', experience: { ...content.experience, role: { id: 'role-northwind', text: options.writtenRole,
      factIds: ['source-fact-experiences-0-role-0'] } } }
  }
  if (content.kind === 'skills' && options.writtenSkills !== undefined) {
    return { ...content, groups: [...content.groups, { id: 'skills.accessibility',
      category: { id: 'accessibility', text: 'Accessibility', factIds: ['source-fact-skills-0-category-0'] },
      items: [{ id: 'wcag', text: 'Accessibility WCAG', factIds: ['source-fact-skills-1-name-0'] }] }] }
  }
  return content
}

function createMatchedSession(): CandidateSession {
  const startedAt = Date.now()
  return {
    expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000139',
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: { grantedAt: startedAt, policy: testProcessingPolicy },
    sourceIntake: structuredResumeSource, tailoredResume: null,
  }
}
