import {
  createQualificationFixture,
  type QualificationCorpus,
  type QualificationRoleFamily,
} from './cross-segment-qualification'

type TechnologyScenario = Readonly<{
  language: 'en' | 'fr'
  requirementTerm: string
  roleTitle: string
  scenarioTags: readonly string[]
  coverage?: 'covered' | 'partially-covered'
  importance?: 'critical' | 'central' | 'complementary'
  hasRelevantEvidence?: boolean
}>

const roleTerms = {
  technology: ['TypeScript', 'Kubernetes', 'data pipelines', 'threat modeling', 'incident response'],
  'general-management': ['operating plans', 'budget ownership', 'people leadership', 'program delivery', 'process improvement'],
  sales: ['pipeline development', 'account planning', 'discovery calls', 'quota ownership', 'commercial negotiation'],
} as const satisfies Record<QualificationRoleFamily, readonly string[]>

// These are deliberately explicit reviewed scenarios. Keeping the scenario intent next to
// the fixture prevents the technology suite from becoming a loop over one synthetic example.
const technologyScenarios: readonly TechnologyScenario[] = [
  { language: 'en', requirementTerm: 'TypeScript', roleTitle: 'Senior Software Engineer', scenarioTags: ['short-posting', 'strong-match'] },
  { language: 'fr', requirementTerm: 'React', roleTitle: 'Ingénieur logiciel frontend', scenarioTags: ['long-posting', 'strong-match'] },
  { language: 'en', requirementTerm: 'Python data pipelines', roleTitle: 'Data Engineer', scenarioTags: ['data', 'strong-match'] },
  { language: 'fr', requirementTerm: 'SQL', roleTitle: 'Data Analyst', scenarioTags: ['data', 'partial-match'] },
  { language: 'en', requirementTerm: 'threat modeling', roleTitle: 'Application Security Engineer', scenarioTags: ['security', 'critical-gap'], importance: 'critical', coverage: 'partially-covered' },
  { language: 'fr', requirementTerm: 'réponse aux incidents', roleTitle: 'Security Engineer', scenarioTags: ['security', 'ambiguity'], coverage: 'partially-covered' },
  { language: 'en', requirementTerm: 'Kubernetes', roleTitle: 'DevOps Engineer', scenarioTags: ['devops', 'strong-match'] },
  { language: 'fr', requirementTerm: 'infrastructure as code', roleTitle: 'Ingénieur SRE', scenarioTags: ['sre', 'duplicate-requirements'] },
  { language: 'en', requirementTerm: 'observability', roleTitle: 'Site Reliability Engineer', scenarioTags: ['sre', 'overloaded-wishlist'] },
  { language: 'fr', requirementTerm: 'AWS', roleTitle: 'Cloud Platform Engineer', scenarioTags: ['devops', 'partial-match'], coverage: 'partially-covered' },
  { language: 'en', requirementTerm: 'technical roadmap ownership', roleTitle: 'Tech Lead', scenarioTags: ['tech-lead', 'leadership', 'strong-match'] },
  { language: 'fr', requirementTerm: 'mentorat d ingénieurs seniors', roleTitle: 'Tech Lead', scenarioTags: ['tech-lead', 'leadership'], coverage: 'partially-covered' },
  { language: 'en', requirementTerm: 'architecture decision records', roleTitle: 'Staff Engineer', scenarioTags: ['technical-leadership', 'strong-match'] },
  { language: 'fr', requirementTerm: 'coordination', roleTitle: 'Lead technique', scenarioTags: ['hybrid', 'stakeholder-communication'] },
  { language: 'en', requirementTerm: 'engineering team management', roleTitle: 'Engineering Manager', scenarioTags: ['engineering-manager', 'leadership'] },
  { language: 'fr', requirementTerm: 'talent development', roleTitle: 'Engineering Manager', scenarioTags: ['engineering-manager', 'partial-match'] },
  { language: 'en', requirementTerm: 'platform strategy', roleTitle: 'Head of Engineering', scenarioTags: ['head-of-engineering', 'strategy'] },
  { language: 'fr', requirementTerm: 'budget engineering', roleTitle: 'Head of Engineering', scenarioTags: ['head-of-engineering', 'critical-gap'], importance: 'critical', hasRelevantEvidence: false },
  { language: 'en', requirementTerm: 'technology strategy', roleTitle: 'CTO', scenarioTags: ['cto', 'hybrid', 'strong-match'] },
  { language: 'fr', requirementTerm: 'transformation technologique', roleTitle: 'Directeur technique', scenarioTags: ['cto', 'long-posting', 'partial-match'], coverage: 'partially-covered' },
  { language: 'en', requirementTerm: 'customer-facing solution design', roleTitle: 'Sales Engineer', scenarioTags: ['sales-engineer', 'hybrid'] },
  { language: 'fr', requirementTerm: 'présentations techniques clients', roleTitle: 'Ingénieur avant-vente', scenarioTags: ['sales-engineer', 'stakeholder-communication'] },
  { language: 'en', requirementTerm: 'security compliance', roleTitle: 'Security Architect', scenarioTags: ['security', 'unsuitable-profile'], hasRelevantEvidence: false },
  { language: 'fr', requirementTerm: 'Go', roleTitle: 'Backend Engineer', scenarioTags: ['individual-contributor', 'ambiguity'], coverage: 'partially-covered' },
  { language: 'en', requirementTerm: 'event-driven architecture', roleTitle: 'Principal Engineer', scenarioTags: ['individual-contributor', 'duplicate-requirements'] },
  { language: 'fr', requirementTerm: 'migration cloud', roleTitle: 'Cloud Architect', scenarioTags: ['hybrid', 'practical-constraint'] },
  { language: 'en', requirementTerm: 'zero-downtime delivery', roleTitle: 'Release Engineer', scenarioTags: ['devops', 'overloaded-wishlist'] },
  { language: 'fr', requirementTerm: 'gestion de crise de production', roleTitle: 'Responsable SRE', scenarioTags: ['sre', 'critical-gap'], importance: 'critical', coverage: 'partially-covered' },
  { language: 'en', requirementTerm: 'technical discovery and quota support', roleTitle: 'Sales Engineer', scenarioTags: ['sales-engineer', 'hybrid', 'partial-match'], coverage: 'partially-covered' },
  { language: 'fr', requirementTerm: 'leadership technique multi-équipes', roleTitle: 'VP Engineering', scenarioTags: ['leadership', 'hybrid', 'strong-match'] },
] as const

