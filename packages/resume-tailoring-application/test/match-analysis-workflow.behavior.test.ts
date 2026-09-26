import { describe, expect, it } from 'vitest'

import type {
  JobRequirement,
  MatchEvidenceMatcher,
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

describe('Match Analysis workflow', () => {
  it('shows evidence-backed binary coverage and calculates the weighted Match Score', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenControlledSynonymsAndTranslationsEstablishCoverage()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectEvidenceBackedMatchAnalysis()
  })

  it('warns below 50 percent without denying an evidence-backed Tailored Resume', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenOnlyAPreferredRequirementIsCovered()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectLowScoreWarningWithoutEligibilityDenial()
  })

  it('does not deny generation merely because no requirement is covered', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenRelevantVerifiedMaterialWithoutCoverage()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectVerifiedMaterialToRemainEligible()
  })

  it('denies generation when there is no Verified Fact to support a resume', async () => {
    const system = createSystemUnderTest({ facts: [] })

    // Given
    system.givenNoRequirementIsCovered()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectGenerationDeniedForInsufficientVerifiedMaterial()
  })

  it('rejects Match Evidence that references a fact which is not verified', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenTheMatcherReferencesAnUnverifiedFact()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('rejects an uncontrolled implicit qualification proposed by the matcher', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenTheMatcherInfersLeadershipFromAProgrammingSkill()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('rejects a technology inferred only from a role title', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenTheMatcherUsesARoleTitleAsSkillProof()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('rejects a partial term match that does not satisfy a required duration', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript on one project' })],
      jobRequirements: [createTypeScriptRequirement({ value: '5 years of TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('rejects a fact containing a negated skill claim', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'No production experience with TypeScript' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('does not send match inputs after a processing notice becomes stale', async () => {
    const system = createSystemUnderTest({ sourceNoticeVersion: 'obsolete' })

    await system.analyzeMatch()

    system.expectCurrentProcessingConsentToBeRequired()
  })

  it('does not send match inputs after the Job Posting consent becomes stale', async () => {
    const system = createSystemUnderTest({ jobNoticeVersion: 'obsolete' })

    await system.analyzeMatch()

    system.expectCurrentProcessingConsentToBeRequired()
  })

  it('does not treat React as proof of React Native', async () => {
    const system = createSystemUnderTest({
      facts: [createReactFact({ value: 'Used React' })],
      jobRequirements: [createReactRequirement({ value: 'Know React Native' })],
    })

    system.givenTheMatcherMatchesReact()
    await system.analyzeMatch()

    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('binds a required duration to the matching skill', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({
        value: '5 years of Java. Used TypeScript',
      })],
      jobRequirements: [createTypeScriptRequirement({ value: '5 years of TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('binds qualitative seniority to the matching skill', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({
        value: 'Senior Java developer. Used TypeScript',
      })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Senior TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectFabricatedMatchEvidenceToBeRejected()
  })

  it('does not erase a required technology version', async () => {
    const system = createSystemUnderTest({
      facts: [createReactFact({ value: 'Used React 17' })],
      jobRequirements: [createReactRequirement({ value: 'Know React 18' })],
    })

    system.givenTheMatcherMatchesReact()
    await system.analyzeMatch()

    system.expectFabricatedMatchEvidenceToBeRejected()
  })
})

function createSystemUnderTest({
  facts = verifiedFacts,
  jobRequirements = requirements,
  jobNoticeVersion = '2026-09-26',
  sourceNoticeVersion = '2026-09-26',
}: Readonly<{
  facts?: readonly SourceProfileFact[]
  jobRequirements?: readonly JobRequirement[]
  jobNoticeVersion?: string
  sourceNoticeVersion?: string
}> = {}) {
  return new MatchAnalysisWorkflowTestSystem({
    facts, jobNoticeVersion, jobRequirements, sourceNoticeVersion,
  })
}

class MatchAnalysisWorkflowTestSystem {
  readonly #matchRequests: Parameters<MatchEvidenceMatcher['match']>[0][] = []
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #matcherResult: Awaited<ReturnType<MatchEvidenceMatcher['match']>> = {
    ok: true,
    value: { evidence: [], relevantFactIds: [] },
  }

  constructor({ facts, jobNoticeVersion, jobRequirements, sourceNoticeVersion }: Readonly<{
    facts: readonly SourceProfileFact[]
    jobNoticeVersion: string
    jobRequirements: readonly JobRequirement[]
    sourceNoticeVersion: string
  }>) {
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: 1_000 }),
      candidateSessionIdentity: {
        create: () => ({ ok: true, value: 'candidate-session-match-analysis' }),
      },
      candidateSessionPersistence: createInMemoryCandidateSessionPersistence({
        initialState: createCandidateSessionState({
          facts, jobNoticeVersion, jobRequirements, sourceNoticeVersion,
        }),
      }),
      matchEvidenceMatcher: {
        match: (request) => {
          this.#matchRequests.push(request)
          return Promise.resolve(this.#matcherResult)
        },
      },
      telemetry: createTelemetrySpy(),
    })
  }

  givenOnlyAPreferredRequirementIsCovered() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-french',
          factMatches: [{
            factId: 'source-fact-french',
            factTerm: 'Français',
            relationship: 'controlled',
            requirementTerm: 'French',
          }],
        }],
        relevantFactIds: ['source-fact-french'],
      },
    }
  }

  givenNoRequirementIsCovered() {}

  givenRelevantVerifiedMaterialWithoutCoverage() {
    this.#matcherResult = {
      ok: true,
      value: { evidence: [], relevantFactIds: ['source-fact-typescript'] },
    }
  }

  givenTheMatcherReferencesAnUnverifiedFact() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-leadership',
          factMatches: [{
            factId: 'source-fact-unverified-leadership',
            factTerm: 'Led',
            relationship: 'controlled',
            requirementTerm: 'leadership',
          }],
        }],
        relevantFactIds: ['source-fact-unverified-leadership'],
      },
    }
  }

  givenTheMatcherInfersLeadershipFromAProgrammingSkill() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-leadership',
          factMatches: [{
            factId: 'source-fact-typescript',
            factTerm: 'TypeScript',
            relationship: 'controlled',
            requirementTerm: 'leadership',
          }],
        }],
        relevantFactIds: ['source-fact-typescript'],
      },
    }
  }

  givenTheMatcherUsesARoleTitleAsSkillProof() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factId: 'source-fact-role-title',
            factTerm: 'TypeScript',
            relationship: 'controlled',
            requirementTerm: 'TS',
          }],
        }],
        relevantFactIds: ['source-fact-role-title'],
      },
    }
  }

  givenTheMatcherMatchesTypeScript() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factId: 'source-fact-typescript',
            factTerm: 'TypeScript',
            relationship: 'exact',
            requirementTerm: 'TypeScript',
          }],
        }],
        relevantFactIds: ['source-fact-typescript'],
      },
    }
  }

  givenTheMatcherMatchesReact() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-react',
          factMatches: [{
            factId: 'source-fact-react',
            factTerm: 'React',
            relationship: 'exact',
            requirementTerm: 'React',
          }],
        }],
        relevantFactIds: ['source-fact-react'],
      },
    }
  }

  givenControlledSynonymsAndTranslationsEstablishCoverage() {
    this.#matcherResult = {
      ok: true,
      value: {
        evidence: [{
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factId: 'source-fact-typescript',
            factTerm: 'TypeScript',
            relationship: 'controlled',
            requirementTerm: 'TS',
          }],
        }, {
          requirementId: 'job-requirement-french',
          factMatches: [{
            factId: 'source-fact-french',
            factTerm: 'Français',
            relationship: 'controlled',
            requirementTerm: 'French',
          }],
        }],
        relevantFactIds: ['source-fact-typescript', 'source-fact-french'],
      },
    }
  }

  async analyzeMatch() {
    this.#actionResult = await this.#workflow.execute({ type: 'analyze-match' })
  }

  expectEvidenceBackedMatchAnalysis() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return
    expect(result.value.matchAnalysis).toEqual({
      evidence: [
        {
          requirementId: 'job-requirement-typescript',
          factIds: ['source-fact-typescript'],
        },
        {
          requirementId: 'job-requirement-french',
          factIds: ['source-fact-french'],
        },
      ],
      gapAnalysis: {
        uncoveredRequiredRequirementIds: ['job-requirement-leadership'],
      },
      generationEligibility: 'eligible',
      matchScore: 60,
      relevantFactIds: ['source-fact-typescript', 'source-fact-french'],
      warning: null,
    })
    expect(this.#matchRequests).toEqual([{
      requirements: requirements.map(({ classification, id, value }) =>
        ({ classification, id, value })),
      verifiedFacts: verifiedFacts.filter((fact) => fact.status === 'verified')
        .map(({ id, kind, value }) => ({ id, kind, value })),
    }])
  }

  expectLowScoreWarningWithoutEligibilityDenial() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      generationEligibility: 'eligible',
      matchScore: 20,
      warning: 'below-generation-threshold',
    })
  }

  expectVerifiedMaterialToRemainEligible() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [],
      generationEligibility: 'eligible',
      matchScore: 0,
      warning: 'below-generation-threshold',
    })
  }

  expectGenerationDeniedForInsufficientVerifiedMaterial() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [],
      generationEligibility: 'denied',
    })
  }

  expectFabricatedMatchEvidenceToBeRejected() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'match-analysis-unavailable' },
    })
  }

  expectCurrentProcessingConsentToBeRequired() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'processing-notice-required' },
    })
    expect(this.#matchRequests).toEqual([])
  }

  #readActionResult() {
    expect(this.#actionResult).toBeDefined()
    return this.#actionResult ?? {
      ok: false,
      error: { type: 'candidate-session-unavailable' },
    } as const
  }

  #readMatchAnalysis() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return undefined
    expect(result.value.matchAnalysis).toBeDefined()
    return result.value.matchAnalysis
  }
}

