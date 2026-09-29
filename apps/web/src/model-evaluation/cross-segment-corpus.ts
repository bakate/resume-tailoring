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

export const crossSegmentQualificationCorpus: QualificationCorpus = {
  id: 'cross-segment-qualification-v1',
  fixtures: [
    ...createRoleFixtures({ count: 30, roleFamily: 'technology', heldOutCount: 10 }),
    ...createGeneralManagementFixtures(),
    ...createRoleFixtures({ count: 20, roleFamily: 'sales', heldOutCount: 6 }),
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
