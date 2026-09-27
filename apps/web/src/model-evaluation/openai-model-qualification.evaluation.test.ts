import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ProposedResumeClaim } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import { createOpenAiJobRequirementExtractor } from '../resume-tailoring/openai-job-requirement-extractor'
import { createOpenAiMatchEvidenceMatcher } from '../resume-tailoring/openai-match-evidence-matcher'
import {
  createOpenAiResumeClaimSemanticValidator,
  createOpenAiResumeClaimWriter,
} from '../resume-tailoring/openai-resume-claim-service'
import { createOpenAiSourceProfileExtractor } from '../resume-tailoring/openai-source-profile-extractor'
import {
  structuredModelEvaluationBaseline,
  writingModelEvaluationBaseline,
} from './model-evaluation-baselines'
import {
  qualifyModelConfiguration,
  type ModelEvaluationObservation,
} from './model-qualification'
import { referenceModelEvaluationDataset } from './reference-dataset'
import { matchesExpectedLocale } from './writing-language-fidelity'

describe('OpenAI model configuration qualification', () => {
  it('qualifies the structured model independently', async () => {
    const observations = await evaluateStructuredConfiguration()
    const report = qualifyModelConfiguration({
      baseline: structuredModelEvaluationBaseline,
      configuration: structuredModelEvaluationBaseline.configuration,
      datasetId: referenceModelEvaluationDataset.id,
      observations,
    })
    console.info(JSON.stringify(report))

    expect(report.qualified).toBe(true)
  }, 180_000)

  it('qualifies the writing model independently', async () => {
    const observations = await evaluateWritingConfiguration()
    const report = qualifyModelConfiguration({
      baseline: writingModelEvaluationBaseline,
      configuration: writingModelEvaluationBaseline.configuration,
      datasetId: referenceModelEvaluationDataset.id,
      observations,
    })
    console.info(JSON.stringify(report))

    expect(report.qualified).toBe(true)
  }, 180_000)
})

type EvaluationFixture = typeof referenceModelEvaluationDataset.fixtures[number]
type FixtureByCapability<TCapability extends EvaluationFixture['capability']> =
  Extract<EvaluationFixture, { capability: TCapability }>
type StructuredScoringRequest<TCapability extends EvaluationFixture['capability']> = Readonly<{
  fixture: FixtureByCapability<TCapability>
  request: typeof fetch
}>
type RequestMetric = Readonly<{
  inputTokens: number
  latencyMilliseconds: number
  outputTokens: number
}>

async function evaluateStructuredConfiguration() {
  const observations: ModelEvaluationObservation[] = []
  for (const fixture of referenceModelEvaluationDataset.fixtures) {
    if (fixture.role !== 'structured') continue
    observations.push(await evaluateStructuredFixture({ fixture }))
  }
  return observations
}

async function evaluateStructuredFixture({ fixture }: Readonly<{
  fixture: Extract<EvaluationFixture, { role: 'structured' }>
}>): Promise<ModelEvaluationObservation> {
  const metrics: RequestMetric[] = []
  const request = createMeasuredRequest({ metrics })
  const scores = await scoreStructuredFixture({ fixture, request })
  return createObservation({ fixtureId: fixture.id, metrics, ...scores })
}

async function scoreStructuredFixture({
  fixture,
  request,
}: Readonly<{
  fixture: Extract<EvaluationFixture, { role: 'structured' }>
  request: typeof fetch
}>) {
  if (fixture.capability === 'source-profile-extraction') {
    return scoreSourceProfileExtraction({ fixture, request })
  }
  if (fixture.capability === 'job-requirement-extraction') {
    return scoreJobRequirementExtraction({ fixture, request })
  }
  if (fixture.capability === 'matching') return scoreMatching({ fixture, request })
  return scoreValidation({ fixture, request })
}

async function scoreSourceProfileExtraction({ fixture, request }:
StructuredScoringRequest<'source-profile-extraction'>) {
  const configuration = structuredModelEvaluationBaseline.configuration
  const extractor = createOpenAiSourceProfileExtractor({
    apiKey: readApiKey(), model: configuration.model,
    reasoningEffort: configuration.reasoningEffort, request,
  })
  const result = await extractor.extract({ professionalContent: fixture.professionalContent })
  const values = result.ok ? result.value.map(({ value }) => value) : []
  return createExtractionScores({ expectedValues: fixture.expectedValues, values })
}