const verifiedFacts = [
  {
    id: 'source-fact-typescript',
    kind: 'skill',
    propositionKey: 'proposition-skill-typescript',
    status: 'verified',
    value: 'TypeScript',
  },
  {
    id: 'source-fact-french',
    kind: 'language',
    propositionKey: 'proposition-language-french',
    status: 'verified',
    value: 'Français courant',
  },
  {
    id: 'source-fact-unverified-leadership',
    kind: 'experience',
    propositionKey: 'proposition-experience-leadership',
    status: 'extracted',
    value: 'Led a team',
  },
  {
    id: 'source-fact-role-title',
    kind: 'experience',
    propositionKey: 'proposition-experience-role-title',
    status: 'verified',
    value: 'Senior TypeScript Developer at Acme',
  },
] as const satisfies readonly SourceProfileFact[]

const requirements = [
  {
    id: 'job-requirement-typescript',
    groupId: 'job-requirement-group-technical',
    classification: 'required',
    sourceExcerpt: 'TypeScript and leadership are required.',
    value: 'Know TS',
  },
  {
    id: 'job-requirement-leadership',
    groupId: 'job-requirement-group-technical',
    classification: 'required',
    sourceExcerpt: 'TypeScript and leadership are required.',
    value: 'Demonstrate leadership',
  },
  {
    id: 'job-requirement-french',
    groupId: 'job-requirement-group-language',
    classification: 'preferred',
    sourceExcerpt: 'French is preferred.',
    value: 'Speak French',
  },
] as const satisfies readonly JobRequirement[]

