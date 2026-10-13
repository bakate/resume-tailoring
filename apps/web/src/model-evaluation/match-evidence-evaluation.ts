import {
  analyzeResumeMatch,
  type CandidateFact,
  type JobRequirement,
  type RequirementCoverage,
} from '@resume-tailoring/matching-engine'

import type { ModelConnection } from '../adapters/server/language-model-request'
import { createOpenAiJobMatchEvidenceMatcher } from '../adapters/server/openai-job-match-evidence-matcher'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'

/** The coverage recall the live evaluation asserts on its own; qualification gates recall over every source. */
export const minimumExpectedCoverageRecall = 0.8

export type MatchEvidenceOutcome = Awaited<ReturnType<typeof evaluateMatchEvidenceCase>>

/** Requirement Coverage judged by the model through the production matcher, then verified by the engine. */
export async function evaluateMatchEvidenceCase({ connection, evaluationCase }: Readonly<{
  connection: ModelConnection
  evaluationCase: MatchEvidenceEvaluationCase
}>) {
  const requirements = evaluationCase.requirements.map(createRequirement)
  const result = await createOpenAiJobMatchEvidenceMatcher(connection)
    .match({ candidateFacts: evaluationCase.candidateFacts, requirements })
  if (!result.ok) {
    return { adjacentRequirementIds: new Set<string>(),
      coverageByRequirementId: new Map<string, RequirementCoverage>(), evaluationCase, ok: false }
  }
  const analysis = analyzeResumeMatch({
    candidateFacts: evaluationCase.candidateFacts,
    proposedAdjacentEvidence: result.value.adjacentEvidence,
    proposedEvidence: result.value.evidence,
    proposedRelevance: result.value.relevance,
    requirements,
  })
  const coverageByRequirementId = new Map<string, RequirementCoverage>(analysis.ok
    ? analysis.value.evidence.map(({ coverage, requirementId }) => [requirementId, coverage] as const) : [])
  const adjacentRequirementIds = new Set(analysis.ok
    ? analysis.value.adjacentEvidence.map(({ requirementId }) => requirementId) : [])
  return { adjacentRequirementIds, coverageByRequirementId, evaluationCase, ok: analysis.ok }
}

/** Every requirement of every case, judged against its expectation. */
export function assessMatchEvidenceOutcomes({ outcomes }: Readonly<{ outcomes: readonly MatchEvidenceOutcome[] }>) {
  return outcomes.flatMap(({ adjacentRequirementIds, coverageByRequirementId, evaluationCase }) =>
    evaluationCase.requirements.map(({ expectation, expectsAdjacentEvidence = false, id }) => {
      const coverage = coverageByRequirementId.get(id) ?? 'not-covered'
      return {
        caseName: evaluationCase.name, coverage, expectation, expectsAdjacentEvidence,
        hasAdjacentEvidence: adjacentRequirementIds.has(id), id,
        trapViolated: (expectation === 'not-covered' && coverage !== 'not-covered')
          || (expectation === 'partially-covered-at-most' && coverage === 'covered'),
      }
    }))
}

export function summarizeMatchEvidenceOutcomes({ outcomes }: Readonly<{ outcomes: readonly MatchEvidenceOutcome[] }>) {
  const assessments = assessMatchEvidenceOutcomes({ outcomes })
  const expectedCoverage = assessments.filter(({ expectation }) => expectation === 'covered')
  const foundCoverage = expectedCoverage.filter(({ coverage }) => coverage === 'covered')
  return {
    assessments,
    expectedCoverageRecall: expectedCoverage.length === 0 ? 1 : foundCoverage.length / expectedCoverage.length,
    missingAdjacentEvidence: assessments.filter(({ expectsAdjacentEvidence, hasAdjacentEvidence }) =>
      expectsAdjacentEvidence && !hasAdjacentEvidence),
    trapViolations: assessments.filter(({ trapViolated }) => trapViolated),
  }
}

/**
 * Each case checks that the matcher answered, its expected coverage and its expected Adjacent Evidence; a case pairing
 * languages also counts those checks as multilingual. A covered trap claims the Candidate meets a requirement without
 * proof, so it counts against provenance safety, never recall.
 */