async function scoreJobRequirementExtraction({ fixture, request }:
StructuredScoringRequest<'job-requirement-extraction'>) {
  const configuration = structuredModelEvaluationBaseline.configuration
  const extractor = createOpenAiJobRequirementExtractor({
    apiKey: readApiKey(), model: configuration.model,
    reasoningEffort: configuration.reasoningEffort, request,
  })
  const result = await extractor.extract({ jobPostingContent: fixture.jobPostingContent })
  const values = result.ok
    ? result.value.requirements.map(({ sourceExcerpt }) => sourceExcerpt)
    : []
  const scores = createExtractionScores({ expectedValues: fixture.expectedSourceExcerpts, values })
  return {
    ...scores,
    multilingualCheckCount: fixture.expectedSourceExcerpts.length,
    multilingualPassedCount: scores.extractionMatchedCount,
  }
}

async function scoreMatching({ fixture, request }: StructuredScoringRequest<'matching'>) {
  const configuration = structuredModelEvaluationBaseline.configuration
  const matcher = createOpenAiMatchEvidenceMatcher({
    apiKey: readApiKey(), model: configuration.model,
    reasoningEffort: configuration.reasoningEffort, request,
  })
  const result = await matcher.match({
    requirements: fixture.requirements,
    verifiedFacts: fixture.verifiedFacts,
  })
  const values = result.ok ? result.value.evidence.map(({ requirementId }) => requirementId) : []
  const scores = createExtractionScores({ expectedValues: fixture.expectedRequirementIds, values })
  return {
    ...scores,
    multilingualCheckCount: fixture.expectedRequirementIds.length,
    multilingualPassedCount: scores.extractionMatchedCount,
  }
}

async function scoreValidation({ fixture, request }: StructuredScoringRequest<'validation'>) {
  const configuration = structuredModelEvaluationBaseline.configuration
  const validator = createOpenAiResumeClaimSemanticValidator({
    apiKey: readApiKey(), model: configuration.model,
    reasoningEffort: configuration.reasoningEffort, request,
  })
  const result = await validator.validate({
    claim: fixture.claim,
    verifiedFacts: fixture.verifiedFacts,
  })
  const unsupportedResumeClaimCount = result.ok && !result.value.supported ? 0 : 1
  const observedValues = result.ok
    ? [`supported:${String(result.value.supported)}`]
    : ['validation-unavailable']
  return { ...emptyScores, observedValues, unsupportedResumeClaimCount }
}

async function evaluateWritingConfiguration() {
  const observations: ModelEvaluationObservation[] = []
  for (const fixture of referenceModelEvaluationDataset.fixtures) {
    if (fixture.role !== 'writing') continue
    observations.push(await evaluateWritingFixture({ fixture }))
  }
  return observations
}

async function evaluateWritingFixture({ fixture }: Readonly<{
  fixture: Extract<EvaluationFixture, { role: 'writing' }>
}>): Promise<ModelEvaluationObservation> {
  const metrics: RequestMetric[] = []
  const request = createMeasuredRequest({ metrics })
  const claims = await writeFixtureClaims({ fixture, request })
  const claimTexts = claims.flatMap(({ segments }) => segments.map(({ text }) => text))
  const supportedClaimCount = await countSupportedClaims({ claims, fixture })
  const scores = scoreWritingClaims({
    claimCount: claims.length, claimTexts, fixture, supportedClaimCount,
  })
  return createObservation({ fixtureId: fixture.id, metrics, ...scores })
}

async function writeFixtureClaims({ fixture, request }: Readonly<{
  fixture: Extract<EvaluationFixture, { role: 'writing' }>
  request: typeof fetch
}>): Promise<readonly ProposedResumeClaim[]> {
  const configuration = writingModelEvaluationBaseline.configuration
  const writer = createOpenAiResumeClaimWriter({
    apiKey: readApiKey(), model: configuration.model,
    reasoningEffort: configuration.reasoningEffort, request,
  })
  if (fixture.capability === 'translation') {
    const result = await writer.reformulate({
      ...fixture.writingInputs, claim: fixture.claim, feedback: [],
      request: fixture.reformulationRequest,
    })
    return result.ok ? [result.value] : []
  }
  const result = await writer.write(fixture.writingInputs)
  return result.ok ? result.value : []
}

async function countSupportedClaims({ claims, fixture }: Readonly<{
  claims: readonly ProposedResumeClaim[]
  fixture: Extract<EvaluationFixture, { role: 'writing' }>
}>) {
  const validator = createStructuredSemanticValidator()
  const validations = await Promise.all(claims.map((claim, claimIndex) => validator.validate({
    claim: { ...claim, id: `resume-claim-evaluation-${String(claimIndex)}` },
    verifiedFacts: fixture.writingInputs.verifiedFacts,
  })))
  return validations.filter((result) => result.ok && result.value.supported).length
}

