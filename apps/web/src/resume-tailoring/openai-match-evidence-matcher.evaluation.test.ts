import { createMatchAnalysis } from '@resume-tailoring/application/match-analysis'
import type {
  JobRequirement,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createOpenAiMatchEvidenceMatcher } from './openai-match-evidence-matcher'

describe('OpenAI Match Evidence representative evaluation', () => {
  it.each(evaluationFixtures)('$name', async (fixture) => {
    const evaluation = await evaluateFixture({ fixture })
    const coveredRequirementIds = readCoveredRequirementIds({ evaluation, fixture })
    console.info(JSON.stringify({
      coveredRequirementIds, name: fixture.name, ...evaluation.metric,
    }))

    expect(evaluation.result.ok).toBe(true)
    expect(evaluation.metric.inputTokens).toBeLessThanOrEqual(2_000)
    expect(evaluation.metric.outputTokens).toBeLessThanOrEqual(1_000)
    expect(evaluation.metric.latencyMilliseconds).toBeLessThan(30_000)
    expect(coveredRequirementIds).toEqual(fixture.expectedCoverage)
  }, 35_000)
})

async function evaluateFixture({ fixture }: Readonly<{ fixture: EvaluationFixture }>) {
  const metrics: EvaluationMetric[] = []
  const matcher = createOpenAiMatchEvidenceMatcher({
    apiKey: readEnvironmentValue({ name: 'OPENAI_API_KEY' }),
    model: readEnvironmentValue({ name: 'OPENAI_STRUCTURED_MODEL' }),
    reasoningEffort: 'low',
    request: createMeasuredRequest({ metrics }),
  })
  const result = await matcher.match(createMinimalMatchInputs({ fixture }))
  expect(metrics).toHaveLength(1)
  return { metric: metrics[0] ?? emptyMetric, result }
}

function readCoveredRequirementIds({ evaluation, fixture }: Readonly<{
  evaluation: Awaited<ReturnType<typeof evaluateFixture>>
  fixture: EvaluationFixture
}>) {
  if (!evaluation.result.ok) return []
  const analysis = createMatchAnalysis({
    proposedEvidence: evaluation.result.value.evidence,
    relevantFactIds: evaluation.result.value.relevantFactIds,
    requirements: fixture.requirements,
    verifiedFacts: fixture.verifiedFacts,
  })
  return analysis?.evidence.map(({ requirementId }) => requirementId) ?? []
}

function createMinimalMatchInputs({ fixture }: Readonly<{ fixture: EvaluationFixture }>) {
  return {
    requirements: fixture.requirements.map(({ classification, id, value }) =>
      ({ classification, id, value })),
    verifiedFacts: fixture.verifiedFacts.map(({ id, kind, value }) => ({ id, kind, value })),
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

type EvaluationFixture = Readonly<{
  name: string
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
  expectedCoverage: readonly JobRequirement['id'][]
}>

type EvaluationMetric = Readonly<{
  inputTokens: number
  latencyMilliseconds: number
  outputTokens: number
}>

const usageSchema = z.object({
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
})

const emptyMetric: EvaluationMetric = {
  inputTokens: Number.POSITIVE_INFINITY,
  latencyMilliseconds: Number.POSITIVE_INFINITY,
  outputTokens: Number.POSITIVE_INFINITY,
}

const evaluationFixtures = [
  {
    name: 'covers exact skills and controlled translations with input provenance',
    requirements: [
      createRequirement({ id: 'job-requirement-typescript', value: 'Know TS' }),
      createRequirement({ id: 'job-requirement-french', value: 'Speak French' }),
    ],
    verifiedFacts: [
      createFact({ id: 'source-fact-typescript', kind: 'skill', value: 'TypeScript' }),
      createFact({ id: 'source-fact-french', kind: 'language', value: 'Français courant' }),
    ],
    expectedCoverage: ['job-requirement-typescript', 'job-requirement-french'],
  },
  {
    name: 'does not infer a required duration from a technology term',
    requirements: [createRequirement({
      id: 'job-requirement-duration', value: '5 years of TypeScript',
    })],
    verifiedFacts: [createFact({
      id: 'source-fact-project', kind: 'experience', value: 'Used TypeScript on one project',
    })],
    expectedCoverage: [],
  },
  {
    name: 'does not infer a skill from a role title',
    requirements: [createRequirement({
      id: 'job-requirement-role', value: 'Know TypeScript',
    })],
    verifiedFacts: [createFact({
      id: 'source-fact-role', kind: 'experience', value: 'Senior TypeScript Developer at Acme',
    })],
    expectedCoverage: [],
  },
  {
    name: 'does not turn a negated skill into evidence',
    requirements: [createRequirement({
      id: 'job-requirement-negation', value: 'Production React experience',
    })],
    verifiedFacts: [createFact({
      id: 'source-fact-negation', kind: 'experience', value: 'No production experience with React',
    })],
    expectedCoverage: [],
  },
  {
    name: 'does not treat React as proof of React Native',
    requirements: [createRequirement({
      id: 'job-requirement-react-native', value: 'Know React Native',
    })],
    verifiedFacts: [createFact({
      id: 'source-fact-react', kind: 'experience', value: 'Used React',
    })],
    expectedCoverage: [],
  },
  {
    name: 'binds experience duration to the matching technology',
    requirements: [createRequirement({
      id: 'job-requirement-typescript-duration', value: '5 years of TypeScript',
    })],
    verifiedFacts: [createFact({
      id: 'source-fact-mixed-duration',
      kind: 'experience',
      value: '5 years of Java, used TypeScript for 1 month',
    })],
    expectedCoverage: [],
  },
] as const satisfies readonly EvaluationFixture[]

function createRequirement({ id, value }: Readonly<{
  id: JobRequirement['id']
  value: string
}>): JobRequirement {
  return {
    classification: 'required',
    groupId: 'job-requirement-group-evaluation',
    id,
    sourceExcerpt: value,
    value,
  }
}

function createFact({ id, kind, value }: Readonly<{
  id: SourceProfileFact['id']
  kind: SourceProfileFact['kind']
  value: string
}>): SourceProfileFact {
  return {
    id,
    kind,
    propositionKey: `proposition-${id}`,
    status: 'verified',
    value,
  }
}