export const matchEvidenceSource: ModelObservationSource = {
  id: 'match-evidence',
  roles: ['structured'],
  observe: async ({ connect }) => {
    const connection = connect('structured')
    const observations = []
    for (const [caseIndex, evaluationCase] of matchEvidenceEvaluationCases.entries()) {
      const outcome = await evaluateMatchEvidenceCase({ connection, evaluationCase })
      const assessments = assessMatchEvidenceOutcomes({ outcomes: [outcome] })
      const checks = [{ id: 'answered', passed: outcome.ok }, ...assessments.flatMap((assessment) => [
        ...assessment.expectation === 'covered' ? [{ id: assessment.id, passed: assessment.coverage === 'covered' }] : [],
        ...assessment.expectsAdjacentEvidence ? [{ id: `${assessment.id}:adjacent`, passed: assessment.hasAdjacentEvidence }] : [],
      ])]
      const passedCount = checks.filter(({ passed }) => passed).length
      const multilingual = evaluationCase.multilingual === true
      const coveredTraps = assessments.filter(({ trapViolated }) => trapViolated)
      observations.push(createModelEvaluationObservation({ fixtureId: `case-${String(caseIndex + 1).padStart(2, '0')}`,
        coveredTrapCount: coveredTraps.length,
        extractionExpectedCount: checks.length, extractionMatchedCount: passedCount,
        multilingualCheckCount: multilingual ? checks.length : 0,
        multilingualPassedCount: multilingual ? passedCount : 0,
        observedValues: [...checks.filter(({ passed }) => !passed).map(({ id }) => `failed:${id}`),
          ...coveredTraps.map(({ id }) => `covered-trap:${id}`)] }))
    }
    return observations
  },
}

function createRequirement({ capabilityName, id, value }: MatchEvidenceEvaluationRequirement) {
  return {
    capability: { dimension: 'execution', name: capabilityName },
    id,
    importance: 'central',
    importanceRationale: 'Synthetic evaluation requirement.',
    sourceExcerpt: value,
    value,
  } as const satisfies JobRequirement & Readonly<{ importanceRationale: string }>
}

type MatchEvidenceEvaluationRequirement = Readonly<{
  capabilityName: string
  expectation: 'covered' | 'partially-covered-at-most' | 'not-covered'
  expectsAdjacentEvidence?: true
  id: `job-requirement-${string}`
  value: string
}>

export type MatchEvidenceEvaluationCase = Readonly<{
  candidateFacts: readonly (CandidateFact & Readonly<{ id: `source-fact-${string}` }>)[]
  /** Requirements and Candidate Facts in different languages, or a translated language. */
  multilingual?: true
  name: string
  requirements: readonly MatchEvidenceEvaluationRequirement[]
}>

