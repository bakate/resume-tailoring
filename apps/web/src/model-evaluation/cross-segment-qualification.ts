import {
  analyzeResumeMatch,
  type CandidateFact,
  type JobRequirement,
  type MatchEvidence,
  type ProposedMatchEvidence,
  type RequirementCoverage,
  type RequirementImportance,
} from '@resume-tailoring/application/matching-engine'

export const qualificationRoleFamilies = [
  'technology', 'general-management', 'sales',
] as const
export const qualificationSplits = ['development', 'held-out'] as const

export type QualificationRoleFamily = typeof qualificationRoleFamilies[number]
export type QualificationSplit = typeof qualificationSplits[number]

export type QualificationFixture = Readonly<{
  candidateFacts: readonly CandidateFact[]
  expectedCriticalReserveRequirementIds: readonly string[]
  expectedMatchEvidence: readonly MatchEvidence[]
  expectedMatchScoreRange: Readonly<{ maximum: number; minimum: number }>
  expectedRequirementGroups: readonly (readonly string[])[]
  expectedRequirements: readonly JobRequirement[]
  extractedRequirements: readonly JobRequirement[]
  id: string
  language: 'en' | 'fr'
  jobPosting: string
  roleTitle: string
  scenarioTags: readonly string[]
  prohibitedMatches: readonly Readonly<{ factId: string; requirementId: string }>[]
  proposedEvidence: readonly ProposedMatchEvidence[]
  relevantFactIds: readonly string[]
  roleFamily: QualificationRoleFamily
  sourceDocument: string
  split: QualificationSplit
  writingClaimsSupported: boolean
  exportablePdf: boolean
  generalManagement?: Readonly<{
    ambiguity: 'none' | 'scope' | 'seniority' | 'ownership'
    constraints: readonly string[]
    domain: 'operations' | 'finance' | 'hr' | 'program-leadership' | 'cross-functional'
    language: 'en' | 'fr'
    profile: 'operator' | 'functional-leader' | 'program-leader' | 'executive'
    scenario: 'strong-match' | 'partial-match' | 'critical-gap' | 'wishlist' | 'transferable-capability'
  }>
}>

export type QualificationCorpus = Readonly<{
  fixtures: readonly QualificationFixture[]
  id: string
}>

export type QualificationThresholds = Readonly<{
  extractionRecall: number
  extractionPrecision: number
  matchEvidencePrecision: number
  meanMatchScoreError: number
  maximumMatchScoreError: number
  pdfExportValidity: number
  provenanceSafety: number
  validEvidenceRecall: number
}>

export type QualificationGate = Readonly<{
  passed: boolean
  threshold: number
  value: number
}>

export type QualificationReport = Readonly<{
  corpusId: string
  heldOutFixtureCount: number
  overall: Readonly<Record<keyof QualificationThresholds, QualificationGate>>
  passed: boolean
  roleFamilies: Readonly<Record<QualificationRoleFamily,
    Readonly<Record<keyof QualificationThresholds, QualificationGate>>>>
  split: QualificationSplit
}>

export const crossSegmentQualificationThresholds = {
  extractionPrecision: 0.95,
  extractionRecall: 0.95,
  matchEvidencePrecision: 0.98,
  meanMatchScoreError: 5,
  maximumMatchScoreError: 10,
  pdfExportValidity: 1,
  provenanceSafety: 1,
  validEvidenceRecall: 0.9,
} as const satisfies QualificationThresholds

