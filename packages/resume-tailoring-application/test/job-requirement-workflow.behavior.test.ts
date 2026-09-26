import { describe, expect, it } from 'vitest'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import {
  createResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import type {
  JobPostingReview,
  JobRequirementExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

const sessionStartedAt = Date.UTC(2026, 8, 26, 12)
const sessionExpiresAt = Date.UTC(2026, 8, 27, 12)
const sessionIdentifier = 'candidate-session-00000000-0000-4000-8000-000000000009' as const
const compoundSourceExcerpt = 'You must know TypeScript and preferably React.'
const legitimateFrenchJobPosting = "ASTORM bénéficie d'un référencement auprès de clients."

describe('Job Requirement workflow', () => {
  it('lets the Candidate paste a Job Posting for exact review', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenAJobPosting()

    // Action
    await system.reviewJobPosting()

    // Then
    system.expectExactJobPostingContentToBeReviewable()
  })

  it('removes sensitive contact content locally before Job Posting processing', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenAJobPostingWithSensitiveContactContent()

    // Action
    await system.reviewSensitiveJobPosting()

    // Then
    system.expectSensitiveJobPostingContentToBeRemovedLocally()
  })

  it('preserves French words that only contain a sensitive keyword', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenAJobPostingWithALegitimateFrenchWord()

    // Action
    await system.reviewFrenchJobPosting()

    // Then
    system.expectLegitimateFrenchWordToRemain()
  })

  it('lets the Candidate minimize the Job Posting before processing', async () => {
    const system = createSystemUnderTest({ jobPosting: reviewingJobPosting })

    // Given
    system.givenTheJobPostingContainsAnUnwantedLine()

    // Action
    await system.minimizeJobPosting()

    // Then
    system.expectOnlyMinimizedJobPostingContentToRemain()
  })

  it('invalidates prior consent when transmitted Job Posting content changes', async () => {
    const system = createSystemUnderTest({ jobPosting: confirmedJobPosting })

    // Given
    system.givenTheCandidatePreviouslyConfirmedProcessing()

    // Action
    await system.removeJobPostingPreference()

    // Then
    system.expectJobPostingProcessingConsentToBePending()
  })

  it.each(changedProcessingNotices)(
    'rejects prior consent after a material $changedField change',
    async ({ jobPosting }) => {
      const system = createSystemUnderTest({ jobPosting })

      // Given
      system.givenTheProcessingTermsChanged()

      // Action
      await system.extractJobRequirements()

      // Then
      system.expectFreshJobPostingProcessingConsentToBeRequired()
    },
  )

  it('extracts classified atomic Job Requirements with source provenance', async () => {
    const system = createSystemUnderTest({ jobPosting: confirmedJobPosting })

    // Given
    system.givenTheStructuredModelDecomposesACompoundPassage()

    // Action
    await system.extractJobRequirements()

    // Then
    system.expectAtomicRequirementsToShareTheirSourceGroup()
  })

  it('returns to Job Posting review when extracted content changes', async () => {
    const system = createSystemUnderTest({ jobPosting: extractedJobPosting })

    // Action
    await system.updateJobPostingContent({ outgoingContent: compoundSourceExcerpt })

    // Then
    system.expectChangedExtractedJobPostingToRequireFreshReview()
  })

  it('preserves extracted requirements when Job Posting content is unchanged', async () => {
    const system = createSystemUnderTest({ jobPosting: extractedJobPosting })

    // Action
    await system.updateJobPostingContent({ outgoingContent: extractedJobPosting.outgoingContent })

    // Then
    system.expectExtractedJobPostingToRemainUnchanged()
  })

  it('rejects extraction output beyond the supported requirement count', async () => {
    const system = createSystemUnderTest({ jobPosting: confirmedJobPosting })

    // Given
    system.givenTheStructuredModelReturnsTooManyRequirements()

    // Action
    await system.extractJobRequirements()

    // Then
    await system.expectExcessiveRequirementsToBeRejected()
  })

  it.each([
    'job-requirement-extraction-unavailable',
    'job-requirement-transport-unavailable',
  ] as const)('preserves browser-session input after a typed %s failure', async (failureType) => {
    const system = createSystemUnderTest({ jobPosting: confirmedJobPosting })

    // Given
    system.givenJobRequirementExtractionFailsWith({ failureType })

    // Action
    await system.extractJobRequirements()

    // Then
    await system.expectRecoverableFailureWithoutLosingJobPosting({ failureType })
  })
})

function createSystemUnderTest({
  jobPosting,
}: Readonly<{ jobPosting?: JobPostingReview }> = {}) {
  return new JobRequirementWorkflowTestSystem(jobPosting)
}

