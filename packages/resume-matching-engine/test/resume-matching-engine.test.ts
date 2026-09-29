import { describe, expect, it } from 'vitest'

import {
  analyzeResumeMatch,
  type CandidateFact,
  type MatchRequirement,
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
    const result = analyzeResumeMatch({
      candidateFacts,
      proposedEvidence: [createEvidence({
        coverage: 'covered',
        factId: 'fact-typescript',
        requirementId: 'requirement-typescript',
        term: 'TypeScript',
      })],
      relevantFactIds: ['fact-typescript'],
      requirements,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      generationEligibility: 'eligible',
      matchBand: 'strong',
      matchScore: 75,
    })
  })

  it('groups normalized duplicate capabilities before scoring', () => {
    const result = analyzeResumeMatch({
      candidateFacts,
      proposedEvidence: [createEvidence({
        coverage: 'covered',
        factId: 'fact-typescript',
        requirementId: 'requirement-typescript',
        term: 'TypeScript',
      })],
      relevantFactIds: ['fact-typescript'],
      requirements: [
        requirements[0],
        {
          capability: { dimension: 'technical-expertise', name: '  TYPESCRIPT  ' },
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
    })

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

  it('caps complementary requirements at 25 percent of effective weight', () => {
    const complementaryCapabilities = ['French', 'Mentoring', 'FinOps', 'Hiring'] as const
    const result = analyzeResumeMatch({
      candidateFacts,
      proposedEvidence: [createEvidence({
        coverage: 'covered',
        factId: 'fact-typescript',
        requirementId: 'requirement-typescript',
        term: 'TypeScript',
      })],
      relevantFactIds: ['fact-typescript'],
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
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(75)
  })

  it('rejects full coverage when evidence has the same capability at incomplete scope', () => {
    const result = analyzeResumeMatch({
      candidateFacts: [{
        id: 'fact-typescript',
        kind: 'skill',
        value: '3 years of TypeScript',
      }],
      proposedEvidence: [createEvidence({
        coverage: 'covered',
        factId: 'fact-typescript',
        requirementId: 'requirement-typescript',
        term: 'TypeScript',
      })],
      relevantFactIds: ['fact-typescript'],
      requirements: [{
        capability: { dimension: 'technical-expertise', name: 'TypeScript' },
        id: 'requirement-typescript',
        importance: 'critical',
        sourceExcerpt: '5 years of TypeScript are required.',
        value: '5 years of TypeScript',
      }],
    })

    expect(result).toEqual({
      error: { type: 'invalid-match-input' },
      ok: false,
    })
  })

  it('grants partial coverage and raises a reserve for an incompletely covered critical requirement', () => {
    const result = analyzeResumeMatch({
      candidateFacts: [{
        id: 'fact-typescript',
        kind: 'skill',
        value: '3 years of TypeScript',
      }],
      proposedEvidence: [createEvidence({
        coverage: 'partially-covered',
        factId: 'fact-typescript',
        requirementId: 'requirement-typescript',
        term: 'TypeScript',
      })],
      relevantFactIds: ['fact-typescript'],
      requirements: [{
        capability: { dimension: 'technical-expertise', name: 'TypeScript' },
        id: 'requirement-typescript',
        importance: 'critical',
        sourceExcerpt: '5 years of TypeScript are required.',
        value: '5 years of TypeScript',
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      criticalRequirementReserve: {
        requirementIds: ['requirement-typescript'],
        status: 'present',
      },
      generationEligibility: 'eligible',
      matchBand: 'credible',
      matchScore: 50,
    })
  })

  it('rejects a controlled synonym when the proposal claims an exact relationship', () => {
    const result = analyzeResumeMatch({
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
    })

    expect(result).toEqual({
      error: { type: 'invalid-match-input' },
      ok: false,
    })
  })

  it('clears the Critical Requirement Reserve when a grouped duplicate is covered', () => {
    const result = analyzeResumeMatch({
      candidateFacts,
      proposedEvidence: [createEvidence({
        coverage: 'covered',
        factId: 'fact-typescript',
        requirementId: 'requirement-typescript',
        term: 'TypeScript',
      })],
      relevantFactIds: ['fact-typescript'],
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
    })

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
] as const satisfies readonly MatchRequirement[]

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