export const matchEvidenceEvaluationCases: readonly MatchEvidenceEvaluationCase[] = [
  {
    name: 'web application development proven by end-to-end Next.js work',
    candidateFacts: [{
      id: 'source-fact-nextjs', kind: 'experience',
      value: 'Delivered end-to-end Next.js features, from PostgreSQL schema to React interface, for a B2B SaaS product',
    }],
    requirements: [{
      capabilityName: 'Web application development', expectation: 'covered',
      id: 'job-requirement-web-applications', value: 'Design, build and maintain web applications',
    }],
  },
  {
    name: 'cloud deployment and monitoring proven by CI/CD and monitoring work',
    candidateFacts: [
      { id: 'source-fact-ci-cd', kind: 'experience', value: 'Set up CI/CD pipelines with GitHub Actions deploying to AWS' },
      { id: 'source-fact-monitoring', kind: 'experience', value: 'Configured Sentry monitoring and alerting for production incidents' },
    ],
    requirements: [{
      capabilityName: 'Cloud deployment and monitoring', expectation: 'covered',
      id: 'job-requirement-cloud-deployment', value: 'Contribute to cloud deployment and monitoring',
    }],
  },
  {
    name: 'exact skill and translated language',
    multilingual: true,
    candidateFacts: [
      { id: 'source-fact-typescript', kind: 'skill', value: 'TypeScript' },
      { id: 'source-fact-french', kind: 'language', value: 'Français courant' },
    ],
    requirements: [
      { capabilityName: 'TypeScript', expectation: 'covered', id: 'job-requirement-typescript', value: 'Know TS' },
      { capabilityName: 'French', expectation: 'covered', id: 'job-requirement-french', value: 'Speak French' },
    ],
  },
  {
    name: 'API development proven by RESTful endpoint work',
    candidateFacts: [{
      id: 'source-fact-endpoints', kind: 'experience',
      value: 'Designed and implemented RESTful endpoints in Node.js for the billing service',
    }],
    requirements: [{
      capabilityName: 'API development', expectation: 'covered', id: 'job-requirement-api', value: 'Build REST APIs',
    }],
  },
  {
    name: 'automated testing proven by named test tooling',
    candidateFacts: [{
      id: 'source-fact-tests', kind: 'experience',
      value: 'Introduced Playwright end-to-end tests and Vitest unit tests in the CI pipeline',
    }],
    requirements: [{
      capabilityName: 'Automated testing', expectation: 'covered', id: 'job-requirement-tests', value: 'Write automated tests',
    }],
  },
  {
    // BAK-139: Jest and Cypress were shown as Adjacent Evidence that "does not meet" this requirement.
    name: 'unit and end-to-end testing proven by listed testing tools alone',
    multilingual: true,
    candidateFacts: [
      { id: 'source-fact-jest', kind: 'skill', value: 'Jest' },
      { id: 'source-fact-cypress', kind: 'skill', value: 'Cypress' },
    ],
    requirements: [{
      capabilityName: 'Tests unitaires et end-to-end', expectation: 'covered',
      id: 'job-requirement-unit-and-end-to-end-tests', value: 'Écrire des tests unitaires et end-to-end',
    }],
  },
  {
    name: 'French requirement proven by English mentoring evidence',
    multilingual: true,
    candidateFacts: [{
      id: 'source-fact-mentoring', kind: 'experience',
      value: 'Coached three junior engineers through weekly pairing sessions',
    }],
    requirements: [{
      capabilityName: 'Accompagnement de développeurs juniors', expectation: 'covered',
      id: 'job-requirement-mentoring', value: 'Accompagner des développeurs juniors',
    }],
  },
  {
    name: 'Java, JEE and Angular against TypeScript and React: Adjacent Evidence, never coverage',
    candidateFacts: [
      { id: 'source-fact-typescript-react', kind: 'experience', value: 'Built TypeScript and React single-page applications' },
    ],
    requirements: [
      { capabilityName: 'Java EE', expectation: 'not-covered', expectsAdjacentEvidence: true,
        id: 'job-requirement-jee', value: 'Develop Java and JEE services' },
      { capabilityName: 'Angular', expectation: 'not-covered', expectsAdjacentEvidence: true,
        id: 'job-requirement-angular', value: 'Build Angular interfaces' },
    ],
  },
  {
    name: 'unsupported five-year duration',
    candidateFacts: [{ id: 'source-fact-project', kind: 'experience', value: 'Used TypeScript on one project' }],
    requirements: [{
      capabilityName: 'TypeScript', expectation: 'partially-covered-at-most',
      id: 'job-requirement-duration', value: '5 years of TypeScript',
    }],
  },
  {
    name: 'technology present only in a role title',
    candidateFacts: [{ id: 'source-fact-role', kind: 'experience', value: 'Senior TypeScript Developer at Acme' }],
    requirements: [{
      capabilityName: 'TypeScript', expectation: 'not-covered', id: 'job-requirement-role', value: 'Know TypeScript',
    }],
  },
  {
    name: 'negated technology experience',
    candidateFacts: [{ id: 'source-fact-negation', kind: 'experience', value: 'No production experience with React' }],
    requirements: [{
      capabilityName: 'React', expectation: 'not-covered', id: 'job-requirement-negation', value: 'Production React experience',
    }],
  },
  {
    name: 'React offered as proof of React Native',
    candidateFacts: [{ id: 'source-fact-react', kind: 'experience', value: 'Used React' }],
    requirements: [{
      capabilityName: 'React Native', expectation: 'not-covered', id: 'job-requirement-react-native', value: 'Know React Native',
    }],
  },
  {
    name: 'Java duration offered as TypeScript duration',
    candidateFacts: [{ id: 'source-fact-mixed-duration', kind: 'experience', value: '5 years of Java. Used TypeScript' }],
    requirements: [{
      capabilityName: 'TypeScript', expectation: 'partially-covered-at-most',
      id: 'job-requirement-typescript-duration', value: '5 years of TypeScript',
    }],
  },
  {
    name: 'Java seniority offered as TypeScript seniority',
    candidateFacts: [{ id: 'source-fact-mixed-seniority', kind: 'experience', value: 'Senior Java developer. Used TypeScript' }],
    requirements: [{
      capabilityName: 'TypeScript', expectation: 'partially-covered-at-most',
      id: 'job-requirement-typescript-seniority', value: 'Senior TypeScript',
    }],
  },
  {
    name: 'leadership inferred from a programming skill',
    candidateFacts: [{ id: 'source-fact-skill', kind: 'skill', value: 'TypeScript' }],
    requirements: [{
      capabilityName: 'Leadership', expectation: 'not-covered', id: 'job-requirement-leadership', value: 'Demonstrate leadership',
    }],
  },
  {
    name: 'React 17 offered as proof of React 18',
    candidateFacts: [{ id: 'source-fact-react-version', kind: 'experience', value: 'Used React 17' }],
    requirements: [{
      capabilityName: 'React 18', expectation: 'not-covered', id: 'job-requirement-react-version', value: 'Know React 18',
    }],
  },
]