class JobRequirementWorkflowTestSystem {
  readonly #modelRequests: string[] = []
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #extractionResult: Awaited<ReturnType<JobRequirementExtractor['extract']>> = {
    ok: true,
    value: [],
  }

  constructor(jobPosting: JobPostingReview | undefined) {
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: sessionStartedAt }),
      candidateSessionIdentity: { create: () => ({ ok: true, value: sessionIdentifier }) },
      candidateSessionPersistence: createJobPostingTestPersistence({ jobPosting }),
      jobRequirementExtractor: { extract: ({ jobPostingContent }) => {
        this.#modelRequests.push(jobPostingContent)
        return Promise.resolve(this.#extractionResult)
      } },
      jobRequirementGroupIdentity: createSequentialGroupIdentity(),
      jobRequirementIdentity: createSequentialRequirementIdentity(),
      telemetry: createTelemetrySpy(),
    })
  }

  givenAJobPosting() {}

  givenAJobPostingWithSensitiveContactContent() {}

  givenAJobPostingWithALegitimateFrenchWord() {}

  givenTheJobPostingContainsAnUnwantedLine() {}

  givenTheCandidatePreviouslyConfirmedProcessing() {}

  givenTheProcessingTermsChanged() {}

  givenTheStructuredModelDecomposesACompoundPassage() {
    this.#extractionResult = {
      ok: true,
      value: [
        {
          classification: 'required',
          sourceExcerpt: compoundSourceExcerpt,
          value: 'Know TypeScript',
        },
        {
          classification: 'preferred',
          sourceExcerpt: compoundSourceExcerpt,
          value: 'Know React',
        },
      ],
    }
  }

  givenTheStructuredModelReturnsTooManyRequirements() {
    this.#extractionResult = {
      ok: true,
      value: Array.from({ length: 201 }, (_unusedValue, requirementIndex) => ({
        classification: 'required',
        sourceExcerpt: compoundSourceExcerpt,
        value: `Know technology ${String(requirementIndex)}`,
      })),
    }
  }

  givenJobRequirementExtractionFailsWith({ failureType }: Readonly<{
    failureType: 'job-requirement-extraction-unavailable' | 'job-requirement-transport-unavailable'
  }>) {
    this.#extractionResult = { ok: false, error: { type: failureType } }
  }

  async reviewJobPosting() {
    this.#actionResult = await this.#workflow.execute({
      type: 'review-job-posting',
      content: `${compoundSourceExcerpt}\nSalary: competitive`,
    })
  }

  async reviewSensitiveJobPosting() {
    this.#actionResult = await this.#workflow.execute({
      type: 'review-job-posting',
      content: `${compoundSourceExcerpt}\nContact jobs@example.com`,
    })
  }

  async reviewFrenchJobPosting() {
    this.#actionResult = await this.#workflow.execute({
      type: 'review-job-posting',
      content: legitimateFrenchJobPosting,
    })
  }

  async minimizeJobPosting() {
    await this.updateJobPostingContent({ outgoingContent: compoundSourceExcerpt })
  }

  async removeJobPostingPreference() {
    await this.updateJobPostingContent({ outgoingContent: 'You must know TypeScript.' })
  }

  async updateJobPostingContent({ outgoingContent }: Readonly<{ outgoingContent: string }>) {
    this.#actionResult = await this.#workflow.execute({
      type: 'update-job-posting-content',
      outgoingContent,
    })
  }

  async extractJobRequirements() {
    this.#actionResult = await this.#workflow.execute({ type: 'extract-job-requirements' })
  }

  expectExactJobPostingContentToBeReviewable() {
    expect(this.#readJobPosting().outgoingContent).toBe(
      `${compoundSourceExcerpt}\nSalary: competitive`,
    )
    expect(this.#modelRequests).toEqual([])
  }

  expectSensitiveJobPostingContentToBeRemovedLocally() {
    expect(this.#readJobPosting()).toMatchObject({
      detectedSensitiveContent: [{ kind: 'email', value: 'jobs@example.com' }],
      outgoingContent: `${compoundSourceExcerpt}\nContact `,
    })
    expect(this.#modelRequests).toEqual([])
  }

  expectLegitimateFrenchWordToRemain() {
    expect(this.#readJobPosting()).toMatchObject({
      detectedSensitiveContent: [],
      outgoingContent: legitimateFrenchJobPosting,
    })
  }

  expectOnlyMinimizedJobPostingContentToRemain() {
    expect(this.#readJobPosting().outgoingContent).toBe(compoundSourceExcerpt)
    expect(this.#modelRequests).toEqual([])
  }

  expectJobPostingProcessingConsentToBePending() {
    expect(this.#readJobPosting().processingNotice).toBeNull()
  }

  expectFreshJobPostingProcessingConsentToBeRequired() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'processing-notice-required' },
    })
    expect(this.#modelRequests).toEqual([])
  }

  expectAtomicRequirementsToShareTheirSourceGroup() {
    expect(this.#readJobPosting()).toMatchObject({
      status: 'reviewing-requirements',
      requirements: [
        {
          id: 'job-requirement-1',
          groupId: 'job-requirement-group-1',
          classification: 'required',
          sourceExcerpt: compoundSourceExcerpt,
          value: 'Know TypeScript',
        },
        {
          id: 'job-requirement-2',
          groupId: 'job-requirement-group-1',
          classification: 'preferred',
          sourceExcerpt: compoundSourceExcerpt,
          value: 'Know React',
        },
      ],
    })
    expect(this.#modelRequests).toEqual([compoundSourceExcerpt])
  }

  expectChangedExtractedJobPostingToRequireFreshReview() {
    expect(this.#readJobPosting()).toMatchObject({
      status: 'reviewing-posting',
      outgoingContent: compoundSourceExcerpt,
      processingNotice: null,
      requirements: [],
    })
  }

  expectExtractedJobPostingToRemainUnchanged() {
    expect(this.#readJobPosting()).toEqual(extractedJobPosting)
  }

  async expectRecoverableFailureWithoutLosingJobPosting({ failureType }: Readonly<{
    failureType: 'job-requirement-extraction-unavailable' | 'job-requirement-transport-unavailable'
  }>) {
    expect(this.#readActionResult()).toEqual({ ok: false, error: { type: failureType } })
    expect(await this.#readPersistedJobPosting()).toEqual(confirmedJobPosting)
  }

  async expectExcessiveRequirementsToBeRejected() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'job-requirement-extraction-unavailable' },
    })
    expect(await this.#readPersistedJobPosting()).toEqual(confirmedJobPosting)
  }

  #readJobPosting() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return reviewingJobPosting
    expect(result.value.jobPosting).toBeDefined()
    return result.value.jobPosting ?? reviewingJobPosting
  }

  #readPersistedJobPosting() {
    return this.#readJobPostingFromResult(this.#workflow.readView())
  }

  async #readJobPostingFromResult(resultPromise: ReturnType<ResumeTailoringWorkflow['readView']>) {
    const result = await resultPromise
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return undefined
    return result.value.jobPosting
  }

  #readActionResult() {
    expect(this.#actionResult).toBeDefined()
    return this.#actionResult ?? { ok: false, error: { type: 'candidate-session-unavailable' } }
  }
}

