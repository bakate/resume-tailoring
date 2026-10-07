import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, CandidateSession, FailureCause, Recovery,
  ResumeSectionModelError } from '@resume-tailoring/application/candidate-journey'
import { readGroupedResumeSection, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeJobPostingExtractor, createFakeMatchEvidenceMatcher,
  createFakeResumeSectionModels, createFakeSourceProfileExtractor, createInMemoryCandidateSessionPersistence,
  testProcessingPolicy } from '@resume-tailoring/application/testing'
import type { ReadApiFailure } from '@resume-tailoring/application/ports'

describe('Failure Cause and Recovery', () => {
  it.each<Readonly<{ apiFailure: ReadApiFailure; cause: FailureCause; recovery: Recovery }>>([
    { apiFailure: { type: 'demo-access-required' }, cause: { type: 'access-required' }, recovery: 'renew-access' },
    { apiFailure: { type: 'rate-limited', retryAfterSeconds: 20 }, cause: { type: 'rate-limited', retryAfterSeconds: 20 },
      recovery: 'retry-after' },
    { apiFailure: { type: 'timeout' }, cause: { type: 'timeout' }, recovery: 'retry' },
    { apiFailure: { type: 'input-too-large' }, cause: { type: 'input-too-large' }, recovery: 'shorten-input' },
    { apiFailure: { type: 'provider-unavailable' }, cause: { type: 'service-unavailable' }, recovery: 'retry' },
    { apiFailure: { type: 'invalid-provider-response' }, cause: { type: 'service-unavailable' }, recovery: 'retry' },
    { apiFailure: { type: 'service-misconfigured' }, cause: { type: 'service-unavailable' }, recovery: 'retry' },
    { apiFailure: { type: 'network' }, cause: { type: 'network' }, recovery: 'retry' },
    { apiFailure: { type: 'unexpected-response' }, cause: { type: 'unexpected' }, recovery: 'reload' },
    { apiFailure: { type: 'invalid-input' }, cause: { type: 'unexpected' }, recovery: 'reload' },
  ])('offers $recovery when a Resume Section fails with $apiFailure.type', async ({ apiFailure, cause, recovery }) => {
    const system = createSystemUnderTest({ skillsWriting: { failure: apiFailure, on: 'every-write' } })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ cause, recovery })
  })

  it('waits a default delay when a rate limit names none', async () => {
    const system = createSystemUnderTest({ skillsWriting: { failure: { type: 'rate-limited' }, on: 'every-write' } })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ cause: { type: 'rate-limited', retryAfterSeconds: 30 }, recovery: 'retry-after' })
  })

  it('names the failure no retry can fix when sections fail differently', async () => {
    const system = createSystemUnderTest({ skillsWriting: { failure: { type: 'network' }, on: 'every-write' },
      languagesWriting: { type: 'input-too-large' } })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectPreparationFailure({ cause: { type: 'input-too-large' }, recovery: 'shorten-input' })
  })

  it.each<ReadApiFailure['type']>(['invalid-provider-response', 'timeout'])(
    'rewrites a Resume Section once when its writing fails with %s', async (type) => {
      const system = createSystemUnderTest({ skillsWriting: { failure: { type }, on: 'first-write' } })
      await system.givenMatchedCandidateSession()

      await system.prepareTailoredResume()

      system.expectSkillsWritten(2)
      system.expectPrepared()
    })

  it.each<ReadApiFailure['type']>(['provider-unavailable', 'rate-limited', 'network', 'demo-access-required',
    'input-too-large', 'unexpected-response'])('never rewrites a Resume Section whose writing fails with %s', async (type) => {
    const system = createSystemUnderTest({ skillsWriting: { failure: { type }, on: 'first-write' } })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsWritten(1)
    system.expectPreparationFailed()
  })

  it('rewrites a Resume Section only once however often its writing times out', async () => {
    const system = createSystemUnderTest({ skillsWriting: { failure: { type: 'timeout' }, on: 'every-write' } })
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectSkillsWritten(2)
    system.expectPreparationFailure({ cause: { type: 'timeout' }, recovery: 'retry' })
  })

  it('explains a Source Intake failure with its Failure Cause and Recovery', async () => {
    const system = createSystemUnderTest({ sourceExtraction: { type: 'rate-limited', retryAfterSeconds: 45 } })
    await system.givenConsentedSessionWithoutInputs()

    await system.prepareFromNewDocuments()

    system.expectPreparationFailure({ detail: 'source-profile-extraction-unavailable',
      cause: { type: 'rate-limited', retryAfterSeconds: 45 }, recovery: 'retry-after' })
  })

  it('explains a Job Posting extraction failure with its Failure Cause and Recovery', async () => {
    const system = createSystemUnderTest({ postingExtraction: { type: 'input-too-large' } })
    await system.givenConsentedSessionWithoutInputs()

    await system.prepareFromNewDocuments()

    system.expectPreparationFailure({ detail: 'job-posting-extraction-unavailable', cause: { type: 'input-too-large' },
      recovery: 'shorten-input' })
  })

  it('explains a Match Evidence failure with its Failure Cause and Recovery', async () => {
    const system = createSystemUnderTest({ matching: { type: 'demo-access-required' } })
    await system.givenConsentedSessionWithoutInputs()

    await system.prepareFromNewDocuments()

    system.expectPreparationFailure({ detail: 'match-evidence-unavailable', cause: { type: 'access-required' },
      recovery: 'renew-access' })
  })

  it('treats a failure that names no API Failure as unexpected', async () => {
    const system = createSystemUnderTest({ sourceExtraction: null })
    await system.givenConsentedSessionWithoutInputs()

    await system.prepareFromNewDocuments()

    system.expectPreparationFailure({ detail: 'source-profile-extraction-unavailable', cause: { type: 'unexpected' },
      recovery: 'reload' })
  })

  it('forgets the Failure Cause once a retried preparation succeeds', async () => {
    const system = createSystemUnderTest({ skillsWriting: { failure: { type: 'network' }, on: 'first-write' } })
    await system.givenMatchedCandidateSession()
    await system.prepareTailoredResume()

    await system.prepareTailoredResume()

    system.expectPrepared()
  })
})