function createCandidateSessionState({
  facts,
  jobNoticeVersion,
  jobRequirements,
  sourceNoticeVersion,
}: Readonly<{
  facts: readonly SourceProfileFact[]
  jobNoticeVersion: string
  jobRequirements: readonly JobRequirement[]
  sourceNoticeVersion: string
}>): ResumeTailoringState {
  return {
    status: 'ready',
    sessionId: 'candidate-session-match-analysis',
    expiresAt: 86_401_000,
    sourceProfile: {
      status: 'reviewing-facts',
      documentName: 'resume.pdf',
      detectedSensitiveContent: [],
      outgoingContent: 'Professional content',
      processingNotice: { version: sourceNoticeVersion, confirmedAt: 1_000 },
      facts,
    },
    jobPosting: {
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'TypeScript and leadership are required. French is preferred.',
      processingNotice: {
        version: jobNoticeVersion,
        confirmedAt: 1_000,
        provider: 'OpenAI',
        retentionPolicy: 'standard-abuse-monitoring',
        transmittedDataCategories: ['job-posting-content'],
      },
      requirements: jobRequirements,
    },
  }
}

function createTypeScriptFact({ value }: Readonly<{ value: string }>): SourceProfileFact {
  return {
    id: 'source-fact-typescript',
    kind: 'experience',
    propositionKey: 'proposition-experience-typescript',
    status: 'verified',
    value,
  }
}

function createTypeScriptRequirement({ value }: Readonly<{ value: string }>): JobRequirement {
  return {
    id: 'job-requirement-typescript',
    groupId: 'job-requirement-group-technical',
    classification: 'required',
    sourceExcerpt: value,
    value,
  }
}

function createReactFact({ value }: Readonly<{ value: string }>): SourceProfileFact {
  return {
    id: 'source-fact-react',
    kind: 'experience',
    propositionKey: 'proposition-experience-react',
    status: 'verified',
    value,
  }
}

function createReactRequirement({ value }: Readonly<{ value: string }>): JobRequirement {
  return {
    id: 'job-requirement-react',
    groupId: 'job-requirement-group-technical',
    classification: 'required',
    sourceExcerpt: value,
    value,
  }
}