function createJobPostingTestPersistence({ jobPosting }: Readonly<{
  jobPosting: JobPostingReview | undefined
}>) {
  return createInMemoryCandidateSessionPersistence({
    initialState: {
      status: 'ready',
      sessionId: sessionIdentifier,
      expiresAt: sessionExpiresAt,
      ...(jobPosting === undefined ? {} : { jobPosting }),
    },
  })
}

function createSequentialRequirementIdentity() {
  let nextIdentifier = 1
  return { create: () => ({
    ok: true as const,
    value: `job-requirement-${String(nextIdentifier++)}` as const,
  }) } as const
}

function createSequentialGroupIdentity() {
  let nextIdentifier = 1
  return { create: () => ({
    ok: true as const,
    value: `job-requirement-group-${String(nextIdentifier++)}` as const,
  }) } as const
}

const reviewingJobPosting = {
  status: 'reviewing-posting',
  detectedSensitiveContent: [],
  outgoingContent: `${compoundSourceExcerpt}\nSalary: competitive`,
  processingNotice: null,
  requirements: [],
} as const satisfies JobPostingReview

const confirmedJobPosting = {
  ...reviewingJobPosting,
  outgoingContent: compoundSourceExcerpt,
  processingNotice: {
    version: '2026-09-26',
    confirmedAt: sessionStartedAt,
    provider: 'OpenAI',
    retentionPolicy: 'standard-abuse-monitoring',
    transmittedDataCategories: ['job-posting-content'],
  },
} as const satisfies JobPostingReview

const extractedJobPosting = {
  ...confirmedJobPosting,
  status: 'reviewing-requirements',
  outgoingContent: `${compoundSourceExcerpt}\nSalary: competitive`,
  requirements: [{
    id: 'job-requirement-1',
    groupId: 'job-requirement-group-1',
    classification: 'required',
    sourceExcerpt: compoundSourceExcerpt,
    value: 'Know TypeScript',
  }],
} as const satisfies JobPostingReview

const changedProcessingNotices = [
  {
    changedField: 'provider',
    jobPosting: {
      ...confirmedJobPosting,
      processingNotice: { ...confirmedJobPosting.processingNotice, provider: 'Different provider' },
    },
  },
  {
    changedField: 'retention policy',
    jobPosting: {
      ...confirmedJobPosting,
      processingNotice: { ...confirmedJobPosting.processingNotice, retentionPolicy: 'extended' },
    },
  },
  {
    changedField: 'transmitted data categories',
    jobPosting: {
      ...confirmedJobPosting,
      processingNotice: {
        ...confirmedJobPosting.processingNotice,
        transmittedDataCategories: ['job-posting-content', 'source-profile'],
      },
    },
  },
] as const satisfies readonly Readonly<{
  changedField: string
  jobPosting: JobPostingReview
}>[]
