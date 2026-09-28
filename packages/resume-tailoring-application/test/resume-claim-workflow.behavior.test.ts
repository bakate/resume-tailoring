import { assert, describe, expect, it } from 'vitest'

import type {
  ProposedResumeClaim,
  ResumeClaim,
  ResumeClaimSemanticValidator,
  ResumeClaimWritingInputs,
  ResumeClaimWriter,
  ResumeTailoringState,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

describe('Resume Claim workflow', () => {
  it('generates claims whose semantic segments reference their exact Verified Facts', async () => {
    const system = createSystemUnderTest()

    await system.generateTailoredResume()

    system.expectAProvenanceBackedClaim()
  })

  it('writes Resume Claims in the Candidate-selected language', async () => {
    const system = createSystemUnderTest()

    await system.generateFrenchTailoredResume()

    system.expectFrenchWritingInput()
  })

  it('selects only Candidate Facts connected to Match Evidence', async () => {
    const system = createSystemUnderTest()

    await system.generateTailoredResume()

    system.expectOnlyEvidenceBackedFactsInWritingInput()
  })

  it('regenerates a deterministically invalid claim once before semantic validation', async () => {
    const system = createSystemUnderTest()

    system.givenAClaimThatAddsACurrencyThenAValidReformulation()
    await system.generateTailoredResume()

    system.expectOnlyTheRegeneratedClaimToReachSemanticValidation()
  })

  it('accepts faithful French translations of dates and durations', async () => {
    const system = createSystemUnderTest()

    system.givenAFaithfulFrenchTranslation()
    await system.generateTailoredResume()

    system.expectTheTranslatedClaimToBeKept()
  })

  it('removes a claim that fails validation twice and informs the Candidate', async () => {
    const system = createSystemUnderTest()

    system.givenAClaimThatRemainsSemanticallyUnsupported()
    await system.generateTailoredResume()

    system.expectTheUnsupportedClaimToBeExcluded()
  })

  it('moves a claim without requiring the Candidate interface to rebuild the order', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    await system.moveResumeClaimUp()

    system.expectClaimsToBeReorderedWithoutEditing()
    system.expectClaimReorderActivityToBeRecorded()
  })

  it('removes a claim selected by the Candidate', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    await system.removeResumeClaim()

    system.expectOnlyTheSelectedClaimToBeRemoved()
    system.expectClaimRemovalActivityToBeRecorded()
  })

  it('reformulates one claim through the writing and validation workflow', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    system.givenAConciseSupportedReformulation()
    await system.requestResumeClaimReformulation()

    system.expectOnlyTheRequestedClaimToBeReformulated()
    system.expectClaimReformulationActivityToBeRecorded()
  })

  it('preserves the existing Resume Claim when its reformulation is rejected', async () => {
    const system = createSystemUnderTest({ tailoredResume: tailoredResumeWithExistingExclusion })

    system.givenAReformulationThatRemainsUnsupported()
    await system.requestResumeClaimReformulation()

    await system.expectReformulationToBeRejectedWithoutChangingTheResume()
  })

  it('accepts a free edit supported by existing Candidate Facts', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    await system.editResumeClaim()

    system.expectSupportedEditToBePersisted()
  })

  it('requests explicit Candidate Fact confirmation for an unsupported free edit', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    system.givenAnUnsupportedFreeEdit()
    await system.editResumeClaim()

    system.expectNewFactConfirmationToBeRequired()
  })

  it('turns an explicitly confirmed new Resume Claim into a Candidate Fact', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    await system.confirmNewResumeClaimFact()

    system.expectConfirmedEditToCreateCandidateFact()
  })
})

function createSystemUnderTest({
  tailoredResume,
}: Readonly<{ tailoredResume?: ReadyState['tailoredResume'] }> = {}) {
  return new ResumeClaimWorkflowTestSystem({ tailoredResume })
}

type ReadyState = Extract<ResumeTailoringState, { readonly status: 'ready' }>

class ResumeClaimWorkflowTestSystem {
  readonly #semanticValidationRequests: ResumeClaim[] = []
  readonly #reformulationFactIds: string[][] = []
  readonly #writingInputs: ResumeClaimWritingInputs[] = []
  readonly #writer: ResumeClaimWriter
  readonly #workflow: ResumeTailoringWorkflow
  readonly #telemetry = createTelemetrySpy()
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #generatedClaims: readonly ProposedResumeClaim[] = [defaultProposedClaim]
  #reformulatedClaims: ProposedResumeClaim[] = []
  #semanticResults: boolean[] = [true]

