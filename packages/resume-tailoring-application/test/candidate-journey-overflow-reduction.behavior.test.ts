import { describe, expect, it } from 'vitest'
import { assessResumeExport, candidateSessionDurationMilliseconds, candidateSessionStorageVersion,
  createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateSession, ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import { structuredResumeJobMatch, structuredResumeSource,
  writeResumeSectionFromFacts } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeDocumentRenderer, createFakeResumeSectionModels,
  createInMemoryCandidateSessionPersistence, testProcessingPolicy } from '@resume-tailoring/application/testing'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'

describe('Candidate Journey Overflow Reduction to the Page Budget', () => {
  it('leaves a resume that fits on one page unchanged', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectNoHiddenContent()
    system.expectAchievementCounts({ tailspin: 6, litware: 4, contoso: 2 })
    system.expectRenderedPageCounts([1])
  })

  it('first takes the Context Experience down to one achievement and stops at the first one-page result', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 1 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectHiddenByReduction(['contoso achievement 2'])
    system.expectRenderedPageCounts([2, 1])
  })

  it('then takes the Context Experience down to one line', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 3 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectHiddenByReduction(['contoso achievement 2', 'Lyon', 'Contoso store team', 'contoso achievement 1'])
    system.expectContextExperienceOnOneLine()
    system.expectRenderedPageCounts([2, 2, 1])
  })

  it('then reduces the Projects, then the Skills, to those the Match Analysis found relevant', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 5 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectHiddenByReduction(['contoso achievement 2', 'Lyon', 'Contoso store team', 'contoso achievement 1',
      'Inventory spreadsheet', 'Excel'])
    system.expectRenderedPageCounts([2, 2, 2, 2, 1])
  })

  it('then hides one achievement at a time from the Relevant Experience with the most achievements per year', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 8 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    // Litware shows four achievements over two years, Tailspin six over nearly six: Litware loses one first,
    // then each in turn as their rates cross.
    system.expectHiddenAchievementsByReduction(['contoso achievement 2', 'contoso achievement 1',
      'litware achievement 4', 'litware achievement 3', 'tailspin achievement 6'])
    system.expectAchievementCounts({ tailspin: 5, litware: 2, contoso: 0 })
  })

  it('keeps at least two achievements in every Relevant Experience', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 11 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectAchievementCounts({ tailspin: 2, litware: 2, contoso: 0 })
  })

  it('accepts two pages only when no step reaches one, keeping the two-page result with the least Hidden Content', async () => {
    const system = createSystemUnderTest({ linesPerPage: Math.ceil(fullResumeLines / 2) - 1 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    // The full resume takes three pages; the first step brings it to two, and no later step reaches one.
    system.expectHiddenByReduction(['contoso achievement 2'])
  })

  it('keeps a two-page resume unchanged when no step reaches one page', async () => {
    const system = createSystemUnderTest({ linesPerPage: Math.ceil(fullResumeLines / 2) })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectNoHiddenContent()
    system.expectAchievementCounts({ tailspin: 6, litware: 4, contoso: 2 })
  })

  it('leaves the resume unchanged when every step still exceeds two pages', async () => {
    const system = createSystemUnderTest({ linesPerPage: 5 })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectNoHiddenContent()
    system.expectAchievementCounts({ tailspin: 6, litware: 4, contoso: 2 })
  })

  it('keeps the existing overflow outcome for a resume that exceeds two pages after every step', async () => {
    const system = createSystemUnderTest({ linesPerPage: 5 })
    await system.givenPreparedTailoredResume()

    await system.assessLayout()

    system.expectOverflowBlockingExport()
  })

  it('leaves the resume unchanged when it cannot be rendered', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 1, rendering: 'unavailable' })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectNoHiddenContent()
  })

  it('leaves a Normalized Resume to its own length, since it claims no relevance to reduce by', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 1 })
    await system.givenMatchedCandidateSession()

    await system.prepareNormalizedResume()

    system.expectNoHiddenContent()
    system.expectRenderedPageCounts([])
  })

  it('lets the Candidate restore what reduction hid, and never hides it again', async () => {
    const system = createSystemUnderTest({ linesPerPage: fullResumeLines - 1 })
    await system.givenPreparedTailoredResume()

    await system.restoreHiddenAchievement('contoso achievement 2')

    system.expectNoHiddenContent()
    system.expectAchievementCounts({ tailspin: 6, litware: 4, contoso: 2 })
  })

  it('shortens restored content that overflows the Page Budget by hiding other content first', async () => {
    const system = createSystemUnderTest({ linesPerPage: Math.ceil(fullResumeLines / 2) - 1 })
    await system.givenPreparedTailoredResume()
    await system.restoreHiddenAchievement('contoso achievement 2')
    await system.assessLayout()
    system.expectOverflowBlockingExport()

    await system.shortenResume()

    system.expectHiddenByReduction(['contoso achievement 1'])
    system.expectMeasuredPageCount(2)
  })

  it('hides restored content again when the Candidate shortens and nothing else is left to hide', async () => {
    // Two pages hold the resume only once every hideable line is gone.
    const system = createSystemUnderTest({ linesPerPage: 8 })
    await system.givenPreparedTailoredResume()
    await system.restoreHiddenAchievement('contoso achievement 2')
    await system.assessLayout()
    system.expectOverflowBlockingExport()

    await system.shortenResume()

    system.expectHiddenByReductionIncluding('contoso achievement 2')
    system.expectMeasuredPageCount(2)
  })

  it('proposes shorter wording when no reduction brings the resume back within two pages', async () => {
    const system = createSystemUnderTest({ linesPerPage: 5 })
    await system.givenPreparedTailoredResume()
    await system.assessLayout()

    await system.shortenResume()

    system.expectNoHiddenContent()
    system.expectCondensationProposed()
  })
})

