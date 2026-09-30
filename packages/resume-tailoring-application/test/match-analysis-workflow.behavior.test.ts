import { describe, expect, it } from 'vitest'

import type {
  JobRequirement,
  MatchEvidenceMatcher,
  PracticalConstraint,
  ResumeTailoringState,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import { readMatchBand } from '@resume-tailoring/application/match-analysis'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

describe('Match Analysis workflow', () => {
  it.each([
    { expectedBand: 'ambitious', matchScore: 49 },
    { expectedBand: 'credible', matchScore: 50 },
    { expectedBand: 'credible', matchScore: 74 },
    { expectedBand: 'strong', matchScore: 75 },
  ] as const)('maps $matchScore percent to the $expectedBand band', ({ expectedBand, matchScore }) => {
    expectMatchBand({ expectedBand, matchScore })
  })

  it('shows evidence-backed binary coverage and calculates the weighted Match Score', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenControlledSynonymsAndTranslationsEstablishCoverage()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectEvidenceBackedMatchAnalysis()
  })

  it('accepts an exact technology term inside a French instructional requirement', async () => {
    const system = createSystemUnderTest({ facts: rxJsFacts, jobRequirements: rxJsRequirements })

    system.givenTheMatcherMatchesRxJs()
    await system.analyzeMatch()

    system.expectRxJsRequirementToBeCovered()
  })

  it('keeps valid evidence when another proposed evidence link is unsupported', async () => {
    const system = createSystemUnderTest()

    system.givenValidTypeScriptAndUnsupportedLeadershipEvidence()
    await system.analyzeMatch()

    system.expectOnlyTypeScriptRequirementToBeCovered()
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

  it('keeps Improvement Opportunities visible without scoring them', async () => {
    const system = createSystemUnderTest()

    system.givenAnUnscoredImprovementOpportunity()
    await system.analyzeMatch()

    system.expectImprovementOpportunityWithoutScoreImpact()
  })

  it('excludes Practical Constraints from matching and the Match Score', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
      practicalConstraints: [createPracticalConstraint({
        value: 'Work in Paris three days per week',
      })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectPracticalConstraintsNotToAffectMatching()
  })

  it('keeps generation eligible when a relevant Candidate Fact supports the Job Posting', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenRelevantVerifiedMaterialWithoutCoverage()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectRelevantMaterialToRemainEligible()
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

  it('rejects a technology inferred only from a role title', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenTheMatcherUsesARoleTitleAsSkillProof()

    // Action
    await system.analyzeMatch()

    // Then
    system.expectProposedMatchEvidenceToBeDiscarded()
  })

  it('rejects a technology found only in a role title beside other evidence', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Senior TypeScript Developer; built React apps' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectProposedMatchEvidenceToBeDiscarded()
  })

  it('rejects a role-title technology beside same-clause evidence for another capability', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({
        value: 'Senior TypeScript Full Stack Developer who built React apps',
      })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectProposedMatchEvidenceToBeDiscarded()
  })

  it('accepts same-clause technology evidence when the capability has its own evidence verb', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Developer built APIs with TypeScript' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBeCovered()
  })

  it('does not confuse people affected by evidence with the Candidate role', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript to mentor developers' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBeCovered()
  })

  it('rejects a partial term match that does not satisfy a required duration', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript on one project' })],
      jobRequirements: [createTypeScriptRequirement({ value: '5 years of TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectProposedMatchEvidenceToBeDiscarded()
  })

  it('awards half weight when evidence covers the capability but not the required duration', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: '3 years of TypeScript' })],
      jobRequirements: [createTypeScriptRequirement({ value: '5 years of TypeScript' })],
    })

    system.givenTheMatcherPartiallyMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBePartiallyCovered()
  })

  it('awards half weight when evidence covers the capability but not the required level', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Mid-level TypeScript' })],
    })

    system.givenTheMatcherPartiallyMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBePartiallyCovered()
  })

  it('awards full weight when evidence exceeds the required level', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Principal TypeScript expertise' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Senior TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBeCovered()
  })

  it('awards half weight when evidence covers the capability but not the required scale', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript for 1 million users' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Use TypeScript for 10 million users' })],
    })

    system.givenTheMatcherPartiallyMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBePartiallyCovered()
  })

  it('normalizes decimal scales and singular units before comparing them', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'Used TypeScript for 1.5 million user' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Use TypeScript for 1 million users' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBeCovered()
  })

  it('rejects a fact containing a negated skill claim', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({ value: 'No production experience with TypeScript' })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectProposedMatchEvidenceToBeDiscarded()
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

  it('binds a required duration to the matching skill', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({
        value: '5 years of Java. Used TypeScript',
      })],
      jobRequirements: [createTypeScriptRequirement({ value: '5 years of TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectProposedMatchEvidenceToBeDiscarded()
  })

  it('downgrades coverage when seniority belongs to another skill', async () => {
    const system = createSystemUnderTest({
      facts: [createTypeScriptFact({
        value: 'Senior Java developer. Used TypeScript',
      })],
      jobRequirements: [createTypeScriptRequirement({ value: 'Senior TypeScript' })],
    })

    system.givenTheMatcherMatchesTypeScript()
    await system.analyzeMatch()

    system.expectTypeScriptRequirementToBePartiallyCovered()
  })

  it('adds a Candidate-authored fact and refreshes Match Analysis atomically', async () => {
    const system = createSystemUnderTest({
      facts: [],
      jobRequirements: [createTypeScriptRequirement({ value: 'Know TypeScript' })],
    })

    // Given
    system.givenEnrichedExperienceCoversTypeScript()

    // Action
    await system.enrichSourceProfile()

    // Then
    system.expectCandidateFactAndRefreshedMatchAnalysis()
  })

  it('rejects duplicate Candidate Facts and preserves the previous Match Analysis', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenAnExistingMatchAnalysis()

    // Action
    await system.enrichSourceProfileWithDuplicateFact()

    // Then
    await system.expectEnrichmentFailureToPreserveAnalysis('candidate-fact-duplicate')
  })

  it('rejects empty Candidate Facts and preserves the previous Match Analysis', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenAnExistingMatchAnalysis()

    // Action
    await system.enrichSourceProfileWithEmptyFact()

    // Then
    await system.expectEnrichmentFailureToPreserveAnalysis('candidate-fact-invalid')
  })
})