export function qualifyCrossSegmentCorpus({
  corpus,
  split,
  thresholds = crossSegmentQualificationThresholds,
}: Readonly<{
  corpus: QualificationCorpus
  split: QualificationSplit
  thresholds?: QualificationThresholds
}>): QualificationReport {
  const fixtures = corpus.fixtures.filter((fixture) => fixture.split === split)
  const overall = createGates({ fixtures, thresholds })
  const roleFamilies = Object.fromEntries(qualificationRoleFamilies.map((roleFamily) => [
    roleFamily,
    createGates({
      fixtures: fixtures.filter((fixture) => fixture.roleFamily === roleFamily), thresholds,
    }),
  ])) as QualificationReport['roleFamilies']
  return {
    corpusId: corpus.id,
    heldOutFixtureCount: corpus.fixtures.filter(({ split: fixtureSplit }) => fixtureSplit === 'held-out').length,
    overall,
    passed: [overall, ...Object.values(roleFamilies)].every(hasPassedGates),
    roleFamilies,
    split,
  }
}

function createGates({ fixtures, thresholds }: Readonly<{
  fixtures: readonly QualificationFixture[]
  thresholds: QualificationThresholds
}>) {
  const measurements = fixtures.map(createFixtureMeasurement)
  return {
    extractionRecall: createMinimumGate({
      threshold: thresholds.extractionRecall, value: calculateExtractionRecall({ fixtures }),
    }),
    extractionPrecision: createMinimumGate({
      threshold: thresholds.extractionPrecision, value: calculateExtractionPrecision({ fixtures }),
    }),
    matchEvidencePrecision: createMinimumGate({
      threshold: thresholds.matchEvidencePrecision,
      value: calculateEvidencePrecision({ measurements }),
    }),
    meanMatchScoreError: createMaximumGate({
      threshold: thresholds.meanMatchScoreError, value: calculateMeanScoreError({ measurements }),
    }),
    maximumMatchScoreError: createMaximumGate({
      threshold: thresholds.maximumMatchScoreError, value: calculateMaximumScoreError({ measurements }),
    }),
    pdfExportValidity: createMinimumGate({
      threshold: thresholds.pdfExportValidity, value: calculateRate({
        values: fixtures.map(({ exportablePdf }) => exportablePdf),
      }),
    }),
    provenanceSafety: createMinimumGate({
      threshold: thresholds.provenanceSafety, value: calculateRate({
        values: fixtures.map(({ writingClaimsSupported }) => writingClaimsSupported),
      }),
    }),
    validEvidenceRecall: createMinimumGate({
      threshold: thresholds.validEvidenceRecall, value: calculateValidEvidenceRecall({ measurements }),
    }),
  } as const
}

function createFixtureMeasurement(fixture: QualificationFixture) {
  const result = analyzeResumeMatch({
    candidateFacts: fixture.candidateFacts,
    proposedEvidence: fixture.proposedEvidence,
    relevantFactIds: fixture.relevantFactIds,
    requirements: fixture.expectedRequirements,
  })
  return { fixture, result }
}

type FixtureMeasurement = ReturnType<typeof createFixtureMeasurement>

function calculateExtractionRecall({ fixtures }: Readonly<{ fixtures: readonly QualificationFixture[] }>) {
  const expectedCount = fixtures.reduce((total, fixture) => total + fixture.expectedRequirements.length, 0)
  const matchedCount = fixtures.reduce((total, fixture) => total + countMatchingRequirements({
    expectedRequirements: fixture.expectedRequirements, extractedRequirements: fixture.extractedRequirements,
  }), 0)
  return calculateRatio({ numerator: matchedCount, denominator: expectedCount })
}

function calculateExtractionPrecision({ fixtures }: Readonly<{ fixtures: readonly QualificationFixture[] }>) {
  const extractedCount = fixtures.reduce((total, fixture) => total + fixture.extractedRequirements.length, 0)
  const matchedCount = fixtures.reduce((total, fixture) => total + countMatchingRequirements({
    expectedRequirements: fixture.expectedRequirements, extractedRequirements: fixture.extractedRequirements,
  }), 0)
  return calculateRatio({ numerator: matchedCount, denominator: extractedCount })
}

function countMatchingRequirements({ expectedRequirements, extractedRequirements }: Readonly<{
  expectedRequirements: readonly JobRequirement[]
  extractedRequirements: readonly JobRequirement[]
}>) {
  const expectedIds = new Set(expectedRequirements.map(({ id }) => id))
  return extractedRequirements.filter(({ id }) => expectedIds.has(id)).length
}