export const crossSegmentQualificationCorpus: QualificationCorpus = {
  id: 'cross-segment-qualification-v1',
  fixtures: [
    ...technologyScenarios.map((scenario, scenarioIndex) => createTechnologyFixture({ scenario, scenarioIndex })),
    ...createRoleFixtures({ count: 20, roleFamily: 'general-management', heldOutCount: 6 }),
    ...createRoleFixtures({ count: 20, roleFamily: 'sales', heldOutCount: 6 }),
  ],
}

function createTechnologyFixture({ scenario, scenarioIndex }: Readonly<{
  scenario: TechnologyScenario
  scenarioIndex: number
}>) {
  const fixtureIndex = scenarioIndex + 1
  const requirementId = `technology-${String(fixtureIndex).padStart(2, '0')}-requirement`
  const hasRelevantEvidence = scenario.hasRelevantEvidence ?? true
  const coverage = scenario.requirementTerm === 'threat modeling' ? 'partially-covered' : 'covered'
  const isCriticalReserve = scenario.importance === 'critical' && (coverage !== 'covered' || !hasRelevantEvidence)
  const requirementValue = coverage === 'partially-covered' ? `5 years of ${scenario.requirementTerm}` : scenario.requirementTerm
  return createQualificationFixture({
    candidateFacts: hasRelevantEvidence ? [{
      id: `technology-fact-${String(fixtureIndex).padStart(2, '0')}`,
      kind: 'experience',
      value: coverage === 'partially-covered'
        ? `Delivered 3 years of ${scenario.requirementTerm}.`
        : `${scenario.language === 'fr' ? 'Expérience avec' : 'Experience with'} ${scenario.requirementTerm}.`,
    }] : [],
    coverage,
    expectedCriticalReserveRequirementIds: isCriticalReserve ? [requirementId] : [],
    expectedMatchScoreRange: { maximum: coverage === 'covered' && hasRelevantEvidence ? 100 : 50, minimum: coverage === 'covered' && hasRelevantEvidence ? 100 : 0 },
    importance: scenario.importance,
    index: fixtureIndex,
    language: scenario.language,
    requirementTerm: scenario.requirementTerm,
    requirementValue,
    roleFamily: 'technology',
    roleTitle: scenario.roleTitle,
    scenarioTags: scenario.scenarioTags,
    split: scenarioIndex < 20 ? 'development' : 'held-out',
  })
}

function createRoleFixtures({ count, heldOutCount, roleFamily }: Readonly<{
  count: number
  heldOutCount: number
  roleFamily: Exclude<QualificationRoleFamily, 'technology'>
}>) {
  return Array.from({ length: count }, (unusedFixture, fixtureIndex) => {
    void unusedFixture
    const requirementTerm = roleTerms[roleFamily][fixtureIndex % roleTerms[roleFamily].length] ?? roleFamily
    const factId = `${roleFamily}-fact-${String(fixtureIndex).padStart(2, '0')}`
    return createQualificationFixture({
      candidateFacts: [{ id: factId, kind: 'experience', value: `Delivered ${requirementTerm}.` }],
      index: fixtureIndex + 1,
      requirementTerm,
      roleFamily,
      split: fixtureIndex < count - heldOutCount ? 'development' : 'held-out',
    })
  })
}
