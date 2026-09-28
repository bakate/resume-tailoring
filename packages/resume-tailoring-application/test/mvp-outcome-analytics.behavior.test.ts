import { describe, expect, it } from 'vitest'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import type {
  MatchScore,
  OutcomeFeedback,
  ResumeTailoringState,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

describe('MVP outcome analytics', () => {
  it('records usefulness with a Match Score band and no Candidate content', async () => {
    const system = createSystemUnderTest({
      currentJobPostingStatus: 'pdf-downloaded', matchScore: 62,
    })

    // Given
    system.givenTheCandidateConsidersTheDownloadedResumeUseful()

    // Action
    await system.rateTailoredResumeUsefulness()

    // Then
    system.expectOnlyPrivacySafeUsefulnessToBeRecorded()
  })

  it('does not accept Outcome Feedback before a Successful Download', async () => {
    const system = createSystemUnderTest({ matchScore: 62 })

    // Given
    system.givenTheTailoredResumeHasNotBeenDownloaded()

    // Action
    await system.rateTailoredResumeUsefulness()

    // Then
    system.expectUsefulnessToRemainUnavailable()
  })

  it('records correction activity without the corrected Candidate content', async () => {
    const system = createSystemUnderTest({ matchScore: 62 })

    // Given
    system.givenASourceProfileFactNeedsCorrection()

    // Action
    await system.correctSourceProfileFact()

    // Then
    system.expectOnlyPrivacySafeCorrectionActivityToBeRecorded()
  })

  it('records a Successful Download and globally approves the current draft', async () => {
    const system = createSystemUnderTest({ matchScore: 75 })

    // Given
    system.givenAValidatedTailoredResumeWasDownloaded()

    // Action
    await system.recordTailoredResumeDownload()

    // Then
    system.expectDownloadToApproveTheCurrentDraft()
  })

  it('does not count usefulness twice in one Candidate Session', async () => {
    const system = createSystemUnderTest({
      currentJobPostingStatus: 'pdf-downloaded',
      matchScore: 62,
      outcomeFeedback: { useful: true },
    })

    // Given
    system.givenUsefulnessWasAlreadyRecorded()

    // Action
    await system.rateTailoredResumeUsefulness()

    // Then
    system.expectNoDuplicateUsefulnessToBeRecorded()
  })

  it('archives a minimal summary before reusing the Source Profile for another Job Posting', async () => {
    const system = createSystemUnderTest({
      currentJobPostingStatus: 'pdf-downloaded', matchScore: 75,
      outcomeFeedback: { useful: true },
    })

    // Action
    await system.startNewJobPosting()

    // Then
    system.expectDownloadedAnalysisToBeArchived()
  })
})

function createSystemUnderTest({ currentJobPostingStatus, matchScore, outcomeFeedback }: Readonly<{
  currentJobPostingStatus?: 'pdf-downloaded'
  matchScore: number
  outcomeFeedback?: OutcomeFeedback
}>) {
  return new MvpOutcomeAnalyticsTestSystem({ currentJobPostingStatus, matchScore, outcomeFeedback })
}

class MvpOutcomeAnalyticsTestSystem {
  readonly #telemetry = createTelemetrySpy()
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined

  constructor({ currentJobPostingStatus, matchScore, outcomeFeedback }: Readonly<{
    currentJobPostingStatus?: 'pdf-downloaded'
    matchScore: number
    outcomeFeedback?: OutcomeFeedback
  }>) {
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: 1_000 }),
      candidateSessionIdentity: {
        create: () => ({ ok: true, value: 'candidate-session-analytics' }),
      },
      candidateSessionPersistence: createInMemoryCandidateSessionPersistence({
        initialState: createReadyState({ currentJobPostingStatus, matchScore, outcomeFeedback }),
      }),
      sourceProfileFactIdentity: {
        create: () => ({ ok: true, value: 'source-fact-corrected' }),
      },
      telemetry: this.#telemetry,
    })
  }

  givenTheCandidateConsidersTheDownloadedResumeUseful() {}

  givenTheTailoredResumeHasNotBeenDownloaded() {}

  givenASourceProfileFactNeedsCorrection() {}

  givenAValidatedTailoredResumeWasDownloaded() {}

  givenUsefulnessWasAlreadyRecorded() {}

  async rateTailoredResumeUsefulness() {
    this.#actionResult = await this.#workflow.execute({
      type: 'rate-tailored-resume-usefulness',
      useful: true,
      comment: 'Private Candidate feedback',
    })
  }

  async correctSourceProfileFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'correct-source-fact',
      factId: 'source-fact-original',
      correctedValue: 'Private corrected Candidate content',
    })
  }

  async recordTailoredResumeDownload() {
    this.#actionResult = await this.#workflow.execute({
      type: 'record-tailored-resume-download',
    })
  }

  async startNewJobPosting() {
    this.#actionResult = await this.#workflow.execute({ type: 'start-new-job-posting' })
  }

  expectOnlyPrivacySafeUsefulnessToBeRecorded() {
    expect(this.#readActionResult()).toMatchObject({
      ok: true,
      value: { outcomeFeedback: { comment: 'Private Candidate feedback', useful: true } },
    })
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-usefulness-rated',
      hasComment: true,
      matchScoreBand: '50-74',
      useful: true,
    }])
  }

  expectUsefulnessToRemainUnavailable() {
    expect(this.#readActionResult().ok).toBe(false)
    expect(this.#telemetry.recordedEvents()).toEqual([])
  }

  expectOnlyPrivacySafeCorrectionActivityToBeRecorded() {
    expect(this.#readActionResult().ok).toBe(true)
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-correction-recorded',
      correctionKind: 'source-profile-fact',
      matchScoreBand: '50-74',
    }])
  }

  expectDownloadToApproveTheCurrentDraft() {
    expect(this.#readActionResult()).toMatchObject({
      ok: true,
      value: { currentJobPostingStatus: 'pdf-downloaded' },
    })
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-downloaded',
      matchScoreBand: '75-100',
    }])
  }

  expectNoDuplicateUsefulnessToBeRecorded() {
    expect(this.#readActionResult()).toMatchObject({
      ok: true,
      value: { outcomeFeedback: { useful: true } },
    })
    expect(this.#telemetry.recordedEvents()).toEqual([])
  }

  expectDownloadedAnalysisToBeArchived() {
    const result = this.#readActionResult()
    expect(result).toMatchObject({
      ok: true,
      value: {
        jobPostingHistory: [{
          id: 'job-posting-1',
          matchScore: 75,
          status: 'pdf-downloaded',
          targetRole: 'Senior TypeScript Developer',
        }],
        sourceProfile: { status: 'reviewing-facts' },
      },
    })
    if (!result.ok) return
    expect(result.value).toMatchObject({
      jobPosting: undefined,
      matchAnalysis: undefined,
      outcomeFeedback: { useful: true },
      tailoredResume: undefined,
    })
  }

  #readActionResult() {
    if (this.#actionResult === undefined) {
      throw new Error('Execute an MVP outcome action before reading its outcome')
    }
    return this.#actionResult
  }
}

