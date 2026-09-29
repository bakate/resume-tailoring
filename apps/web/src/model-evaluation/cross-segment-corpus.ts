import {
  createQualificationFixture,
  type QualificationCorpus,
  type QualificationRoleFamily,
} from './cross-segment-qualification'
import { salesCommercialQualificationCorpus } from './sales-commercial-corpus'

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

type GeneralManagementScenario = Readonly<{
  ambiguity: 'none' | 'scope' | 'seniority' | 'ownership'
  constraints: readonly string[]
  coverage?: 'covered' | 'partially-covered'
  domain: 'operations' | 'finance' | 'hr' | 'program-leadership' | 'cross-functional'
  expectedScore?: Readonly<{ maximum: number; minimum: number }>
  language: 'en' | 'fr'
  profile: 'operator' | 'functional-leader' | 'program-leader' | 'executive'
  scenario: 'strong-match' | 'partial-match' | 'critical-gap' | 'wishlist' | 'transferable-capability'
  requirement: string
  requirementValue?: string
  candidateEvidence: string
  includeEvidence?: boolean
}>

const generalManagementScenarios: readonly GeneralManagementScenario[] = [
  { ambiguity: 'none', constraints: ['Paris or hybrid'], domain: 'operations', language: 'en', profile: 'operator', scenario: 'strong-match', requirement: 'operating plans', candidateEvidence: 'Owned annual operating plans across three regions.' },
  { ambiguity: 'scope', constraints: ['EU travel'], domain: 'operations', language: 'fr', profile: 'operator', scenario: 'strong-match', requirement: 'pilotage des opérations', candidateEvidence: 'Piloté le pilotage des opérations pendant deux ans.' },
  { ambiguity: 'none', constraints: ['Remote within France'], domain: 'finance', language: 'en', profile: 'functional-leader', scenario: 'strong-match', requirement: 'budget ownership', candidateEvidence: 'Owned a €12M operating budget and quarterly forecasts.' },
  { ambiguity: 'ownership', constraints: ['Permanent contract'], domain: 'finance', language: 'fr', profile: 'operator', scenario: 'transferable-capability', requirement: 'contrôle budgétaire', candidateEvidence: 'Construit les prévisions et suivi les écarts pour une activité de 8M€.' },
  { ambiguity: 'seniority', constraints: ['On-site three days weekly'], domain: 'hr', language: 'en', profile: 'functional-leader', scenario: 'partial-match', coverage: 'partially-covered', expectedScore: { maximum: 50, minimum: 50 }, requirement: 'people leadership', requirementValue: 'people leadership for 5 years', candidateEvidence: 'Provided people leadership for 2 years.' },
  { ambiguity: 'none', constraints: ['Paris preferred'], domain: 'hr', language: 'fr', profile: 'functional-leader', scenario: 'strong-match', requirement: 'développement des talents', candidateEvidence: 'Déployé un programme de développement des talents pour 400 salariés.' },
  { ambiguity: 'none', constraints: ['International scope'], domain: 'program-leadership', language: 'en', profile: 'program-leader', scenario: 'strong-match', requirement: 'program delivery', candidateEvidence: 'Delivered a multi-country transformation program on schedule.' },
  { ambiguity: 'scope', constraints: ['French work authorization'], domain: 'program-leadership', language: 'fr', profile: 'program-leader', scenario: 'strong-match', requirement: 'livraison de programmes', candidateEvidence: 'Livré la livraison de programmes pendant deux ans.' },
  { ambiguity: 'none', constraints: ['Start in three months'], domain: 'cross-functional', language: 'en', profile: 'program-leader', scenario: 'strong-match', requirement: 'cross-functional execution', candidateEvidence: 'Aligned product, sales, finance, and operations around a shared launch.' },
  { ambiguity: 'ownership', constraints: ['Hybrid in Lyon'], domain: 'cross-functional', language: 'fr', profile: 'operator', scenario: 'transferable-capability', requirement: 'exécution transverse', candidateEvidence: 'Coordonné les équipes produit, juridique et opérations pour un lancement.' },
  { ambiguity: 'none', constraints: ['Compensation range disclosed'], domain: 'operations', language: 'en', profile: 'executive', scenario: 'wishlist', requirement: 'process improvement', candidateEvidence: 'Improved order-to-cash processes and reduced cycle time by 30%.' },
  { ambiguity: 'none', constraints: ['Remote-first'], domain: 'operations', language: 'fr', profile: 'functional-leader', scenario: 'wishlist', requirement: 'amélioration continue', candidateEvidence: 'Réduit les délais de traitement de 25 % grâce à une standardisation des processus.' },
  { ambiguity: 'seniority', constraints: ['Board exposure expected'], domain: 'finance', language: 'en', profile: 'executive', scenario: 'critical-gap', expectedScore: { maximum: 0, minimum: 0 }, requirement: 'board-level finance leadership', candidateEvidence: 'Prepared management reports but has no board-level finance leadership evidence.', includeEvidence: false },
  { ambiguity: 'ownership', constraints: ['Available immediately'], domain: 'finance', language: 'fr', profile: 'operator', scenario: 'critical-gap', expectedScore: { maximum: 0, minimum: 0 }, requirement: 'direction financière', candidateEvidence: 'Analysé des données financières sans avoir dirigé une fonction finance.', includeEvidence: false },
  { ambiguity: 'none', constraints: ['Relocation supported'], domain: 'hr', language: 'en', profile: 'functional-leader', scenario: 'strong-match', requirement: 'workforce planning', candidateEvidence: 'Built workforce plans and hiring forecasts for a 1,200-person organization.' },
  { ambiguity: 'scope', constraints: ['French and English required'], domain: 'hr', language: 'fr', profile: 'operator', scenario: 'transferable-capability', requirement: 'planification des effectifs', candidateEvidence: 'Planifié les besoins de recrutement d’une business unit de 180 personnes.' },
  { ambiguity: 'none', constraints: ['Travel up to 20%'], domain: 'program-leadership', language: 'en', profile: 'executive', scenario: 'strong-match', requirement: 'portfolio governance', candidateEvidence: 'Established portfolio governance and prioritization for ten strategic initiatives.' },
  { ambiguity: 'ownership', constraints: ['No relocation'], domain: 'program-leadership', language: 'fr', profile: 'program-leader', scenario: 'wishlist', requirement: 'gouvernance de portefeuille', candidateEvidence: 'Mis en place des rituels de priorisation pour six initiatives stratégiques.' },
  { ambiguity: 'scope', constraints: ['Full-time only'], domain: 'cross-functional', language: 'en', profile: 'operator', scenario: 'partial-match', coverage: 'partially-covered', expectedScore: { maximum: 50, minimum: 50 }, requirement: 'enterprise change leadership', requirementValue: 'enterprise change leadership for 5 years', candidateEvidence: 'Provided enterprise change leadership for 2 years.' },
  { ambiguity: 'none', constraints: ['Paris or remote'], domain: 'cross-functional', language: 'fr', profile: 'executive', scenario: 'strong-match', requirement: 'alignement des parties prenantes', candidateEvidence: 'Aligné les dirigeants et les équipes opérationnelles autour d’une stratégie commune.' },
] as const

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
    ...createGeneralManagementFixtures(),
    ...technologyScenarios.map((scenario, scenarioIndex) => createTechnologyFixture({ scenario, scenarioIndex })),
    ...salesCommercialQualificationCorpus.fixtures,
  ],
}

