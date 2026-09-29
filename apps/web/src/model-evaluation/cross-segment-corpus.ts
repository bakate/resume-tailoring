import {
  createQualificationFixture,
  type QualificationCorpus,
  type QualificationRoleFamily,
} from './cross-segment-qualification'

const roleTerms = {
  technology: ['TypeScript', 'Kubernetes', 'data pipelines', 'threat modeling', 'incident response'],
  'general-management': ['operating plans', 'budget ownership', 'people leadership', 'program delivery', 'process improvement'],
  sales: ['pipeline development', 'account planning', 'discovery calls', 'quota ownership', 'commercial negotiation'],
} as const satisfies Record<QualificationRoleFamily, readonly string[]>

export const crossSegmentQualificationCorpus: QualificationCorpus = {
  id: 'cross-segment-qualification-v1',
  fixtures: [
    ...createRoleFixtures({ count: 30, roleFamily: 'technology', heldOutCount: 10 }),
    ...createRoleFixtures({ count: 20, roleFamily: 'general-management', heldOutCount: 6 }),
    ...createRoleFixtures({ count: 20, roleFamily: 'sales', heldOutCount: 6 }),
  ],
}

function createRoleFixtures({
  count,
  heldOutCount,
  roleFamily,
}: Readonly<{
  count: number
  heldOutCount: number
  roleFamily: QualificationRoleFamily
}>) {
  return Array.from({ length: count }, (unusedFixture, fixtureIndex) => {
    void unusedFixture
    const requirementTerm = roleTerms[roleFamily][fixtureIndex % roleTerms[roleFamily].length] ?? roleFamily
    const factId = `${roleFamily}-fact-${String(fixtureIndex).padStart(2, '0')}`
    const isCriticalPartialFixture = roleFamily === 'technology' && fixtureIndex === 0
    const requirementValue = isCriticalPartialFixture ? `5 years of ${requirementTerm}` : requirementTerm
    return createQualificationFixture({
      candidateFacts: [{
        id: factId,
        kind: 'experience',
        value: isCriticalPartialFixture ? `Delivered 3 years of ${requirementTerm}.` : `Delivered ${requirementTerm}.`,
      }],
      coverage: isCriticalPartialFixture ? 'partially-covered' : 'covered',
      expectedCriticalReserveRequirementIds: isCriticalPartialFixture ? [`technology-01-requirement`] : [],
      expectedMatchScoreRange: isCriticalPartialFixture ? { maximum: 50, minimum: 50 } : undefined,
      importance: isCriticalPartialFixture ? 'critical' : undefined,
      index: fixtureIndex + 1,
      requirementTerm,
      requirementValue,
      roleFamily,
      split: fixtureIndex < count - heldOutCount ? 'development' : 'held-out',
    })
  })
}