function expectMatchBand({ expectedBand, matchScore }: Readonly<{
  expectedBand: ReturnType<typeof readMatchBand>
  matchScore: number
}>) {
  expect(readMatchBand({ matchScore })).toBe(expectedBand)
}

function createSystemUnderTest({
  facts = verifiedFacts,
  jobRequirements = requirements,
  jobNoticeVersion = '2026-09-26',
  practicalConstraints = [],
  sourceNoticeVersion = '2026-09-28',
}: Readonly<{
  facts?: readonly SourceProfileFact[]
  jobRequirements?: readonly JobRequirement[]
  jobNoticeVersion?: string
  practicalConstraints?: readonly PracticalConstraint[]
  sourceNoticeVersion?: string
}> = {}) {
  return new MatchAnalysisWorkflowTestSystem({
    facts, jobNoticeVersion, jobRequirements, practicalConstraints, sourceNoticeVersion,
  })
}

class MatchAnalysisWorkflowTestSystem {
  readonly #matchRequests: Parameters<MatchEvidenceMatcher['match']>[0][] = []
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #matcherResult: Awaited<ReturnType<MatchEvidenceMatcher['match']>> = {
    ok: true,
    value: { evidence: [], improvementOpportunities: [], relevantFactIds: [] },
  }

  constructor({
    facts,
    jobNoticeVersion,
    jobRequirements,
    practicalConstraints,
    sourceNoticeVersion,
  }: Readonly<{
    facts: readonly SourceProfileFact[]
    jobNoticeVersion: string
    jobRequirements: readonly JobRequirement[]
    practicalConstraints: readonly PracticalConstraint[]
    sourceNoticeVersion: string
  }>) {
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: 1_000 }),
      candidateSessionIdentity: {
        create: () => ({ ok: true, value: 'candidate-session-match-analysis' }),
      },
      candidateSessionPersistence: createInMemoryCandidateSessionPersistence({
        initialState: createCandidateSessionState({
          facts, jobNoticeVersion, jobRequirements, practicalConstraints, sourceNoticeVersion,
        }),
      }),
      matchEvidenceMatcher: {
        match: (request) => {
          this.#matchRequests.push(request)
          return Promise.resolve(this.#matcherResult)
        },
      },
      sourceProfileFactIdentity: {
        create: () => ({ ok: true, value: 'source-fact-enrichment' }),
      },
      telemetry: createTelemetrySpy(),
    })
  }

  givenEnrichedExperienceCoversTypeScript() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factExcerpt: 'TypeScript',
            factId: 'source-fact-enrichment',
            requirementExcerpt: 'TypeScript',
          }],
        }],
        relevantFactIds: ['source-fact-enrichment'],
      },
    }
  }

  async givenAnExistingMatchAnalysis() {
    this.givenControlledSynonymsAndTranslationsEstablishCoverage()
    await this.#workflow.execute({ type: 'analyze-match' })
  }

  givenOnlyAPreferredRequirementIsCovered() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-french',
          factMatches: [{
            factExcerpt: 'Français',
            factId: 'source-fact-french',
            requirementExcerpt: 'French',
          }],
        }],
        relevantFactIds: ['source-fact-french'],
      },
    }
  }

  givenAnUnscoredImprovementOpportunity() {
    const matcherResult = {
      ok: true,
      value: {
        evidence: [],
        improvementOpportunities: ['Mention CI/CD conventions if they are genuine'],
        relevantFactIds: [],
      },
    } as const
    this.#matcherResult = matcherResult
  }

  givenNoRequirementIsCovered() {}

  givenRelevantVerifiedMaterialWithoutCoverage() {
    this.#matcherResult = {
      ok: true,
      value: { evidence: [], improvementOpportunities: [],
        relevantFactIds: ['source-fact-typescript'] },
    }
  }

  givenTheMatcherReferencesAnUnverifiedFact() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-leadership',
          factMatches: [{
            factExcerpt: 'Led',
            factId: 'source-fact-unverified-leadership',
            requirementExcerpt: 'leadership',
          }],
        }],
        relevantFactIds: ['source-fact-unverified-leadership'],
      },
    }
  }

  givenTheMatcherUsesARoleTitleAsSkillProof() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factExcerpt: 'TypeScript',
            factId: 'source-fact-role-title',
            requirementExcerpt: 'TS',
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
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factExcerpt: 'TypeScript',
            factId: 'source-fact-typescript',
            requirementExcerpt: 'TypeScript',
          }],
        }],
        relevantFactIds: ['source-fact-typescript'],
      },
    }
  }

  givenTheMatcherPartiallyMatchesTypeScript() {
    const matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'partially-covered',
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factExcerpt: 'TypeScript',
            factId: 'source-fact-typescript',
            requirementExcerpt: 'TypeScript',
          }],
        }],
        relevantFactIds: ['source-fact-typescript'],
      },
    } as const
    this.#matcherResult = matcherResult
  }

  givenTheMatcherMatchesRxJs() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-rxjs',
          factMatches: [{
            factExcerpt: 'RxJS',
            factId: 'source-fact-rxjs',
            requirementExcerpt: 'RxJS',
          }],
        }],
        relevantFactIds: ['source-fact-rxjs'],
      },
    }
  }

  givenValidTypeScriptAndUnsupportedLeadershipEvidence() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factExcerpt: 'TypeScript', factId: 'source-fact-typescript', requirementExcerpt: 'TS',
          }],
        }, {
          coverage: 'covered',
          requirementId: 'job-requirement-leadership',
          factMatches: [{
            factExcerpt: 'Led teams', factId: 'source-fact-typescript', requirementExcerpt: 'leadership',
          }],
        }],
        relevantFactIds: ['source-fact-typescript'],
      },
    }
  }

  givenControlledSynonymsAndTranslationsEstablishCoverage() {
    this.#matcherResult = {
      ok: true,
      value: {
        improvementOpportunities: [],
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-typescript',
          factMatches: [{
            factExcerpt: 'TypeScript',
            factId: 'source-fact-typescript',
            requirementExcerpt: 'TS',
          }],
        }, {
          coverage: 'covered',
          requirementId: 'job-requirement-french',
          factMatches: [{
            factExcerpt: 'Français',
            factId: 'source-fact-french',
            requirementExcerpt: 'French',
          }],
        }],
        relevantFactIds: ['source-fact-typescript', 'source-fact-french'],
      },
    }
  }

  async analyzeMatch() {
    this.#actionResult = await this.#workflow.execute({ type: 'analyze-match' })
  }

  async enrichSourceProfile() {
    this.#actionResult = await this.#workflow.execute({
      type: 'enrich-source-profile',
      kind: 'experience',
      value: '  Built production APIs with TypeScript  ',
    })
  }

  async enrichSourceProfileWithDuplicateFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'enrich-source-profile', kind: 'skill', value: '  TYPESCRIPT  ',
    })
  }

  async enrichSourceProfileWithEmptyFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'enrich-source-profile', kind: 'experience', value: '   ',
    })
  }

  expectCandidateFactAndRefreshedMatchAnalysis() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return
    expect(result.value.sourceProfile?.facts.at(-1)).toEqual({
      authorship: 'candidate',
      id: 'source-fact-enrichment',
      kind: 'experience',
      propositionKey: 'proposition-experience-enrichment',
      status: 'verified',
      value: 'Built production APIs with TypeScript',
    })
    expect(result.value.matchAnalysis).toMatchObject({
      evidence: [{
        coverage: 'covered',
        requirementId: 'job-requirement-typescript',
        factIds: ['source-fact-enrichment'],
      }],
      matchScore: 100,
    })
    expect(this.#matchRequests.at(-1)?.verifiedFacts).toContainEqual({
      id: 'source-fact-enrichment',
      kind: 'experience',
      value: 'Built production APIs with TypeScript',
    })
  }

  async expectEnrichmentFailureToPreserveAnalysis(
    expectedFailure: 'candidate-fact-duplicate' | 'candidate-fact-invalid',
  ) {
    expect(this.#readActionResult()).toEqual({
      ok: false, error: { type: expectedFailure },
    })
    const currentView = await this.#workflow.readView()
    expect(currentView.ok).toBe(true)
    if (!currentView.ok || currentView.value.status !== 'ready') return
    expect(currentView.value.matchAnalysis?.matchScore).toBe(60)
    expect(currentView.value.matchAnalysis?.evidence.map(({ requirementId }) => requirementId))
      .toEqual(['job-requirement-typescript', 'job-requirement-french'])
    expect(this.#matchRequests).toHaveLength(1)
  }

  expectEvidenceBackedMatchAnalysis() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return
    expect(result.value.matchAnalysis).toEqual({
      evidence: [
        {
          coverage: 'covered',
          requirementId: 'job-requirement-typescript',
          factIds: ['source-fact-typescript'],
        },
        {
          coverage: 'covered',
          requirementId: 'job-requirement-french',
          factIds: ['source-fact-french'],
        },
      ],
      gapAnalysis: {
        partiallyCoveredRequiredRequirementIds: [],
        uncoveredRequiredRequirementIds: ['job-requirement-leadership'],
      },
      generationEligibility: 'eligible',
      improvementOpportunities: [],
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

  expectRxJsRequirementToBeCovered() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [{
        coverage: 'covered',
        requirementId: 'job-requirement-rxjs',
        factIds: ['source-fact-rxjs'],
      }],
      matchScore: 25,
    })
  }

  expectOnlyTypeScriptRequirementToBeCovered() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [{
        coverage: 'covered',
        requirementId: 'job-requirement-typescript',
        factIds: ['source-fact-typescript'],
      }],
    })
  }

  expectPracticalConstraintsNotToAffectMatching() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      matchScore: 100,
      gapAnalysis: { uncoveredRequiredRequirementIds: [] },
    })
    expect(this.#matchRequests).toHaveLength(1)
    expect(this.#matchRequests[0]?.requirements).toEqual([{
      classification: 'required',
      id: 'job-requirement-typescript',
      value: 'Know TypeScript',
    }])
  }

  expectImprovementOpportunityWithoutScoreImpact() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [],
      improvementOpportunities: ['Mention CI/CD conventions if they are genuine'],
      matchScore: 0,
    })
  }

  expectTypeScriptRequirementToBePartiallyCovered() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [{
        coverage: 'partially-covered',
        requirementId: 'job-requirement-typescript',
      }],
      gapAnalysis: {
        partiallyCoveredRequiredRequirementIds: ['job-requirement-typescript'],
      },
      generationEligibility: 'eligible',
      matchScore: 50,
    })
  }

  expectTypeScriptRequirementToBeCovered() {
    expect(this.#readMatchAnalysis()).toMatchObject({
      evidence: [{
        coverage: 'covered',
        requirementId: 'job-requirement-typescript',
      }],
      generationEligibility: 'eligible',
      matchScore: 100,
    })
  }

  expectRelevantMaterialToRemainEligible() {
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

  expectProposedMatchEvidenceToBeDiscarded() {
    expect(this.#readMatchAnalysis()).toMatchObject({ evidence: [], matchScore: 0 })
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
    status: 'rejected',
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

const rxJsFacts = [{
  id: 'source-fact-rxjs',
  kind: 'skill',
  propositionKey: 'proposition-skill-rxjs',
  status: 'verified',
  value: 'The candidate has experience with RxJS.',
}] as const satisfies readonly SourceProfileFact[]

const rxJsRequirements = [{
  id: 'job-requirement-rxjs',
  groupId: 'job-requirement-group-technical',
  classification: 'preferred',
  sourceExcerpt: 'Maîtriser RxJS.',
  value: 'Maîtriser RxJS.',
}] as const satisfies readonly JobRequirement[]

function createCandidateSessionState({
  facts,
  jobNoticeVersion,
  jobRequirements,
  practicalConstraints,
  sourceNoticeVersion,
}: Readonly<{
  facts: readonly SourceProfileFact[]
  jobNoticeVersion: string
  jobRequirements: readonly JobRequirement[]
  practicalConstraints: readonly PracticalConstraint[]
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
      practicalConstraints,
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

function createPracticalConstraint({ value }: Readonly<{ value: string }>): PracticalConstraint {
  return {
    sourceExcerpt: value,
    value,
  }
}