function createGeneralManagementFixtures() {
  return generalManagementScenarios.map((scenario, scenarioIndex) => {
    const fixture = createQualificationFixture({
      candidateFacts: [{
        id: `general-management-fact-${String(scenarioIndex).padStart(2, '0')}`,
        kind: 'experience',
        value: scenario.includeEvidence === false
          ? scenario.candidateEvidence
          : `${scenario.candidateEvidence} Evidence: ${scenario.requirement}.`,
      }],
      coverage: scenario.coverage,
      expectedMatchScoreRange: scenario.expectedScore,
      importance: scenario.scenario === 'critical-gap' ? 'critical' : undefined,
      index: scenarioIndex + 1,
      requirementTerm: scenario.requirement,
      requirementValue: scenario.requirementValue,
      roleFamily: 'general-management',
      split: scenarioIndex < 14 ? 'development' : 'held-out',
      generalManagement: scenario,
      expectedCriticalReserveRequirementIds: scenario.scenario === 'critical-gap'
        ? [`general-management-${String(scenarioIndex + 1).padStart(2, '0')}-requirement`] : [],
      includeEvidence: scenario.includeEvidence,
    })
    return {
      ...fixture,
      jobPosting: `${scenario.language === 'fr' ? 'Le poste exige' : 'The role requires'} ${scenario.requirement}. ${scenario.constraints.join('; ')}.`,
      sourceDocument: scenario.candidateEvidence,
    }
  })
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
