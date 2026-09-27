import { describe, expect, it } from 'vitest'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import type { MatchScore, ResumeTailoringState } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { OutcomeFeedback } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

describe('MVP outcome analytics', () => {
  it('records perceived fidelity with a Match Score band and no Candidate content', async () => {
    const system = createSystemUnderTest({ matchScore: 62 })

    // Given
    system.givenTheCandidateConsidersTheResumeFaithful()

    // Action
    await system.rateTailoredResumeFidelity()

    // Then
    system.expectOnlyPrivacySafeFidelityToBeRecorded()
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

  it('records perceived relevance separately from fidelity', async () => {
    const system = createSystemUnderTest({ matchScore: 49 })

    // Given
    system.givenTheCandidateConsidersTheResumeRelevant()

    // Action
    await system.rateTailoredResumeRelevance()

    // Then
    system.expectOnlyPrivacySafeRelevanceToBeRecorded()
  })

  it('records a successful download after validated export', async () => {
    const system = createSystemUnderTest({ matchScore: 75 })

    // Given
    system.givenAValidatedTailoredResumeWasDownloaded()

    // Action
    await system.recordTailoredResumeDownload()

    // Then
    system.expectOnlyPrivacySafeDownloadToBeRecorded()
  })

  it('does not count a fidelity assessment twice in one Candidate session', async () => {
    const system = createSystemUnderTest({
      matchScore: 62,
      outcomeFeedback: { fidelity: 'faithful' },
    })

    // Given
    system.givenFidelityWasAlreadyRecorded()

    // Action
    await system.rateTailoredResumeFidelity()

    // Then
    system.expectNoDuplicateFidelityToBeRecorded()
  })
})

function createSystemUnderTest({ matchScore, outcomeFeedback }: Readonly<{
  matchScore: number
  outcomeFeedback?: OutcomeFeedback
}>) {
  return new MvpOutcomeAnalyticsTestSystem({ matchScore, outcomeFeedback })
}

class MvpOutcomeAnalyticsTestSystem {
  readonly #telemetry = createTelemetrySpy()
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined

  constructor({ matchScore, outcomeFeedback }: Readonly<{
    matchScore: number
    outcomeFeedback?: OutcomeFeedback
  }>) {
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: 1_000 }),
      candidateSessionIdentity: {
        create: () => ({ ok: true, value: 'candidate-session-analytics' }),
      },
      candidateSessionPersistence: createInMemoryCandidateSessionPersistence({
        initialState: createReadyState({ matchScore, outcomeFeedback }),
      }),
      sourceProfileFactIdentity: {
        create: () => ({ ok: true, value: 'source-fact-corrected' }),
      },
      telemetry: this.#telemetry,
    })
  }

  givenTheCandidateConsidersTheResumeFaithful() {}

  givenASourceProfileFactNeedsCorrection() {}

  givenTheCandidateConsidersTheResumeRelevant() {}

  givenAValidatedTailoredResumeWasDownloaded() {}

  givenFidelityWasAlreadyRecorded() {}

  async rateTailoredResumeFidelity() {
    this.#actionResult = await this.#workflow.execute({
      type: 'rate-tailored-resume-fidelity',
      assessment: 'faithful',
    })
  }

  async correctSourceProfileFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'correct-source-fact',
      factId: 'source-fact-original',
      correctedValue: 'Private corrected Candidate content',
    })
  }

  async rateTailoredResumeRelevance() {
    this.#actionResult = await this.#workflow.execute({
      type: 'rate-tailored-resume-relevance',
      assessment: 'relevant',
    })
  }

  async recordTailoredResumeDownload() {
    this.#actionResult = await this.#workflow.execute({
      type: 'record-tailored-resume-download',
    })
  }

  expectOnlyPrivacySafeFidelityToBeRecorded() {
    expect(this.#readActionResult().ok).toBe(true)
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-fidelity-rated',
      assessment: 'faithful',
      matchScoreBand: '50-74',
    }])
  }

  expectOnlyPrivacySafeCorrectionActivityToBeRecorded() {
    expect(this.#readActionResult().ok).toBe(true)
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-correction-recorded',
      correctionKind: 'source-profile-fact',
      matchScoreBand: '50-74',
    }])
  }

  expectOnlyPrivacySafeRelevanceToBeRecorded() {
    expect(this.#readActionResult().ok).toBe(true)
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-relevance-rated',
      assessment: 'relevant',
      matchScoreBand: '25-49',
    }])
  }

  expectOnlyPrivacySafeDownloadToBeRecorded() {
    expect(this.#readActionResult().ok).toBe(true)
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-downloaded',
      matchScoreBand: '75-100',
    }])
  }

  expectNoDuplicateFidelityToBeRecorded() {
    expect(this.#readActionResult()).toMatchObject({
      ok: true,
      value: { outcomeFeedback: { fidelity: 'faithful' } },
    })
    expect(this.#telemetry.recordedEvents()).toEqual([])
  }

  #readActionResult() {
    if (this.#actionResult === undefined) {
      throw new Error('Rate Tailored Resume fidelity before reading its outcome')
    }
    return this.#actionResult
  }
}

function createReadyState({ matchScore, outcomeFeedback }: Readonly<{
  matchScore: number
  outcomeFeedback?: OutcomeFeedback
}>): ResumeTailoringState {
  return {
    status: 'ready',
    sessionId: 'candidate-session-analytics',
    expiresAt: 100_000,
    ...(outcomeFeedback === undefined ? {} : { outcomeFeedback }),
    sourceProfile: {
      status: 'reviewing-facts',
      documentName: 'private-resume.pdf',
      detectedSensitiveContent: [],
      outgoingContent: 'Private Candidate content',
      processingNotice: null,
      facts: [{
        id: 'source-fact-original',
        kind: 'experience',
        propositionKey: 'proposition-original',
        status: 'verified',
        value: 'Private original Candidate content',
      }],
    },
    matchAnalysis: {
      evidence: [],
      gapAnalysis: { uncoveredRequiredRequirementIds: [] },
      generationEligibility: 'eligible',
      matchScore: matchScore as MatchScore,
      relevantFactIds: [],
      warning: null,
    },
    tailoredResume: { claims: [], exclusions: [] },
  }
}