function createSystemUnderTest(options: TestOptions = {}) {
  return new FailureCauseTestSystem(options)
}

type TestOptions = Readonly<{
  skillsWriting?: Readonly<{ failure: ResumeSectionModelError; on: 'first-write' | 'every-write' }>
  /** Fails the first write of the Languages section. */
  languagesWriting?: ResumeSectionModelError
  /** `null` fails the extraction without an API Failure. */
  sourceExtraction?: ReadApiFailure | null
  postingExtraction?: ReadApiFailure
  matching?: ReadApiFailure
}>

class FailureCauseTestSystem {
  readonly #options: TestOptions
  readonly #journey: CandidateJourney
  #skillsWrites = 0
  #outcome: CandidateJourneyView | null = null

  constructor(options: TestOptions) {
    this.#options = options
    this.#journey = createCandidateJourney({ dependencies: this.#createDependencies() })
  }

  async givenMatchedCandidateSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async givenConsentedSessionWithoutInputs() {
    await this.givenMatchedCandidateSession()
  }

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation()
    await this.#preparationFinished()
  }

  async prepareFromNewDocuments() {
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText('Professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#preparationFinished()
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
    if (this.#outcome?.status !== 'candidate-session-open') return expect.fail('Prepare a resume before reading the outcome')
    return this.#outcome
  }

  expectPreparationFailure({ cause, recovery, detail }: Readonly<{ cause: FailureCause; recovery: Recovery; detail?: string }>) {
    const view = this.#expectOutcome()
    expect(view.preparationOutcome).toMatchObject({ status: 'failed', reason: 'unavailable', cause, recovery,
      ...(detail === undefined ? {} : { detail }) })
    // The cause survives a reload: the Candidate Session keeps it with the failed preparation.
    expect(view.session.preparation).toMatchObject({ status: 'failed', failureCause: cause })
  }

  expectPreparationFailed() {
    expect(this.#expectOutcome().preparationOutcome).toMatchObject({ status: 'failed' })
  }

  expectPrepared() {
    const view = this.#expectOutcome()
    expect(view.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(view.session.preparation?.failureCause).toBeUndefined()
  }

  expectSkillsWritten(count: number) {
    expect(this.#skillsWrites).toBe(count)
  }

  #createDependencies() {
    const options = this.#options
    const startedAt = Date.now()
    const matched = options.sourceExtraction === undefined && options.postingExtraction === undefined && options.matching === undefined
    const session: CandidateSession = { expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
      sessionId: 'candidate-session-00000000-0000-4000-8000-000000000114', version: candidateSessionStorageVersion,
      phase: matched ? 'job-match' : 'source-intake',
      processingConsent: { grantedAt: startedAt, policy: testProcessingPolicy },
      sourceIntake: matched ? structuredResumeSource : null, jobMatch: matched ? structuredResumeJobMatch : null, tailoredResume: null }
    const sourceProfileExtractor = createFakeSourceProfileExtractor()
    const jobPostingExtractor = createFakeJobPostingExtractor()
    const matchEvidenceMatcher = createFakeMatchEvidenceMatcher()
    return createFakeCandidateJourneyDependencies({
      now: () => startedAt,
      persistence: createInMemoryCandidateSessionPersistence({ session }),
      sourceProfileExtractor: { extract: (request) => options.sourceExtraction === undefined ? sourceProfileExtractor.extract(request)
        : Promise.resolve({ ok: false, error: 'source-profile-extraction-unavailable',
          ...(options.sourceExtraction === null ? {} : { apiFailure: options.sourceExtraction }) }) },
      jobPostingExtractor: { extract: (request) => options.postingExtraction === undefined ? jobPostingExtractor.extract(request)
        : Promise.resolve({ ok: false, error: 'job-posting-extraction-unavailable', apiFailure: options.postingExtraction }) },
      matchEvidenceMatcher: { match: (request) => options.matching === undefined ? matchEvidenceMatcher.match(request)
        : Promise.resolve({ ok: false, error: 'match-evidence-unavailable', apiFailure: options.matching }) },
      resumeSectionModels: createFakeResumeSectionModels({
        writeSection: (input) => {
          if (input.section.kind === 'skills' && options.skillsWriting !== undefined) {
            this.#skillsWrites += 1
            const { failure, on } = options.skillsWriting
            if (on === 'every-write' || this.#skillsWrites === 1) return Promise.resolve({ ok: false, error: failure })
          }
          if (input.section.kind === 'languages' && options.languagesWriting !== undefined) {
            return Promise.resolve({ ok: false, error: options.languagesWriting })
          }
          return Promise.resolve({ ok: true, value: readGroupedResumeSection(input.section) })
        },
      }),
    })
  }
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