function createSystemUnderTest(options: TestOptions) {
  return new OverflowReductionTestSystem(options)
}

type TestOptions = Readonly<{
  /** How many lines the fake renderer lays out per page; a page count follows from the visible content. */
  linesPerPage: number
  rendering?: 'unavailable'
}>

class OverflowReductionTestSystem {
  readonly #journey: CandidateJourney
  readonly #renderedPageCounts: number[] = []

  constructor(options: TestOptions) {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => careerToday,
      persistence: createInMemoryCandidateSessionPersistence({ session: createMatchedSession() }),
      // Condensation keeps each claim's wording; the layout is measured by the renderer below.
      resumeDocumentPorts: { condenseClaim: ({ claim }) => Promise.resolve({ ok: true, value: claim }),
        validateClaim: () => Promise.resolve({ ok: true, value: { supported: true } }) },
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: (input) => Promise.resolve({ ok: true, value: writeResumeSectionFromFacts(input) }) }),
      resumeDocumentRenderer: createFakeResumeDocumentRenderer({ render: (request) => {
        if (options.rendering === 'unavailable') return Promise.reject(new Error('Renderer unavailable'))
        const pageCount = Math.ceil(countVisibleLines(request.draft.document) / options.linesPerPage)
        this.#renderedPageCounts.push(pageCount)
        return Promise.resolve(renderPages({ request, pageCount }))
      } }),
    }) })
  }

  async givenMatchedCandidateSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async givenPreparedTailoredResume() {
    await this.givenMatchedCandidateSession()
    await this.prepareTailoredResume()
  }

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation()
    await this.#preparationFinished()
  }

  async prepareNormalizedResume() {
    this.#journey.startTailoredResumePreparation({ purpose: 'normalized' })
    await this.#preparationFinished()
  }

  async restoreHiddenAchievement(text: string) {
    const hidden = this.#readHiddenFields().find(({ field }) => field.text === text)
    if (hidden === undefined) expect.fail(`Expected ${text} to be hidden`)
    this.#journey.restoreResumeField({ fieldId: hidden.field.id })
    await expect.poll(() => this.#readHiddenFields().some(({ field }) => field.id === hidden.field.id)).toBe(false)
  }

  async shortenResume() {
    await this.#journey.shortenResume()
  }

  async assessLayout() {
    await this.#journey.assessResumeLayout()
  }

  expectNoHiddenContent() {
    expect(this.#readHiddenFields()).toEqual([])
  }

  expectHiddenByReduction(texts: readonly string[]) {
    expect(this.#readHiddenFields().map(readTextAndOrigin)).toEqual(texts.map(hiddenByReduction))
  }

  expectHiddenAchievementsByReduction(texts: readonly string[]) {
    expect(this.#readHiddenFields().filter(({ location }) => location.kind === 'experience' && location.fieldName === 'achievements')
      .map(readTextAndOrigin)).toEqual(texts.map(hiddenByReduction))
  }

  expectHiddenByReductionIncluding(text: string) {
    expect(this.#readHiddenFields().map(readTextAndOrigin)).toContainEqual(hiddenByReduction(text))
  }

  expectCondensationProposed() {
    expect(this.#readOpenView().resumeReview?.proposal).toMatchObject({ layout: { status: 'overflow' } })
  }

  expectMeasuredPageCount(pageCount: number) {
    const assessment = this.#readOpenView().resumeReview?.assessment
    expect(assessment?.layout).toMatchObject({ status: 'fits', pageCount })
    expect(assessment?.exportEligibility.status === 'blocked' ? assessment.exportEligibility.reasons : []).not.toContain('overflow')
  }

  expectAchievementCounts(counts: Readonly<Record<'tailspin' | 'litware' | 'contoso', number>>) {
    const experiences = this.#readResume().experiences
    expect(Object.fromEntries(Object.keys(counts).map((name) => [name, experiences.find(({ organization }) =>
      organization?.text.toLowerCase() === name)?.achievements.length]))).toEqual(counts)
  }

  expectContextExperienceOnOneLine() {
    expect(this.#readResume().experiences.find(({ chronology }) => chronology === 'context')).toMatchObject({
      role: { text: 'Store Manager' }, organization: { text: 'Contoso' }, startDate: { text: '2016' }, endDate: { text: '2018' },
      location: null, context: null, achievements: [] })
  }

  expectRenderedPageCounts(pageCounts: readonly number[]) {
    expect(this.#renderedPageCounts).toEqual(pageCounts)
  }

  expectOverflowBlockingExport() {
    expect(this.#readOpenView().resumeReview?.assessment).toMatchObject({ layout: { status: 'overflow' },
      exportEligibility: { status: 'blocked', reasons: expect.arrayContaining(['overflow']) as unknown } })
  }

  async #preparationFinished() {
    await expect.poll(() => this.#readOpenView().operation === null
      && this.#readOpenView().preparationOutcome?.status === 'prepared').toBe(true)
  }

  #readHiddenFields() {
    return this.#readOpenView().resumeReview?.recovery.hiddenFields ?? []
  }

  #readResume(): TailoredResume {
    const resume = this.#readOpenView().session.tailoredResume
    if (resume === null) expect.fail('Expected a Tailored Resume')
    return resume
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') expect.fail(`Expected an open Candidate Session, got ${view.status}`)
    return view
  }
}

function readTextAndOrigin({ field, origin }: Readonly<{ field: Readonly<{ text: string }>; origin: string }>) {
  return { text: field.text, origin }
}

function hiddenByReduction(text: string) {
  return { text, origin: 'overflow-reduction' }
}

/** One line per Value Proposition paragraph, experience heading, context, achievement, skill and section entry. */
function countVisibleLines(resume: TailoredResume) {
  return resume.valueProposition.paragraphs.length
    + resume.experiences.reduce((lines, { context, achievements }) => lines + 1 + (context === null ? 0 : 1) + achievements.length, 0)
    + resume.sections.reduce((lines, section) => lines + (section.section === 'skills'
      ? section.groups.reduce((items, group) => items + group.items.length, 0) : section.fields.length), 0)
}

function renderPages({ request, pageCount }: Readonly<{ request: ResumeRenderRequest; pageCount: number }>) {
  const layout = pageCount === 1 || pageCount === 2
    ? { status: 'fits', revision: request.draft.revision, pageCount } as const
    : { status: 'overflow', revision: request.draft.revision, pageCount } as const
  return { assessment: assessResumeExport({ ...request, layout }), pdf: new TextEncoder().encode('%PDF-') }
}

const careerToday = Date.UTC(2026, 9, 7)

/** Experiences in source order, as [role, organization, start, end, location, achievement count, relevant indexes]. */
const careerExperiences = [
  // Nearly six years and ongoing: six achievements, about one a year.
  ['Platform Engineer', 'Tailspin', 'Jan 2021', 'Present', 'Paris', 6, [0]],
  // Two years: four achievements, two a year.
  ['Mobile Developer', 'Litware', 'Jan 2019', 'Dec 2020', 'Paris', 4, [0]],
  // The most recent unrelated role of at least six months: a Context Experience.
  ['Store Manager', 'Contoso', '2016', '2018', 'Lyon', 2, []],
  // An Earlier Experience: one line from the start.
  ['Intern', 'Wingtip', '2014', '2015', 'Lyon', 1, []],
] as const

const careerSource: CandidateSession['sourceIntake'] = { ...structuredResumeSource,
  candidateFacts: [
    ...careerExperiences.flatMap(([role, organization, startDate, endDate, location, achievementCount], index) => [
      ['role.0', role], ['organization.0', organization], ['startDate.0', startDate], ['endDate.0', endDate], ['location.0', location],
      ['context.0', organization === 'Contoso' ? 'Contoso store team' : `${organization} product team`],
      ...Array.from({ length: achievementCount }, (_value, item) =>
        [`achievements.${String(item)}`, `${organization.toLowerCase()} achievement ${String(item + 1)}`] as const),
    ].map(([name, value]) => ({ path: `experiences.${String(index)}.${name}`, value }))),
    { path: 'projects.0.name.0', value: 'Design system' },
    { path: 'projects.1.name.0', value: 'Inventory spreadsheet' },
    { path: 'skills.0.category.0', value: 'Tools' }, { path: 'skills.0.name.0', value: 'React' },
    { path: 'skills.1.category.0', value: 'Tools' }, { path: 'skills.1.name.0', value: 'Excel' },
  ].map(({ path, value }) => ({ id: `source-fact-${path.replaceAll('.', '-')}`, path, status: 'attested' as const, value })),
}

const careerJobMatch: CandidateSession['jobMatch'] = { ...structuredResumeJobMatch,
  analysis: { ...structuredResumeJobMatch.analysis, relevantFactIds: [
    ...careerExperiences.flatMap(([, , , , , , relevant], index) =>
      relevant.map((item) => `source-fact-experiences-${String(index)}-achievements-${String(item)}`)),
    'source-fact-projects-0-name-0', 'source-fact-skills-0-name-0'] } }

/** Every line of the fully written resume, from which each scenario sets the page size. */
const fullResumeLines = 27

function createMatchedSession(): CandidateSession {
  return {
    expiresAt: careerToday + candidateSessionDurationMilliseconds, startedAt: careerToday,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000124',
    jobMatch: careerJobMatch, phase: 'job-match', processingConsent: { grantedAt: careerToday, policy: testProcessingPolicy },
    sourceIntake: careerSource, tailoredResume: null,
  }
}