  constructor({ tailoredResume }: Readonly<{ tailoredResume?: ReadyState['tailoredResume'] }>) {
    this.#writer = {
      write: (inputs) => {
        this.#writingInputs.push(inputs)
        return Promise.resolve({ ok: true, value: this.#generatedClaims })
      },
      reformulate: ({ verifiedFacts }) => {
        this.#reformulationFactIds.push(verifiedFacts.map(({ id }) => id))
        return Promise.resolve({
          ok: true,
          value: this.#reformulatedClaims.shift() ?? defaultProposedClaim,
        })
      },
    }
    const semanticValidator: ResumeClaimSemanticValidator = {
      validate: ({ claim }) => {
        this.#semanticValidationRequests.push(claim)
        return Promise.resolve({
          ok: true,
          value: {
            supported: this.#semanticResults.shift() ?? true,
            feedback: [{ code: 'strengthened-scope', segmentIndex: 0 }],
          },
        })
      },
    }
    let nextClaimNumber = 1
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: 1_000 }),
      candidateSessionIdentity: {
        create: () => ({ ok: true, value: 'candidate-session-resume-claims' }),
      },
      candidateSessionPersistence: createInMemoryCandidateSessionPersistence({
        initialState: createReadyState({ tailoredResume }),
      }),
      resumeClaimIdentity: {
        create: () => {
          const claimId = `resume-claim-${String(nextClaimNumber)}` as const
          nextClaimNumber += 1
          return { ok: true, value: claimId }
        },
      },
      resumeClaimSemanticValidator: semanticValidator,
      resumeClaimWriter: this.#writer,
      sourceProfileFactIdentity: {
        create: () => ({ ok: true, value: 'source-fact-candidate-edit' }),
      },
      telemetry: this.#telemetry,
    })
  }

  givenAClaimThatAddsACurrencyThenAValidReformulation() {
    this.#generatedClaims = [{
      segments: [{ factIds: ['source-fact-experience'], text: 'Built APIs for $2022' }],
    }]
    this.#reformulatedClaims = [{
      segments: [{
        factIds: ['source-fact-experience'],
        text: 'Built APIs at Acme from 2022 to 2024',
      }],
    }]
  }

  givenAClaimThatRemainsSemanticallyUnsupported() {
    this.#semanticResults = [false, false]
    this.#reformulatedClaims = [defaultProposedClaim]
  }

  givenAFaithfulFrenchTranslation() {
    this.#generatedClaims = [{
      segments: [{
        factIds: ['source-fact-experience'],
        text: 'Développement API depuis janvier 2022 pendant 2 ans',
      }],
    }]
  }

  givenAConciseSupportedReformulation() {
    this.#reformulatedClaims = [{
      segments: [{ factIds: ['source-fact-experience'], text: 'Built APIs at Acme' }],
    }]
  }

  givenAReformulationThatRemainsUnsupported() {
    this.#semanticResults = [false, false]
  }

  givenAnUnsupportedFreeEdit() {
    this.#semanticResults = [false]
  }

  async generateTailoredResume() {
    this.#actionResult = await this.#workflow.execute({
      type: 'generate-resume-claims',
      locale: 'en',
    })
  }

  async generateFrenchTailoredResume() {
    this.#actionResult = await this.#workflow.execute({
      type: 'generate-resume-claims',
      locale: 'fr',
    })
  }

  async editResumeClaim() {
    this.#actionResult = await this.#workflow.execute({
      type: 'edit-resume-claim',
      claimId: 'resume-claim-experience',
      text: 'Built APIs at Acme',
    })
  }

  async confirmNewResumeClaimFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'confirm-resume-claim-edit',
      claimId: 'resume-claim-experience',
      kind: 'experience',
      text: 'Led a platform migration',
    })
  }

  async moveResumeClaimUp() {
    this.#actionResult = await this.#workflow.execute({
      type: 'move-resume-claim',
      claimId: 'resume-claim-education',
      direction: 'up',
    })
  }

  async requestResumeClaimReformulation() {
    this.#actionResult = await this.#workflow.execute({
      type: 'reformulate-resume-claim',
      claimId: 'resume-claim-experience',
      request: 'Make this more concise',
    })
  }

  async removeResumeClaim() {
    this.#actionResult = await this.#workflow.execute({
      type: 'remove-resume-claim',
      claimId: 'resume-claim-experience',
    })
  }

  expectAProvenanceBackedClaim() {
    expect(this.#readTailoredResume().claims).toEqual([{
      id: 'resume-claim-1',
      segments: [
        { factIds: ['source-fact-experience'], text: 'Built APIs at Acme from 2022 to 2024' },
        { factIds: ['source-fact-typescript'], text: ' using TypeScript' },
      ],
    }])
  }

  expectFrenchWritingInput() {
    expect(this.#readTailoredResume().locale).toBe('fr')
    expect(this.#writingInputs).toHaveLength(1)
    expect(this.#writingInputs[0]?.locale).toBe('fr')
  }

  expectOnlyEvidenceBackedFactsInWritingInput() {
    expect(this.#writingInputs[0]?.verifiedFacts.map(({ id }) => id)).toEqual([
      'source-fact-experience',
      'source-fact-typescript',
    ])
  }

  expectSupportedEditToBePersisted() {
    expect(this.#readTailoredResume().claims[0]).toEqual({
      id: 'resume-claim-experience',
      segments: [{
        factIds: ['source-fact-experience'],
        text: 'Built APIs at Acme',
      }],
    })
  }

  expectNewFactConfirmationToBeRequired() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'resume-claim-new-fact-confirmation-required' },
    })
  }

  expectConfirmedEditToCreateCandidateFact() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return
    expect(result.value.sourceProfile?.facts).toContainEqual({
      authorship: 'candidate',
      id: 'source-fact-candidate-edit',
      kind: 'experience',
      propositionKey: 'proposition-experience-candidate-edit',
      status: 'verified',
      value: 'Led a platform migration',
    })
    expect(result.value.tailoredResume?.claims[0]).toEqual({
      id: 'resume-claim-experience',
      segments: [{
        factIds: ['source-fact-candidate-edit'],
        text: 'Led a platform migration',
      }],
    })
  }

  expectOnlyTheRegeneratedClaimToReachSemanticValidation() {
    expect(this.#reformulationFactIds).toEqual([['source-fact-experience']])
    expect(this.#semanticValidationRequests).toHaveLength(1)
    expect(this.#readTailoredResume().claims).toHaveLength(1)
  }

  expectTheTranslatedClaimToBeKept() {
    expect(this.#readTailoredResume().claims[0]?.segments[0]?.text)
      .toBe('Développement API depuis janvier 2022 pendant 2 ans')
  }

  expectTheUnsupportedClaimToBeExcluded() {
    const tailoredResume = this.#readTailoredResume()
    expect(tailoredResume.claims).toEqual([])
    expect(tailoredResume.exclusions).toEqual([{
      reason: 'unsupported-after-regeneration',
    }])
  }

  expectClaimsToBeReorderedWithoutEditing() {
    expect(this.#readTailoredResume().claims).toEqual([
      existingTailoredResume.claims[1],
      existingTailoredResume.claims[0],
    ])
  }

  expectOnlyTheRequestedClaimToBeReformulated() {
    expect(this.#reformulationFactIds).toEqual([[
      'source-fact-experience',
    ]])
    expect(this.#readTailoredResume().claims).toEqual([
      {
        id: 'resume-claim-experience',
        segments: [{
          factIds: ['source-fact-experience'],
          text: 'Built APIs at Acme',
        }],
      },
      existingTailoredResume.claims[1],
    ])
  }

  expectClaimRemovalActivityToBeRecorded() {
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-correction-recorded',
      correctionKind: 'resume-claim-removal',
      matchScoreBand: '75-100',
    }])
  }

  expectClaimReorderActivityToBeRecorded() {
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-correction-recorded',
      correctionKind: 'resume-claim-reorder',
      matchScoreBand: '75-100',
    }])
  }

  expectClaimReformulationActivityToBeRecorded() {
    expect(this.#telemetry.recordedEvents()).toEqual([{
      name: 'resume-correction-recorded',
      correctionKind: 'resume-claim-reformulation',
      matchScoreBand: '75-100',
    }])
  }

  async expectReformulationToBeRejectedWithoutChangingTheResume() {
    expect(this.#actionResult).toEqual({
      ok: false,
      error: { type: 'resume-claim-unavailable' },
    })
    const currentState = await this.#workflow.readView()
    assert(currentState.ok && currentState.value.status === 'ready')
    expect(currentState.value.tailoredResume).toEqual(tailoredResumeWithExistingExclusion)
  }

  expectOnlyTheSelectedClaimToBeRemoved() {
    expect(this.#readTailoredResume().claims).toEqual([
      existingTailoredResume.claims[1],
    ])
  }

  #readActionResult() {
    expect(this.#actionResult, 'Expected a Resume Claim action before reading its result')
      .toBeDefined()
    assert(this.#actionResult !== undefined)
    return this.#actionResult
  }

  #readTailoredResume() {
    expect(this.#actionResult, 'Expected a Resume Claim action before reading its result')
      .toBeDefined()
    expect(this.#actionResult?.ok).toBe(true)
    assert(this.#actionResult?.ok === true && this.#actionResult.value.status === 'ready')
    const tailoredResume = this.#actionResult.value.tailoredResume
    expect(tailoredResume, 'Expected a Tailored Resume').toBeDefined()
    assert(tailoredResume !== undefined)
    return tailoredResume
  }
}

function createReadyState({ tailoredResume }: Readonly<{
  tailoredResume?: ReadyState['tailoredResume']
}>): ReadyState {
  return {
    status: 'ready',
    sessionId: 'candidate-session-resume-claims',
    expiresAt: 100_000,
    sourceProfile: {
      status: 'reviewing-facts',
      documentName: 'resume.pdf',
      detectedSensitiveContent: [],
      outgoingContent: 'professional content',
      processingNotice: { version: '2026-09-28', confirmedAt: 900 },
      facts: verifiedFacts,
    },
    jobPosting: {
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'TypeScript role',
      practicalConstraints: [],
      processingNotice: {
        version: '2026-09-26',
        confirmedAt: 900,
        provider: 'OpenAI',
        retentionPolicy: 'standard-abuse-monitoring',
        transmittedDataCategories: ['job-posting-content'],
      },
      requirements: [{
        id: 'job-requirement-typescript',
        groupId: 'job-requirement-group-typescript',
        classification: 'required',
        sourceExcerpt: 'Strong TypeScript',
        value: 'Strong TypeScript',
      }],
    },
    matchAnalysis: {
      evidence: [{
        coverage: 'covered',
        requirementId: 'job-requirement-typescript',
        factIds: ['source-fact-experience', 'source-fact-typescript'],
      }],
      gapAnalysis: { partiallyCoveredRequiredRequirementIds: [], uncoveredRequiredRequirementIds: [] },
      generationEligibility: 'eligible',
      improvementOpportunities: [],
      matchScore: 100 as NonNullable<ReadyState['matchAnalysis']>['matchScore'],
      relevantFactIds: [
        'source-fact-experience',
        'source-fact-typescript',
        'source-fact-unconnected',
      ],
      warning: null,
    },
    ...(tailoredResume === undefined ? {} : { tailoredResume }),
  }
}

const verifiedFacts = [
  {
    id: 'source-fact-experience',
    kind: 'experience',
    propositionKey: 'proposition-experience-acme',
    status: 'verified',
    value: 'Built APIs at Acme from January 2022 for 2 years until 2024',
  },
  {
    id: 'source-fact-typescript',
    kind: 'skill',
    propositionKey: 'proposition-skill-typescript',
    status: 'verified',
    value: 'Used TypeScript',
  },
  {
    id: 'source-fact-unconnected',
    kind: 'experience',
    propositionKey: 'proposition-experience-unconnected',
    status: 'verified',
    value: 'Worked on an unrelated legacy migration',
  },
] as const satisfies readonly SourceProfileFact[]

const defaultProposedClaim = {
  segments: [
    { factIds: ['source-fact-experience'], text: 'Built APIs at Acme from 2022 to 2024' },
    { factIds: ['source-fact-typescript'], text: ' using TypeScript' },
  ],
} as const satisfies ProposedResumeClaim

const existingTailoredResume = {
  claims: [
    {
      id: 'resume-claim-experience',
      segments: [{
        factIds: ['source-fact-experience'],
        text: 'Built APIs at Acme from 2022 to 2024',
      }],
    },
    {
      id: 'resume-claim-education',
      segments: [{ factIds: ['source-fact-typescript'], text: 'Used TypeScript' }],
    },
  ],
  exclusions: [],
  locale: 'en',
} as const satisfies ReadyState['tailoredResume']

const tailoredResumeWithExistingExclusion = {
  ...existingTailoredResume,
  exclusions: [{ reason: 'unsupported-after-regeneration' }],
} as const satisfies ReadyState['tailoredResume']