function calculateEvidencePrecision({ measurements }: Readonly<{ measurements: readonly FixtureMeasurement[] }>) {
  const proposedCount = measurements.reduce((total, { fixture }) => total + fixture.proposedEvidence.length, 0)
  const validCount = measurements.filter(isAcceptedMeasurement).reduce((total, { fixture }) =>
    total + fixture.proposedEvidence.length, 0)
  return calculateRatio({ numerator: validCount, denominator: proposedCount })
}

function calculateValidEvidenceRecall({ measurements }: Readonly<{ measurements: readonly FixtureMeasurement[] }>) {
  const expectedCount = measurements.reduce((total, { fixture }) => total + fixture.proposedEvidence.length, 0)
  const validCount = measurements.filter(isAcceptedMeasurement).reduce((total, { fixture }) =>
    total + fixture.proposedEvidence.length, 0)
  return calculateRatio({ numerator: validCount, denominator: expectedCount })
}

function calculateMeanScoreError({ measurements }: Readonly<{ measurements: readonly FixtureMeasurement[] }>) {
  if (measurements.length === 0) return 0
  return measurements.reduce((total, measurement) => total + readScoreError(measurement), 0) / measurements.length
}

function calculateMaximumScoreError({ measurements }: Readonly<{ measurements: readonly FixtureMeasurement[] }>) {
  return measurements.reduce((maximum, measurement) => Math.max(maximum, readScoreError(measurement)), 0)
}

function readScoreError({ fixture, result }: FixtureMeasurement) {
  if (!result.ok || !isAcceptedMeasurement({ fixture, result })) return 100
  if (result.value.matchScore < fixture.expectedMatchScoreRange.minimum) {
    return fixture.expectedMatchScoreRange.minimum - result.value.matchScore
  }
  if (result.value.matchScore > fixture.expectedMatchScoreRange.maximum) {
    return result.value.matchScore - fixture.expectedMatchScoreRange.maximum
  }
  return 0
}

function isAcceptedMeasurement({ fixture, result }: FixtureMeasurement) {
  if (!result.ok) return false
  const expectedReserve = [...fixture.expectedCriticalReserveRequirementIds].sort()
  const actualReserve = [...result.value.criticalRequirementReserve.requirementIds].sort()
  const hasExpectedReserve = JSON.stringify(expectedReserve) === JSON.stringify(actualReserve)
  const hasExpectedEvidence = fixture.expectedMatchEvidence.length === result.value.evidence.length
    && fixture.expectedMatchEvidence.every((expectedEvidence) => result.value.evidence.some((actualEvidence) =>
      actualEvidence.requirementId === expectedEvidence.requirementId
      && actualEvidence.coverage === expectedEvidence.coverage
      && JSON.stringify([...actualEvidence.factIds].sort()) === JSON.stringify([...expectedEvidence.factIds].sort())))
  const actualGroups = result.value.requirementGroups.map(({ requirementIds }) => requirementIds)
  const hasExpectedGroups = JSON.stringify(fixture.expectedRequirementGroups) === JSON.stringify(actualGroups)
  const scoreIsAcceptable = result.value.matchScore >= fixture.expectedMatchScoreRange.minimum
    && result.value.matchScore <= fixture.expectedMatchScoreRange.maximum
  const prohibitedMatchFound = result.value.evidence.some(({ requirementId, factIds }) =>
    fixture.prohibitedMatches.some((prohibitedMatch) => prohibitedMatch.requirementId === requirementId
      && factIds.includes(prohibitedMatch.factId)))
  return hasExpectedReserve && hasExpectedEvidence && hasExpectedGroups && scoreIsAcceptable && !prohibitedMatchFound
}

function calculateRate({ values }: Readonly<{ values: readonly boolean[] }>) {
  return calculateRatio({ numerator: values.filter(Boolean).length, denominator: values.length })
}