function scoreWritingClaims({ claimCount, claimTexts, fixture, supportedClaimCount }: Readonly<{
  claimCount: number
  claimTexts: readonly string[]
  fixture: Extract<EvaluationFixture, { role: 'writing' }>
  supportedClaimCount: number
}>): EvaluationScores {
  const unsupportedResumeClaimCount = claimCount === 0 ? 1 : claimCount - supportedClaimCount
  const claimsSupported = unsupportedResumeClaimCount === 0
  const fidelity = scoreWritingFidelity({ claimTexts, claimsSupported, fixture })
  return {
    ...emptyScores,
    multilingualCheckCount: fidelity.checkCount,
    multilingualPassedCount: fidelity.passedCount,
    observedValues: claimTexts,
    unsupportedResumeClaimCount,
  }
}

function scoreWritingFidelity({ claimTexts, claimsSupported, fixture }: Readonly<{
  claimTexts: readonly string[]
  claimsSupported: boolean
  fixture: Extract<EvaluationFixture, { role: 'writing' }>
}>) {
  const expectedTermsPassed = countIncludedValues({
    values: claimTexts, expectedValues: fixture.expectedTerms,
  })
  const localePassed = matchesExpectedLocale({
    locale: fixture.expectedLocale,
    value: claimTexts.join(' '),
  }) ? 1 : 0
  return {
    checkCount: fixture.expectedTerms.length + 2,
    passedCount: expectedTermsPassed + localePassed + Number(claimsSupported),
  }
}

function createStructuredSemanticValidator() {
  const configuration = structuredModelEvaluationBaseline.configuration
  return createOpenAiResumeClaimSemanticValidator({
    apiKey: readApiKey(), model: configuration.model,
    reasoningEffort: configuration.reasoningEffort,
  })
}

function createExtractionScores({
  expectedValues,
  values,
}: Readonly<{ expectedValues: readonly string[]; values: readonly string[] }>) {
  return {
    ...emptyScores,
    extractionExpectedCount: expectedValues.length,
    extractionMatchedCount: countIncludedValues({ expectedValues, values }),
    observedValues: values,
  }
}

function countIncludedValues({
  expectedValues,
  values,
}: Readonly<{ expectedValues: readonly string[]; values: readonly string[] }>) {
  return expectedValues.filter((expectedValue) => values.some((value) =>
    normalize({ value }).includes(normalize({ value: expectedValue })))).length
}

function normalize({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFKC').toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function createMeasuredRequest({ metrics }: Readonly<{ metrics: RequestMetric[] }>): typeof fetch {
  return async (input, init) => {
    const startedAt = performance.now()
    const response = await fetch(input, init)
    const parsedUsage = usageSchema.safeParse(await response.clone().json())
    if (parsedUsage.success) metrics.push({
      inputTokens: parsedUsage.data.usage.input_tokens,
      latencyMilliseconds: Math.round(performance.now() - startedAt),
      outputTokens: parsedUsage.data.usage.output_tokens,
    })
    return response
  }
}

function createObservation({
  fixtureId,
  metrics,
  ...scores
}: Readonly<{
  fixtureId: string
  metrics: readonly RequestMetric[]
}> & typeof emptyScores): ModelEvaluationObservation {
  return {
    fixtureId,
    ...scores,
    inputTokens: sum({ values: metrics.map(({ inputTokens }) => inputTokens) }),
    latencyMilliseconds: sum({ values: metrics.map(({ latencyMilliseconds }) => latencyMilliseconds) }),
    outputTokens: sum({ values: metrics.map(({ outputTokens }) => outputTokens) }),
  }
}

function readApiKey() {
  const apiKey = process.env.OPENAI_API_KEY
  expect(apiKey, 'OPENAI_API_KEY must be configured for live evaluation').toBeTruthy()
  return apiKey ?? ''
}

function sum({ values }: Readonly<{ values: readonly number[] }>) {
  return values.reduce((total, value) => total + value, 0)
}

type EvaluationScores = Pick<ModelEvaluationObservation,
  | 'extractionExpectedCount'
  | 'extractionMatchedCount'
  | 'multilingualCheckCount'
  | 'multilingualPassedCount'
  | 'observedValues'
  | 'unsupportedResumeClaimCount'>

const emptyScores: EvaluationScores = {
  extractionExpectedCount: 0,
  extractionMatchedCount: 0,
  multilingualCheckCount: 0,
  multilingualPassedCount: 0,
  observedValues: [],
  unsupportedResumeClaimCount: 0,
}

const usageSchema = z.object({
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
})
