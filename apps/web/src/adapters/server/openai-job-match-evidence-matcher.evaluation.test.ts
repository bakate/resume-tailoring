import {
  analyzeResumeMatch,
  type CandidateFact,
  type JobRequirement,
  type RequirementCoverage,
  validateRelevantFactProposals,
} from '@resume-tailoring/matching-engine'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createOpenAiJobMatchEvidenceMatcher } from './openai-job-match-evidence-matcher'

// Live evaluation of Requirement Coverage judged by the model and verified by the engine (ADR-0015).
// Positive cases measure recall; traps must never receive more coverage than the rules allow,
// and a related but distinct capability must surface as Adjacent Evidence next to its gap.
describe('OpenAI Job Match evidence live evaluation', () => {
  it('finds expected coverage, never covers a trap, and reports expected Adjacent Evidence', async () => {
    const outcomes = []
    for (const evaluationCase of evaluationCases) {
      outcomes.push(await evaluateCase({ evaluationCase }))
    }
    const report = summarizeOutcomes({ outcomes })
    console.info(JSON.stringify(report))

    expect(outcomes.every(({ ok }) => ok)).toBe(true)
    expect(report.expectedCoverageRecall).toBeGreaterThanOrEqual(minimumExpectedCoverageRecall)
    expect(report.trapViolations).toEqual([])
    expect(report.missingAdjacentEvidence).toEqual([])
  }, 600_000)
})

async function evaluateCase({ evaluationCase }: Readonly<{ evaluationCase: EvaluationCase }>) {
  const metrics: EvaluationMetric[] = []
  const matcher = createOpenAiJobMatchEvidenceMatcher({
    apiKey: readEnvironmentValue({ name: 'OPENAI_API_KEY' }),
    model: readEnvironmentValue({ name: 'OPENAI_STRUCTURED_MODEL' }),
    reasoningEffort: 'low',
    request: createMeasuredRequest({ metrics }),
  })
  const requirements = evaluationCase.requirements.map(createRequirement)
  const result = await matcher.match({ candidateFacts: evaluationCase.candidateFacts, requirements })
  if (!result.ok) {
    return { adjacentRequirementIds: new Set<string>(),
      coverageByRequirementId: new Map<string, RequirementCoverage>(), evaluationCase, metrics, ok: false }
  }
  const analysis = analyzeResumeMatch({
    candidateFacts: evaluationCase.candidateFacts,
    proposedAdjacentEvidence: result.value.adjacentEvidence,
    proposedEvidence: result.value.evidence,
    relevantFactIds: validateRelevantFactProposals({
      candidateFacts: evaluationCase.candidateFacts, proposals: result.value.relevance, requirements,
    }),
    requirements,
  })
  const coverageByRequirementId = new Map<string, RequirementCoverage>(analysis.ok
    ? analysis.value.evidence.map(({ coverage, requirementId }) => [requirementId, coverage] as const) : [])
  const adjacentRequirementIds = new Set(analysis.ok
    ? analysis.value.adjacentEvidence.map(({ requirementId }) => requirementId) : [])
  return { adjacentRequirementIds, coverageByRequirementId, evaluationCase, metrics, ok: analysis.ok }
}

type EvaluationOutcome = Awaited<ReturnType<typeof evaluateCase>>

function summarizeOutcomes({ outcomes }: Readonly<{ outcomes: readonly EvaluationOutcome[] }>) {
  const assessments = outcomes.flatMap(({ adjacentRequirementIds, coverageByRequirementId, evaluationCase }) =>
    evaluationCase.requirements.map(({ expectation, expectsAdjacentEvidence = false, id }) => ({
      caseName: evaluationCase.name, coverage: coverageByRequirementId.get(id) ?? 'not-covered', expectation,
      expectsAdjacentEvidence, hasAdjacentEvidence: adjacentRequirementIds.has(id), id,
    })))
  const expectedCoverage = assessments.filter(({ expectation }) => expectation === 'covered')
  const foundCoverage = expectedCoverage.filter(({ coverage }) => coverage === 'covered')
  return {
    assessments,
    cases: outcomes.map(({ evaluationCase, metrics }) => ({ metrics, name: evaluationCase.name })),
    expectedCoverageRecall: expectedCoverage.length === 0 ? 1 : foundCoverage.length / expectedCoverage.length,
    missingAdjacentEvidence: assessments.filter(({ expectsAdjacentEvidence, hasAdjacentEvidence }) =>
      expectsAdjacentEvidence && !hasAdjacentEvidence),
    trapViolations: assessments.filter(({ coverage, expectation }) =>
      (expectation === 'not-covered' && coverage !== 'not-covered')
      || (expectation === 'partially-covered-at-most' && coverage === 'covered')),
  }
}

function createMeasuredRequest({ metrics }: Readonly<{ metrics: EvaluationMetric[] }>): typeof fetch {
  return async (input, init) => {
    const startedAt = performance.now()
    const response = await fetch(input, init)
    const usage = usageSchema.parse(await response.clone().json())
    metrics.push({
      inputTokens: usage.usage.input_tokens,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
      outputTokens: usage.usage.output_tokens,
    })
    return response
  }
}

function readEnvironmentValue({ name }: Readonly<{ name: string }>) {
  const value = process.env[name]
  expect(value, `${name} must be configured for live evaluation`).toBeTruthy()
  return value ?? ''
}

function createRequirement({ capabilityName, id, value }: EvaluationRequirement) {
  return {
    capability: { dimension: 'execution', name: capabilityName },
    id,
    importance: 'central',
    importanceRationale: 'Synthetic evaluation requirement.',
    sourceExcerpt: value,
    value,
  } as const satisfies JobRequirement & Readonly<{ importanceRationale: string }>
}

type EvaluationRequirement = Readonly<{
  capabilityName: string
  expectation: 'covered' | 'partially-covered-at-most' | 'not-covered'
  expectsAdjacentEvidence?: true
  id: `job-requirement-${string}`
  value: string
}>

type EvaluationCase = Readonly<{
  candidateFacts: readonly (CandidateFact & Readonly<{ id: `source-fact-${string}` }>)[]
  name: string
  requirements: readonly EvaluationRequirement[]
}>

type EvaluationMetric = Readonly<{
  inputTokens: number
  latencyMilliseconds: number
  outputTokens: number
}>

const usageSchema = z.object({
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
})

const minimumExpectedCoverageRecall = 0.8

const evaluationCases: readonly EvaluationCase[] = [
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
    name: 'French requirement proven by English mentoring evidence',
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
