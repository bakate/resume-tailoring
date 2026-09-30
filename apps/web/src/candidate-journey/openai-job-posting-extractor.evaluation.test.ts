import { createJobMatch } from '@resume-tailoring/application/job-match'
import type { JobMatch } from '@resume-tailoring/application/job-match'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createOpenAiJobPostingExtractor } from './openai-job-posting-extractor'

describe('OpenAI Job Posting extraction representative evaluation', () => {
  it.each(genericDutiesFixtures)('$name', async (fixture) => {
    const evaluation = await evaluateJobPosting({ jobPostingContent: fixture.jobPostingContent })
    console.info(JSON.stringify({ name: fixture.name, ...evaluation.metric,
      requirements: evaluation.requirements.map(summarizeRequirement) }))

    const genericDutyRequirements = evaluation.requirements.filter((requirement) =>
      fixture.genericDuties.some((duty) => citesTerm({ requirement, term: duty })))
    expect(genericDutyRequirements).toHaveLength(1)
    expect(fixture.genericDuties.every((duty) =>
      genericDutyRequirements.every((requirement) => citesTerm({ requirement, term: duty }))))
      .toBe(true)
    expect(genericDutyRequirements[0]?.importance).toBe('complementary')
    expect(findRequirementCiting({ evaluation, term: fixture.emphasizedResponsibility }))
      .toMatchObject({ importance: 'central' })
    expect(findRequirementCiting({ evaluation, term: fixture.mandatoryCapability }))
      .toMatchObject({ importance: 'critical' })
  }, 60_000)

  it.each(distinctCapabilityFixtures)('$name', async (fixture) => {
    const evaluation = await evaluateJobPosting({ jobPostingContent: fixture.jobPostingContent })
    console.info(JSON.stringify({ name: fixture.name, ...evaluation.metric,
      requirements: evaluation.requirements.map(summarizeRequirement) }))

    const requirementsPerCapability = fixture.technicalCapabilities.map((capability) =>
      evaluation.requirements.filter(({ value }) => includesTerm({ term: capability, value })))
    expect(requirementsPerCapability.map((requirements) => requirements.length))
      .toEqual(fixture.technicalCapabilities.map(() => 1))
    expect(new Set(requirementsPerCapability.flat().map(({ id }) => id)).size,
      'Expected each technical capability in its own Job Requirement')
      .toBe(fixture.technicalCapabilities.length)
    expect(requirementsPerCapability.flat().map(({ importance }) => importance))
      .toEqual(fixture.technicalCapabilities.map(() => 'critical'))
  }, 60_000)
})

type JobPostingEvaluation = Readonly<{
  metric: EvaluationMetric
  requirements: JobMatch['requirements']
}>

async function evaluateJobPosting({ jobPostingContent }: Readonly<{
  jobPostingContent: string
}>): Promise<JobPostingEvaluation> {
  const metrics: EvaluationMetric[] = []
  const result = await createJobMatch({
    candidateFacts: [],
    document: { bytes: new TextEncoder().encode(jobPostingContent),
      mediaType: 'text/plain', name: 'job-posting.txt' },
    jobPostingDocumentReader: { read: (document) => Promise.resolve({
      ok: true, value: { text: new TextDecoder().decode(document.bytes) },
    }) },
    jobPostingExtractor: createOpenAiJobPostingExtractor({
      apiKey: readEnvironmentValue({ name: 'OPENAI_API_KEY' }),
      model: readEnvironmentValue({ name: 'OPENAI_STRUCTURED_MODEL' }),
      reasoningEffort: 'low',
      request: createMeasuredRequest({ metrics }),
    }),
    matchEvidenceMatcher: { match: () => Promise.resolve({
      ok: true, value: { evidence: [], relevance: [] },
    }) },
  })
  expect(result.ok, 'Expected a source-backed Job Posting extraction').toBe(true)
  expect(metrics).toHaveLength(1)
  expect(metrics[0]?.latencyMilliseconds).toBeLessThan(45_000)
  return {
    metric: metrics[0] ?? emptyMetric,
    requirements: result.ok ? result.value.requirements : [],
  }
}

function findRequirementCiting({ evaluation, term }: Readonly<{
  evaluation: JobPostingEvaluation
  term: string
}>) {
  const requirements = evaluation.requirements.filter((requirement) =>
    citesTerm({ requirement, term }))
  expect(requirements).toHaveLength(1)
  return requirements[0]
}

function citesTerm({ requirement, term }: Readonly<{
  requirement: JobMatch['requirements'][number]
  term: string
}>) {
  return includesTerm({ term, value: requirement.sourceExcerpt })
}

function includesTerm({ term, value }: Readonly<{ term: string; value: string }>) {
  return normalize({ value }).includes(normalize({ value: term }))
}

function normalize({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFKC').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function summarizeRequirement({ importance, sourceExcerpt, value }:
JobMatch['requirements'][number]) {
  return { importance, sourceExcerpt, value }
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

type EvaluationMetric = Readonly<{
  inputTokens: number
  latencyMilliseconds: number
  outputTokens: number
}>

const emptyMetric = {
  inputTokens: Number.POSITIVE_INFINITY,
  latencyMilliseconds: Number.POSITIVE_INFINITY,
  outputTokens: Number.POSITIVE_INFINITY,
} as const

const usageSchema = z.object({
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
})

const genericDutiesFixtures = [
  {
    name: 'One sentence of generic duties yields one requirement',
    jobPostingContent: [
      'We are hiring a Senior Product Engineer.',
      'Your core mission is to own the architecture of our payments platform.',
      'You will define features, ensure quality and collaborate with product managers.',
      'Strong TypeScript experience is required.',
    ].join('\n'),
    genericDuties: ['define features', 'ensure quality', 'collaborate with product managers'],
    emphasizedResponsibility: 'architecture of our payments platform',
    mandatoryCapability: 'TypeScript',
  },
  {
    name: 'Une phrase de missions génériques produit une seule exigence',
    jobPostingContent: [
      'Nous recrutons un Développeur Full Stack.',
      'Votre mission principale est de concevoir et faire évoluer notre plateforme de paiement.',
      'Vous définirez les fonctionnalités, garantirez la qualité et collaborerez avec les product managers.',
      'La maîtrise de React est obligatoire.',
    ].join('\n'),
    genericDuties: ['définirez les fonctionnalités', 'garantirez la qualité',
      'collaborerez avec les product managers'],
    emphasizedResponsibility: 'plateforme de paiement',
    mandatoryCapability: 'React',
  },
] as const

const distinctCapabilityFixtures = [
  {
    name: 'Distinct technical capabilities in one sentence stay separate',
    jobPostingContent: [
      'We are hiring a Backend Engineer.',
      'Production experience with PostgreSQL, Kafka and Kubernetes is required.',
      'You will define features, ensure quality and collaborate with product managers.',
    ].join('\n'),
    technicalCapabilities: ['PostgreSQL', 'Kafka', 'Kubernetes'],
  },
] as const