function calculateRatio({ denominator, numerator }: Readonly<{ denominator: number; numerator: number }>) {
  if (denominator === 0) return 1
  return Number((numerator / denominator).toFixed(4))
}

function createMinimumGate({ threshold, value }: Readonly<{ threshold: number; value: number }>) {
  return { passed: value >= threshold, threshold, value } as const
}

function createMaximumGate({ threshold, value }: Readonly<{ threshold: number; value: number }>) {
  return { passed: value <= threshold, threshold, value } as const
}

function hasPassedGates(gates: Readonly<Record<keyof QualificationThresholds, QualificationGate>>) {
  return Object.values(gates).every(({ passed }) => passed)
}

export function createQualificationFixture({
  candidateFacts,
  coverage = 'covered',
  expectedCriticalReserveRequirementIds = [],
  expectedMatchScoreRange = { maximum: 100, minimum: 100 },
  importance = 'central',
  index,
  language = 'en',
  requirementTerm,
  requirementValue = requirementTerm,
  roleFamily,
  roleTitle = roleFamily,
  scenarioTags = [],
  split,
  generalManagement,
  includeEvidence = true,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  coverage?: RequirementCoverage
  expectedCriticalReserveRequirementIds?: readonly string[]
  expectedMatchScoreRange?: Readonly<{ maximum: number; minimum: number }>
  importance?: RequirementImportance
  index: number
  language?: 'en' | 'fr'
  requirementTerm: string
  requirementValue?: string
  roleFamily: QualificationRoleFamily
  roleTitle?: string
  scenarioTags?: readonly string[]
  split: QualificationSplit
  generalManagement?: QualificationFixture['generalManagement']
  includeEvidence?: boolean
}>): QualificationFixture {
  const fixtureId = `${roleFamily}-${String(index).padStart(2, '0')}`
  const requirementId = `${fixtureId}-requirement`
  const requirement = createRequirement({ importance, requirementId, requirementTerm, requirementValue })
  const fact = candidateFacts[0]
  const proposedEvidence = fact === undefined || !includeEvidence ? [] : [{
    coverage,
    factMatches: [{
      factId: fact.id, factTerm: requirementTerm, relationship: 'exact' as const, requirementTerm,
    }],
    requirementId,
  }]
  return {
    candidateFacts,
    expectedCriticalReserveRequirementIds,
    expectedMatchEvidence: proposedEvidence.map(({ coverage, factMatches, requirementId }) => ({
      coverage, factIds: factMatches.map(({ factId }) => factId), requirementId,
    })),
    expectedMatchScoreRange,
    expectedRequirementGroups: [[requirementId]],
    expectedRequirements: [requirement],
    extractedRequirements: [requirement],
    id: fixtureId,
    language,
    jobPosting: language === 'fr'
      ? `Le poste ${roleFamily} requiert ${requirementTerm}.`
      : `The ${roleFamily} role requires ${requirementTerm}.`,
    roleTitle,
    scenarioTags,
    prohibitedMatches: [],
    proposedEvidence,
    relevantFactIds: fact === undefined || !includeEvidence ? [] : [fact.id],
    roleFamily,
    sourceDocument: language === 'fr'
      ? `Expérience ${roleFamily} pour ${requirementTerm}.`
      : `Synthetic ${roleFamily} evidence for ${requirementTerm}.`,
    split,
    writingClaimsSupported: true,
    exportablePdf: true,
    generalManagement,
  }
}

function createRequirement({ importance, requirementId, requirementTerm, requirementValue }: Readonly<{
  importance: RequirementImportance
  requirementId: string
  requirementTerm: string
  requirementValue: string
}>): JobRequirement {
  return {
    capability: { dimension: 'execution', name: requirementTerm },
    id: requirementId,
    importance,
    sourceExcerpt: `${requirementTerm} is required.`,
    value: requirementValue,
  }
}
