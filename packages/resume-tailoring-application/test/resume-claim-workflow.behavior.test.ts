import { assert, describe, expect, it } from 'vitest'

import type {
  ProposedResumeClaim,
  ResumeClaim,
  ResumeClaimSemanticValidator,
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
  })

  it('removes a claim selected by the Candidate', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    await system.removeResumeClaim()

    system.expectOnlyTheSelectedClaimToBeRemoved()
  })

  it('reformulates one claim through the writing and validation workflow', async () => {
    const system = createSystemUnderTest({ tailoredResume: existingTailoredResume })

    system.givenAConciseSupportedReformulation()
    await system.requestResumeClaimReformulation()

    system.expectOnlyTheRequestedClaimToBeReformulated()
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
  readonly #writer: ResumeClaimWriter
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #generatedClaims: readonly ProposedResumeClaim[] = [defaultProposedClaim]
  #reformulatedClaims: ProposedResumeClaim[] = []
  #semanticResults: boolean[] = [true]

  constructor({ tailoredResume }: Readonly<{ tailoredResume?: ReadyState['tailoredResume'] }>) {
    this.#writer = {
      write: () => Promise.resolve({ ok: true, value: this.#generatedClaims }),
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
      telemetry: createTelemetrySpy(),
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

  async generateTailoredResume() {
    this.#actionResult = await this.#workflow.execute({ type: 'generate-resume-claims' })
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

  expectOnlyTheSelectedClaimToBeRemoved() {
    expect(this.#readTailoredResume().claims).toEqual([
      existingTailoredResume.claims[1],
    ])
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
      processingNotice: { version: '2026-09-26', confirmedAt: 900 },
      facts: verifiedFacts,
    },
    jobPosting: {
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'TypeScript role',
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
        requirementId: 'job-requirement-typescript',
        factIds: ['source-fact-typescript'],
      }],
      gapAnalysis: { uncoveredRequiredRequirementIds: [] },
      generationEligibility: 'eligible',
      matchScore: 100 as NonNullable<ReadyState['matchAnalysis']>['matchScore'],
      relevantFactIds: ['source-fact-experience', 'source-fact-typescript'],
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
} as const satisfies ReadyState['tailoredResume']
