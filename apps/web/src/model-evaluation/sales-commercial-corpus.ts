import {
  createQualificationFixture,
  type QualificationCorpus,
} from './cross-segment-qualification'

type SalesScenario = Readonly<{
  candidateEvidence: string
  coverage?: 'covered' | 'partially-covered'
  importance?: 'critical' | 'central' | 'complementary'
  language: 'EN' | 'FR'
  roleTitle: string
  requirementTerm: string
  requirementValue?: string
  scenario: string
  split: 'development' | 'held-out'
  territory: string
  target: string
}>

const salesScenarios: readonly SalesScenario[] = [
  {
    candidateEvidence: 'Prospected and qualified 140 outbound opportunities per quarter.',
    language: 'EN', roleTitle: 'SDR', requirementTerm: 'outbound pipeline development',
    scenario: 'target attainment and high-volume prospecting', split: 'development', territory: 'UKI', target: '€1.2M qualified pipeline',
  },
  {
    candidateEvidence: 'Prospecté et qualifié 90 comptes mid-market par trimestre.',
    language: 'FR', roleTitle: 'SDR', requirementTerm: 'mid-market prospecting',
    scenario: 'territory ownership and qualification', split: 'development', territory: 'France', target: '90 comptes qualifiés par trimestre',
  },
  {
    candidateEvidence: 'Built a repeatable BDR sequence that generated 32% more accepted meetings.',
    language: 'EN', roleTitle: 'BDR', requirementTerm: 'pipeline development',
    scenario: 'overloaded wishlist with a focused pipeline outcome', split: 'development', territory: 'DACH', target: '32% more accepted meetings',
  },
  {
    candidateEvidence: 'Développé un portefeuille de 45 partenaires revendeurs actifs.',
    language: 'FR', roleTitle: 'BDR', requirementTerm: 'partner channel development',
    scenario: 'channel territory and stakeholder scope', split: 'development', territory: 'Benelux', target: '45 partenaires actifs',
  },
  {
    candidateEvidence: 'Closed €2.4M in new ARR through discovery, negotiation, and procurement.',
    language: 'EN', roleTitle: 'Account Executive', requirementTerm: 'enterprise commercial negotiation',
    scenario: 'long sales cycle and procurement stakeholders', split: 'development', territory: 'North America', target: '$2.5M new ARR',
  },
  {
    candidateEvidence: 'Conclu des cycles de vente de six mois avec des directeurs financiers et achats.',
    language: 'FR', roleTitle: 'Account Executive', requirementTerm: 'enterprise sales cycles',
    scenario: 'critical partial match on sales-cycle scope', coverage: 'partially-covered', importance: 'critical',
    requirementValue: '12-month enterprise sales cycles', split: 'development', territory: 'France', target: '€3M de new business',
  },
  {
    candidateEvidence: 'Owned a $6M book of business and renewed 96% of strategic accounts.',
    language: 'EN', roleTitle: 'Key Account Manager', requirementTerm: 'strategic account ownership',
    scenario: 'retention target and executive stakeholders', split: 'development', territory: 'US East', target: '96% gross retention',
  },
  {
    candidateEvidence: 'Géré un portefeuille de 20 comptes clés avec des plans de compte trimestriels.',
    language: 'FR', roleTitle: 'Key Account Manager', requirementTerm: 'key account planning',
    scenario: 'stakeholder scope and account planning', split: 'development', territory: 'France et Suisse', target: '20 comptes clés',
  },
  {
    candidateEvidence: 'Expanded three enterprise accounts from €400k to €1.1M annual contract value.',
    language: 'EN', roleTitle: 'Key Account Manager', requirementTerm: 'enterprise account expansion',
    scenario: 'land-and-expand target with multi-threaded stakeholders', split: 'development', territory: 'EMEA', target: '€2M expansion revenue',
  },
  {
    candidateEvidence: "Augmenté la valeur des contrats grâce à des plans d'expansion multi-produits.",
    language: 'FR', roleTitle: 'Account Executive', requirementTerm: 'commercial expansion strategy',
    scenario: 'hybrid new-business and expansion role', split: 'development', territory: 'Europe du Sud', target: '35% expansion revenue',
  },
  {
    candidateEvidence: 'Managed a team of eight sellers against a £5M annual quota.',
    language: 'EN', roleTitle: 'Sales Manager', requirementTerm: 'sales team leadership',
    scenario: 'people leadership and quota ownership', split: 'development', territory: 'UK', target: '£5M annual quota',
  },
  {
    candidateEvidence: 'Encadré une équipe de six commerciaux et instauré une revue hebdomadaire du pipeline.',
    language: 'FR', roleTitle: 'Sales Manager', requirementTerm: 'sales pipeline inspection',
    scenario: 'forecasting cadence and team leadership', split: 'development', territory: 'France', target: '110% de quota équipe',
  },
  {
    candidateEvidence: 'Improved forecast accuracy from 62% to 89% using deal-stage definitions.',
    language: 'EN', roleTitle: 'Sales Manager', requirementTerm: 'sales forecasting',
    scenario: 'operational risk and forecast discipline', split: 'development', territory: 'Global', target: '89% forecast accuracy',
  },
  {
    candidateEvidence: 'Réduit le cycle de vente de 20% en alignant marketing, ventes et avant-vente.',
    language: 'FR', roleTitle: 'Commercial Director', requirementTerm: 'cross-functional sales execution',
    scenario: 'stakeholder scope across a hybrid commercial role', split: 'development', territory: 'France', target: '20% shorter sales cycle',
  },
  {
    candidateEvidence: 'Led MEDDPICC qualification for complex SaaS opportunities with CIO sponsors.',
    language: 'EN', roleTitle: 'Sales Engineer', requirementTerm: 'complex SaaS discovery',
    scenario: 'technical stakeholder scope and long sales cycle', split: 'held-out', territory: 'North America', target: '$4M qualified pipeline',
  },
  {
    candidateEvidence: 'Accompagné les démonstrations produit et la validation technique auprès de DSI.',
    language: 'FR', roleTitle: 'Sales Engineer', requirementTerm: 'technical sales enablement',
    scenario: 'hybrid commercial and technical stakeholder scope', split: 'held-out', territory: 'France', target: '30% demo-to-close conversion',
  },
  {
    candidateEvidence: 'Won a competitive displacement deal after 3 years of mapping six buying-committee stakeholders.',
    language: 'EN', roleTitle: 'Account Executive', requirementTerm: 'multi-stakeholder enterprise selling',
    scenario: 'critical gap and competitive displacement ambiguity', coverage: 'partially-covered', importance: 'critical',
    requirementValue: '5 years of multi-stakeholder enterprise selling', split: 'held-out', territory: 'Global', target: '$8M enterprise quota',
  },
  {
    candidateEvidence: 'Structuré une stratégie de territoire et priorisé 120 comptes cibles.',
    language: 'FR', roleTitle: 'Commercial Director', requirementTerm: 'territory strategy',
    scenario: 'territory planning and overloaded wishlist', split: 'held-out', territory: 'France et Benelux', target: '120 comptes cibles',
  },
  {
    candidateEvidence: 'Built a partner-led motion with clear handoffs, attribution, and quarterly targets.',
    language: 'EN', roleTitle: 'Channel Sales Manager', requirementTerm: 'channel sales strategy',
    scenario: 'partner targets and operating ambiguity', split: 'held-out', territory: 'EMEA', target: '40% partner-sourced pipeline',
  },
  {
    candidateEvidence: 'Négocié des contrats cadres pendant 3 years avec des directions achats et juridiques.',
    language: 'FR', roleTitle: 'Key Account Manager', requirementTerm: 'commercial contract negotiation',
    scenario: 'critical procurement stakeholder gap', coverage: 'partially-covered', importance: 'critical',
    requirementValue: '5 years of commercial contract negotiation', split: 'held-out', territory: 'Europe', target: '€6M contract value',
  },
]

