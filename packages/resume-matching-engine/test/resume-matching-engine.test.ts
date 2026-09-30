import { describe, expect, it } from 'vitest'

import {
  analyzeResumeMatch,
  type CandidateFact,
  type JobRequirement,
  type ProposedMatchEvidence,
  validateRelevantFactProposals,
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

  it('validates relevance independently from requirement coverage', () => {
    const result = validateRelevantFactProposals({
      candidateFacts,
      proposals: [{
        factMatch: { factExcerpt: 'TypeScript', factId: 'fact-typescript', requirementExcerpt: 'TypeScript' },
        requirementId: 'requirement-typescript',
      }],
      requirements,
    })

    expect(result).toEqual(['fact-typescript'])
  })

  it('discards only the relevance proposals whose excerpts are not verbatim', () => {
    const result = validateRelevantFactProposals({
      candidateFacts: [...candidateFacts, { id: 'fact-french', kind: 'language', value: 'Français courant' }],
      proposals: [
        {
          factMatch: { factExcerpt: 'Rust', factId: 'fact-typescript', requirementExcerpt: 'TypeScript' },
          requirementId: 'requirement-typescript',
        },
        {
          factMatch: { factExcerpt: 'Français', factId: 'fact-french', requirementExcerpt: 'French' },
          requirementId: 'requirement-french',
        },
      ],
      requirements,
    })

    expect(result).toEqual(['fact-french'])
  })

  it.each([
    "maîtrise de l'anglais un atout.",
    "l'anglais est souhaité",
    'anglais : un plus',
    "maîtrise de l'anglais technique",
  ])('accepts a requirement excerpt quoted from a longer requirement: %s', (value) => {
    const result = validateRelevantFactProposals({
      candidateFacts: [{ id: 'fact-english', kind: 'language', value: 'Anglais' }],
      proposals: [{
        factMatch: { factExcerpt: 'Anglais', factId: 'fact-english', requirementExcerpt: 'anglais' },
        requirementId: 'requirement-english',
      }],
      requirements: [{
        capability: { dimension: 'technical-expertise', name: 'Anglais' }, id: 'requirement-english',
        importance: 'complementary', sourceExcerpt: value, value,
      }],
    })

    expect(result).toEqual(['fact-english'])
  })

  it('covers a reformulated capability with verbatim excerpts from both sides', () => {
    const result = analyzeResumeMatch(reformulatedCapabilityInputs)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      evidence: [{ coverage: 'covered', factIds: ['fact-nextjs'], requirementId: 'requirement-web-applications' }],
      matchScore: 100,
      relevantFactIds: ['fact-nextjs'],
    })
  })

  it('covers a translated capability without a controlled-term alias table', () => {
    const result = analyzeResumeMatch({
      ...translatedLanguageInputs,
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt: 'Français courant', factId: 'fact-french',
        requirementExcerpt: 'French', requirementId: 'requirement-french',
      })],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.matchScore).toBe(25)
  })

  it.each([
    { case: 'a fact excerpt absent from the Candidate Fact', factExcerpt: 'Angular', requirementExcerpt: 'French' },
    { case: 'a requirement excerpt absent from the Job Requirement', factExcerpt: 'Français', requirementExcerpt: 'English' },
    { case: 'a partial word', factExcerpt: 'Franç', requirementExcerpt: 'French' },
  ])('rejects $case', ({ factExcerpt, requirementExcerpt }) => {
    const result = analyzeResumeMatch({
      ...translatedLanguageInputs,
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt, factId: 'fact-french',
        requirementExcerpt, requirementId: 'requirement-french',
      })],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ evidence: [], matchScore: 0 })
  })

  it.each([
    {
      case: 'a negated fact',
      fact: { id: 'fact-trap', kind: 'experience', value: 'No production experience with React' },
      factExcerpt: 'React', requirementExcerpt: 'React', requirementValue: 'Build interfaces with React',
    },
    {
      case: 'a role title offered as proof',
      fact: { id: 'fact-trap', kind: 'experience', value: 'Senior TypeScript Developer at Acme' },
      factExcerpt: 'TypeScript Developer', requirementExcerpt: 'TypeScript', requirementValue: 'Know TypeScript',
    },
    {
      case: 'an explicit duration the fact does not reach',
      fact: { id: 'fact-trap', kind: 'experience', value: '5 years of Java. Used TypeScript' },
      factExcerpt: 'Used TypeScript', requirementExcerpt: 'TypeScript', requirementValue: '5 years of TypeScript',
    },
    {
      case: 'an explicit scale the fact does not reach',
      fact: { id: 'fact-trap', kind: 'experience', value: 'Operated a platform serving 20k users' },
      factExcerpt: 'Operated a platform', requirementExcerpt: 'Operate a platform',
      requirementValue: 'Operate a platform serving 1 million users',
    },
  ] as const)('rejects covered evidence from $case', ({ fact, factExcerpt, requirementExcerpt, requirementValue }) => {
    const result = analyzeResumeMatch({
      candidateFacts: [fact],
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt, factId: fact.id, requirementExcerpt, requirementId: 'requirement-trap',
      })],
      relevantFactIds: [],
      requirements: [createRoleNeutralRequirement({
        capabilityName: requirementExcerpt, requirementId: 'requirement-trap', term: requirementValue,
      })],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ evidence: [], matchScore: 0, relevantFactIds: [] })
  })

  it.each([
    { factValue: 'Built TypeScript services', requirementValue: 'Senior TypeScript engineering' },
    { factValue: 'Built TypeScript services', requirementValue: 'TypeScript in production' },
    { factValue: 'Junior TypeScript engineering', requirementValue: 'Lead TypeScript engineering' },
  ])('downgrades covered evidence to partial coverage when the fact lacks the qualifier in "$requirementValue"', ({
    factValue, requirementValue,
  }) => {
    const result = analyzeResumeMatch({
      candidateFacts: [{ id: 'fact-typescript', kind: 'experience', value: factValue }],
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt: 'TypeScript', factId: 'fact-typescript',
        requirementExcerpt: 'TypeScript', requirementId: 'requirement-typescript',
      })],
      relevantFactIds: ['fact-typescript'],
      requirements: [{ ...requirements[0], value: requirementValue }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      evidence: [{ coverage: 'partially-covered', factIds: ['fact-typescript'] }],
      matchScore: 50,
    })
  })

  it('keeps full coverage when the fact shows a higher career level than required', () => {
    const result = analyzeResumeMatch({
      candidateFacts: [{ id: 'fact-typescript', kind: 'experience', value: 'Led TypeScript engineering as staff engineer' }],
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt: 'TypeScript engineering as staff engineer', factId: 'fact-typescript',
        requirementExcerpt: 'TypeScript engineering', requirementId: 'requirement-typescript',
      })],
      relevantFactIds: ['fact-typescript'],
      requirements: [{ ...requirements[0], value: 'Senior TypeScript engineering' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.evidence).toMatchObject([{ coverage: 'covered' }])
  })

  it('accepts partial coverage for a behavioral capability that a role only implies', () => {
    const result = analyzeResumeMatch({
      candidateFacts: [{ id: 'fact-delivery', kind: 'experience', value: 'Coordinated weekly releases with product managers' }],
      proposedEvidence: [createEvidence({
        coverage: 'partially-covered', factExcerpt: 'Coordinated weekly releases with product managers',
        factId: 'fact-delivery', requirementExcerpt: 'stakeholder communication', requirementId: 'requirement-communication',
      })],
      relevantFactIds: [],
      requirements: [createRoleNeutralRequirement({
        capabilityName: 'Stakeholder communication', requirementId: 'requirement-communication',
        term: 'Strong stakeholder communication',
      })],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ matchScore: 50, relevantFactIds: ['fact-delivery'] })
  })

  it.each([
    {
      case: 'a career level stated before a relative clause',
      factExcerpt: 'built Next.js web applications', factValue: 'Senior engineer who built Next.js web applications',
      requirementValue: 'Senior web application development',
    },
    {
      case: 'a requirement that uses "lead" as a verb',
      factExcerpt: 'Next.js web applications', factValue: 'Maintained Next.js web applications',
      requirementValue: 'Lead the development of a web application',
    },
    {
      case: 'a negation that follows the cited excerpt',
      factExcerpt: 'Shipped Next.js web applications', factValue: 'Shipped Next.js web applications without downtime',
      requirementValue: 'Build a web application',
    },
    {
      case: 'a negation in another clause of the fact',
      factExcerpt: 'Next.js web applications', factValue: 'Built Next.js web applications, never with Angular',
      requirementValue: 'Build a web application',
    },
  ])('keeps full coverage for $case', ({ factExcerpt, factValue, requirementValue }) => {
    const result = analyzeResumeMatch({
      candidateFacts: [{ id: 'fact-web', kind: 'experience', value: factValue }],
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt, factId: 'fact-web',
        requirementExcerpt: 'web application', requirementId: 'requirement-web',
      })],
      relevantFactIds: [],
      requirements: [createRoleNeutralRequirement({
        capabilityName: 'Web application development', requirementId: 'requirement-web', term: requirementValue,
      })],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.evidence).toMatchObject([{ coverage: 'covered', factIds: ['fact-web'] }])
  })

  it.each([
    {
      case: 'a duration range whose lower bound the fact reaches',
      factExcerpt: '4 years of TypeScript', factValue: '4 years of TypeScript',
      requirementExcerpt: 'TypeScript', requirementValue: '3-5 years of TypeScript',
    },
    {
      case: 'a duration range written with words',
      factExcerpt: '4 years of TypeScript', factValue: '4 years of TypeScript',
      requirementExcerpt: 'TypeScript', requirementValue: '3 to 5 years of TypeScript',
    },
    {
      case: 'a scale written with a thousands separator',
      factExcerpt: 'Operated a platform', factValue: 'Operated a platform serving 20,000 users',
      requirementExcerpt: 'Operate a platform', requirementValue: 'Operate a platform serving 5k users',
    },
    {
      case: 'a scale written with a thousands space',
      factExcerpt: 'Operated a platform serving 20 000 users', factValue: 'Operated a platform serving 20 000 users',
      requirementExcerpt: 'Operate a platform', requirementValue: 'Operate a platform serving 5k users',
    },
  ])('keeps full coverage for $case', ({ factExcerpt, factValue, requirementExcerpt, requirementValue }) => {
    const result = analyzeResumeMatch({
      candidateFacts: [{ id: 'fact-quantity', kind: 'experience', value: factValue }],
      proposedEvidence: [createEvidence({
        coverage: 'covered', factExcerpt, factId: 'fact-quantity',
        requirementExcerpt, requirementId: 'requirement-quantity',
      })],
      relevantFactIds: [],
      requirements: [createRoleNeutralRequirement({
        capabilityName: requirementExcerpt, requirementId: 'requirement-quantity', term: requirementValue,
      })],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.evidence).toMatchObject([{ coverage: 'covered', factIds: ['fact-quantity'] }])
  })

  it('ignores duplicate relevant Candidate Facts instead of rejecting the Match Analysis', () => {
    const result = analyzeResumeMatch({
      ...weightedMatchInputs,
      relevantFactIds: ['fact-typescript', 'fact-typescript'],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.relevantFactIds).toEqual(['fact-typescript'])
  })

  it('discards each invalid evidence proposal and keeps the rest of the Match Analysis', () => {
    const result = analyzeResumeMatch({
      ...reformulatedCapabilityInputs,
      proposedEvidence: [
        createEvidence({
          coverage: 'covered', factExcerpt: 'invented excerpt', factId: 'fact-nextjs',
          requirementExcerpt: 'web applications', requirementId: 'requirement-web-applications',
        }),
        ...reformulatedCapabilityInputs.proposedEvidence,
        createEvidence({
          coverage: 'covered', factExcerpt: 'Next.js', factId: 'fact-unknown',
          requirementExcerpt: 'web applications', requirementId: 'requirement-web-applications',
        }),
        createEvidence({
          coverage: 'covered', factExcerpt: 'Next.js', factId: 'fact-nextjs',
          requirementExcerpt: 'web applications', requirementId: 'requirement-unknown',
        }),
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      evidence: [{ coverage: 'covered', factIds: ['fact-nextjs'], requirementId: 'requirement-web-applications' }],
      matchScore: 100,
    })
  })

  it('rejects a proposal that cites the same Candidate Fact twice for one requirement', () => {
    const [proposal] = reformulatedCapabilityInputs.proposedEvidence
    const result = analyzeResumeMatch({
      ...reformulatedCapabilityInputs,
      proposedEvidence: [{ ...proposal, factMatches: [...proposal.factMatches, ...proposal.factMatches] }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ evidence: [], matchScore: 0 })
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

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ evidence: [], matchScore: 0 })
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
      capability: { dimension: 'technical-expertise', name: 'Typescript' },
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

const reformulatedCapabilityInputs = {
  candidateFacts: [{
    id: 'fact-nextjs',
    kind: 'experience',
    value: 'Delivered end-to-end Next.js features from database schema to deployed interface',
  }],
  proposedEvidence: [createEvidence({
    coverage: 'covered',
    factExcerpt: 'end-to-end Next.js features',
    factId: 'fact-nextjs',
    requirementExcerpt: 'design, build and maintain web applications',
    requirementId: 'requirement-web-applications',
  })],
  relevantFactIds: [],
  requirements: [{
    capability: { dimension: 'execution', name: 'Web application development' },
    id: 'requirement-web-applications',
    importance: 'central',
    sourceExcerpt: 'You will design, build and maintain web applications.',
    value: 'Design, build and maintain web applications',
  }],
} as const satisfies MatchInputs

const translatedLanguageInputs = {
  candidateFacts: [{ id: 'fact-french', kind: 'language', value: 'Français courant' }],
  proposedEvidence: [],
  relevantFactIds: [],
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

function createEvidence({
  coverage, factExcerpt, factId, requirementExcerpt, requirementId, term,
}: Readonly<{
  coverage: ProposedMatchEvidence['coverage']
  factExcerpt?: string
  factId: string
  requirementExcerpt?: string
  requirementId: string
  term?: string
}>): ProposedMatchEvidence {
  return {
    coverage,
    factMatches: [{
      factExcerpt: factExcerpt ?? term ?? '',
      factId,
      requirementExcerpt: requirementExcerpt ?? term ?? '',
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
