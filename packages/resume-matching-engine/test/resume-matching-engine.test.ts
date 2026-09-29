import { describe, expect, it } from 'vitest'

import {
  analyzeResumeMatch,
  type CandidateFact,
  type JobRequirement,
  type ProposedMatchEvidence,
} from '@resume-tailoring/matching-engine'

describe('resume matching engine', () => {
  it.each([
    { expectedEligibility: 'denied', relevantFactIds: [] },
    { expectedEligibility: 'eligible', relevantFactIds: ['fact-typescript'] },
  ] as const)('keeps Generation Eligibility $expectedEligibility at a zero Match Score', ({
    expectedEligibility, relevantFactIds,
  }) => {
    const result = analyzeResumeMatch({
      candidateFacts,
      proposedEvidence: [],
      relevantFactIds,
      requirements,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      generationEligibility: expectedEligibility,
      matchBand: 'ambitious',
      matchScore: 0,
    })
  })

  it('calculates a Match Analysis from importance-weighted evidence coverage', () => {
    const result = analyzeResumeMatch(weightedMatchInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      generationEligibility: 'eligible',
      matchBand: 'strong',
      matchScore: 75,
    })
  })

  it('scores a reusable Capability Dimension without a role persona', () => {
    const result = analyzeResumeMatch(strategyMatchInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ matchScore: 100 })
  })

  it.each([
    { capabilityName: 'Calculus', factValue: 'Taught calculus', term: 'calculus' },
    {
      capabilityName: 'Clinical diagnosis',
      factValue: 'Diagnosed cardiac conditions',
      term: 'cardiac conditions',
    },
    {
      capabilityName: 'Financial audit',
      factValue: 'Audited financial statements',
      term: 'financial statements',
    },
  ])('accepts role-neutral experience evidence for $capabilityName', ({
    capabilityName, factValue, term,
  }) => {
    const result = analyzeResumeMatch(createRoleNeutralExperienceInputs({
      capabilityName,
      factValue,
      term,
    }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(100)
  })

  it('groups normalized duplicate capabilities before scoring', () => {
    const result = analyzeResumeMatch(duplicateCapabilityInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(50)
    expect(result.value.requirementGroups[0]).toMatchObject({
      coverage: 'covered',
      importance: 'central',
      requirementIds: [
        'requirement-typescript',
        'requirement-typescript-duplicate',
      ],
    })
  })

  it('groups explicit substitutes across Capability Dimensions', () => {
    const result = analyzeResumeMatch(crossDimensionSubstituteInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(100)
    expect(result.value.requirementGroups).toHaveLength(1)
    expect(result.value.requirementGroups[0]?.requirementIds).toEqual([
      'requirement-degree',
      'requirement-equivalent-experience',
    ])
  })

  it('caps complementary requirements at 25 percent of effective weight', () => {
    const result = analyzeResumeMatch(complementaryCapInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(75)
  })

  it('caps an all-complementary Match Score at 25 percent', () => {
    const result = analyzeResumeMatch(allComplementaryInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(25)
  })

  it('rejects full coverage when evidence has the same capability at incomplete scope', () => {
    const result = analyzeResumeMatch(incompleteFullCoverageInputs)

    expect(result).toEqual({
      error: { type: 'invalid-match-input' },
      ok: false,
    })
  })

  it('grants partial coverage and raises a reserve for an incompletely covered critical requirement', () => {
    const result = analyzeResumeMatch(partialCriticalCoverageInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      criticalRequirementReserve: {
        requirementIds: ['requirement-typescript'],
        status: 'present',
      },
      generationEligibility: 'eligible',
      matchBand: 'credible',
      matchBandQualification: 'critical-requirement-reserve',
      matchScore: 50,
    })
  })

  it('rejects a controlled synonym when the proposal claims an exact relationship', () => {
    const result = analyzeResumeMatch(falseExactSynonymInputs)

    expect(result).toEqual({
      error: { type: 'invalid-match-input' },
      ok: false,
    })
  })

  it('clears the Critical Requirement Reserve when a grouped duplicate is covered', () => {
    const result = analyzeResumeMatch(coveredCriticalDuplicateInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      criticalRequirementReserve: { requirementIds: [], status: 'clear' },
    })
  })
})

const candidateFacts = [
  {
    id: 'fact-typescript',
    kind: 'skill',
    value: 'Used TypeScript in production',
  },
] as const satisfies readonly CandidateFact[]

const requirements = [
  {
    capability: { dimension: 'technical-expertise', name: 'TypeScript' },
    id: 'requirement-typescript',
    importance: 'central',
    sourceExcerpt: 'Strong TypeScript skills are required.',
    value: 'Use TypeScript',
  },
  {
    capability: { dimension: 'stakeholder-communication', name: 'French' },
    id: 'requirement-french',
    importance: 'complementary',
    sourceExcerpt: 'French is a plus.',
    value: 'Speak French',
  },
] as const satisfies readonly JobRequirement[]

type MatchInputs = Parameters<typeof analyzeResumeMatch>[0]

const coveredTypeScriptEvidence = createEvidence({
  coverage: 'covered',
  factId: 'fact-typescript',
  requirementId: 'requirement-typescript',
  term: 'TypeScript',
})

const weightedMatchInputs = {
  candidateFacts,
  proposedEvidence: [coveredTypeScriptEvidence],
  relevantFactIds: ['fact-typescript'],
  requirements,
} as const satisfies MatchInputs

const duplicateCapabilityInputs = {
  ...weightedMatchInputs,
  requirements: [
    requirements[0],
    {
      capability: { dimension: 'technical-expertise', name: 'TS' },
      id: 'requirement-typescript-duplicate',
      importance: 'central',
      sourceExcerpt: 'You must know TypeScript.',
      value: 'Know TypeScript',
    },
    {
      capability: { dimension: 'strategy', name: 'Product strategy' },
      id: 'requirement-strategy',
      importance: 'central',
      sourceExcerpt: 'Define product strategy.',
      value: 'Define product strategy',
    },
  ],
} as const satisfies MatchInputs

const strategyMatchInputs = {
  candidateFacts: [{ id: 'fact-strategy', kind: 'experience', value: 'Planned strategy' }],
  proposedEvidence: [createEvidence({
    coverage: 'covered',
    factId: 'fact-strategy',
    requirementId: 'requirement-strategy',
    term: 'strategy',
  })],
  relevantFactIds: ['fact-strategy'],
  requirements: [{
    capability: { dimension: 'strategy', name: 'Strategy' },
    id: 'requirement-strategy',
    importance: 'central',
    sourceExcerpt: 'Strategy is required.',
    value: 'Strategy',
  }],
} as const satisfies MatchInputs

const crossDimensionSubstituteInputs = {
  candidateFacts: [{ id: 'fact-degree', kind: 'education', value: 'Master of Science' }],
  proposedEvidence: [createEvidence({
    coverage: 'covered',
    factId: 'fact-degree',
    requirementId: 'requirement-degree',
    term: 'Master of Science',
  })],
  relevantFactIds: ['fact-degree'],
  requirements: [
    {
      capability: { dimension: 'technical-expertise', name: 'Master of Science' },
      id: 'requirement-degree',
      importance: 'critical',
      sourceExcerpt: 'A Master of Science or equivalent experience is required.',
      substitutableGroup: 'degree-or-equivalent-experience',
      value: 'Master of Science',
    },
    {
      capability: { dimension: 'execution', name: 'Equivalent experience' },
      id: 'requirement-equivalent-experience',
      importance: 'critical',
      sourceExcerpt: 'A Master of Science or equivalent experience is required.',
      substitutableGroup: 'degree-or-equivalent-experience',
      value: 'Equivalent experience',
    },
  ],
} as const satisfies MatchInputs

const complementaryCapabilities = ['French', 'Mentoring', 'FinOps', 'Hiring'] as const
const complementaryCapInputs = {
  ...weightedMatchInputs,
  requirements: [
    requirements[0],
    ...complementaryCapabilities.map((capabilityName, capabilityIndex) => ({
      capability: { dimension: 'technical-expertise' as const, name: capabilityName },
      id: `requirement-complementary-${String(capabilityIndex)}`,
      importance: 'complementary' as const,
      sourceExcerpt: `${capabilityName} is a plus.`,
      value: capabilityName,
    })),
  ],
} as const satisfies MatchInputs

const allComplementaryInputs = {
  candidateFacts: [{ id: 'fact-french', kind: 'language', value: 'French' }],
  proposedEvidence: [createEvidence({
    coverage: 'covered',
    factId: 'fact-french',
    requirementId: 'requirement-french',
    term: 'French',
  })],
  relevantFactIds: ['fact-french'],
  requirements: [requirements[1]],
} as const satisfies MatchInputs

const limitedTypeScriptFacts = [{
  id: 'fact-typescript',
  kind: 'skill',
  value: '3 years of TypeScript',
}] as const satisfies readonly CandidateFact[]
const criticalTypeScriptRequirement = {
  capability: { dimension: 'technical-expertise', name: 'TypeScript' },
  id: 'requirement-typescript',
  importance: 'critical',
  sourceExcerpt: '5 years of TypeScript are required.',
  value: '5 years of TypeScript',
} as const satisfies JobRequirement

const incompleteFullCoverageInputs = {
  candidateFacts: limitedTypeScriptFacts,
  proposedEvidence: [coveredTypeScriptEvidence],
  relevantFactIds: ['fact-typescript'],
  requirements: [criticalTypeScriptRequirement],
} as const satisfies MatchInputs

const partialCriticalCoverageInputs = {
  ...incompleteFullCoverageInputs,
  proposedEvidence: [createEvidence({
    coverage: 'partially-covered',
    factId: 'fact-typescript',
    requirementId: 'requirement-typescript',
    term: 'TypeScript',
  })],
} as const satisfies MatchInputs

const falseExactSynonymInputs = {
  candidateFacts: [{ id: 'fact-typescript', kind: 'skill', value: 'Used TypeScript' }],
  proposedEvidence: [{
    coverage: 'covered',
    factMatches: [{
      factId: 'fact-typescript',
      factTerm: 'TypeScript',
      relationship: 'exact',
      requirementTerm: 'TS',
    }],
    requirementId: 'requirement-typescript',
  }],
  relevantFactIds: ['fact-typescript'],
  requirements: [{
    capability: { dimension: 'technical-expertise', name: 'TypeScript' },
    id: 'requirement-typescript',
    importance: 'central',
    sourceExcerpt: 'TS is required.',
    value: 'Know TS',
  }],
} as const satisfies MatchInputs

const coveredCriticalDuplicateInputs = {
  ...weightedMatchInputs,
  requirements: [
    { ...requirements[0], importance: 'critical' },
    {
      capability: { dimension: 'technical-expertise', name: 'typescript' },
      id: 'requirement-typescript-duplicate',
      importance: 'critical',
      sourceExcerpt: 'TypeScript is mandatory.',
      value: 'Know TypeScript',
    },
  ],
} as const satisfies MatchInputs

function createEvidence({ coverage, factId, requirementId, term }: Readonly<{
  coverage: ProposedMatchEvidence['coverage']
  factId: string
  requirementId: string
  term: string
}>): ProposedMatchEvidence {
  return {
    coverage,
    factMatches: [{
      factId,
      factTerm: term,
      relationship: 'exact',
      requirementTerm: term,
    }],
    requirementId,
  }
}

function createRoleNeutralExperienceInputs({ capabilityName, factValue, term }: Readonly<{
  capabilityName: string
  factValue: string
  term: string
}>): MatchInputs {
  const factId = 'fact-role-neutral'
  const requirementId = 'requirement-role-neutral'
  return {
    candidateFacts: [{ id: factId, kind: 'experience', value: factValue }],
    proposedEvidence: [createEvidence({
      coverage: 'covered',
      factId,
      requirementId,
      term,
    })],
    relevantFactIds: [factId],
    requirements: [createRoleNeutralRequirement({ capabilityName, requirementId, term })],
  }
}

function createRoleNeutralRequirement({ capabilityName, requirementId, term }: Readonly<{
  capabilityName: string
  requirementId: string
  term: string
}>): JobRequirement {
  return {
    capability: { dimension: 'execution', name: capabilityName },
    id: requirementId,
    importance: 'central',
    sourceExcerpt: `${capabilityName} is required.`,
    value: term,
  }
}