function createReadyState({ currentJobPostingStatus, matchScore, outcomeFeedback }: Readonly<{
  currentJobPostingStatus?: 'pdf-downloaded'
  matchScore: number
  outcomeFeedback?: OutcomeFeedback
}>): ResumeTailoringState {
  return {
    status: 'ready',
    sessionId: 'candidate-session-analytics',
    expiresAt: 100_000,
    ...(currentJobPostingStatus === undefined ? {} : { currentJobPostingStatus }),
    ...(outcomeFeedback === undefined ? {} : { outcomeFeedback }),
    sourceProfile: {
      status: 'reviewing-facts',
      documentName: 'private-resume.pdf',
      detectedSensitiveContent: [],
      outgoingContent: 'Private Candidate content',
      processingNotice: { version: '2026-09-28', confirmedAt: 1 },
      facts: [{
        id: 'source-fact-original',
        kind: 'experience',
        propositionKey: 'proposition-original',
        status: 'verified',
        value: 'Private original Candidate content',
      }],
    },
    jobPosting: {
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'Senior TypeScript Developer',
      processingNotice: null,
      practicalConstraints: [],
      requirements: [],
      targetRole: {
        sourceExcerpt: 'Senior TypeScript Developer',
        value: 'Senior TypeScript Developer',
      },
    },
    matchAnalysis: {
      evidence: [],
      gapAnalysis: {
        partiallyCoveredRequiredRequirementIds: [],
        uncoveredRequiredRequirementIds: [],
      },
      generationEligibility: 'eligible',
      improvementOpportunities: [],
      matchScore: matchScore as MatchScore,
      relevantFactIds: [],
      warning: null,
    },
    tailoredResume: { claims: [], exclusions: [], locale: 'en' },
  }
}