export const salesCommercialQualificationCorpus: QualificationCorpus = {
  id: 'sales-commercial-qualification-v1',
  fixtures: salesScenarios.map((scenario, scenarioIndex) => createSalesFixture({ scenario, scenarioIndex })),
}

function createSalesFixture({ scenario, scenarioIndex }: Readonly<{ scenario: SalesScenario; scenarioIndex: number }>) {
  const fixture = createQualificationFixture({
    candidateFacts: [{
      id: `sales-fact-${String(scenarioIndex + 1).padStart(2, '0')}`,
      kind: 'experience',
      value: `${scenario.candidateEvidence} Evidence capability: ${scenario.requirementTerm}.`,
    }],
    coverage: scenario.coverage,
    expectedCriticalReserveRequirementIds: scenario.coverage === 'partially-covered'
      ? [`sales-${String(scenarioIndex + 1).padStart(2, '0')}-requirement`] : [],
    expectedMatchScoreRange: scenario.coverage === 'partially-covered'
      ? { maximum: 50, minimum: 50 } : undefined,
    importance: scenario.importance,
    index: scenarioIndex + 1,
    requirementTerm: scenario.requirementTerm,
    requirementValue: scenario.requirementValue,
    roleFamily: 'sales',
    split: scenario.split,
  })
  return {
    ...fixture,
    id: `sales-${String(scenarioIndex + 1).padStart(2, '0')}`,
    jobPosting: `[${scenario.language}] ${scenario.roleTitle}. Territory: ${scenario.territory}. Target: ${scenario.target}. ${scenario.scenario}. Requirement: ${scenario.requirementTerm}. Wishlist includes Salesforce, MEDDPICC, travel, and forecasting.`,
    sourceDocument: `${scenario.roleTitle} evidence: ${scenario.candidateEvidence} Territory experience: ${scenario.territory}.`,
  } as const
}
