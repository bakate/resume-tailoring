import { describe, expect, it } from 'vitest'

import { createOpenAiModelConfiguration, type ModelOperation } from '../language-model-configuration'
import {
  qualifyModelConfiguration,
  type ModelConfiguration,
  type ModelEvaluationObservation,
  type ModelEvaluationThresholds,
  type RecordedModelEvaluationRun,
} from './model-qualification'

describe('model configuration qualification', () => {
  it('reports provenance, extraction, multilingual, cost, and latency as independent gates', () => {
    const report = qualifyModelConfiguration({ recordedRun, thresholds })

    expect(report).toEqual({
      configuration: structured,
      // The companion has no 'standard' price, so its share reads its upper-bound rates.
      costUsdByPriceCondition: { standard: 0.092 },
      datasetId: 'recorded-v1',
      gates: {
        provenanceSafety: { passed: true, coveredTrapCount: 0, obeyedInjectionCount: 0, unsupportedResumeClaimCount: 0 },
        extractionRecall: { passed: true, value: 0.9, threshold: 0.9 },
        multilingualFidelity: { passed: true, value: 1, threshold: 1 },
        // Structured: 10,000 × $0.10 + 2,000 × $0.50; writing: 20,000 × $2 + 5,000 × $10, per million tokens.
        costUsd: { passed: true, value: 0.092, threshold: 0.12 },
        p95LatencyMilliseconds: { passed: true, value: 2_900, threshold: 3_000 },
      },
      observations: recordedRun.observations,
      operations: {},
      qualified: true,
    })
  })

  it('fails the configuration when one unsupported Resume Claim passes', () => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun,
      observations: recordedRun.observations.map((observation, observationIndex) => observationIndex === 0
        ? { ...observation, unsupportedResumeClaimCount: 1 } : observation) } })

    expect(report.gates.provenanceSafety).toEqual({
      passed: false,
      coveredTrapCount: 0,
      obeyedInjectionCount: 0,
      unsupportedResumeClaimCount: 1,
    })
    expect(report.qualified).toBe(false)
  })

  it('enforces no threshold it is not given', () => {
    const report = qualifyModelConfiguration({ recordedRun, thresholds: {} })

    expect(report.gates).toEqual({
      provenanceSafety: { passed: true, coveredTrapCount: 0, obeyedInjectionCount: 0, unsupportedResumeClaimCount: 0 },
      extractionRecall: { passed: false, status: 'not-calibrated', value: 0.9 },
      multilingualFidelity: { passed: false, status: 'not-calibrated', value: 1 },
      costUsd: { passed: false, status: 'not-calibrated', value: 0.092 },
      p95LatencyMilliseconds: { passed: false, status: 'not-calibrated', value: 2_900 },
    })
    expect(report.qualified).toBe(false)
  })

  it('leaves a gate without a calibrated threshold unpassed, whatever its value', () => {
    const report = qualifyModelConfiguration({ recordedRun, thresholds: { ...thresholds, costUsd: undefined } })

    expect(report.gates.costUsd).toEqual({ passed: false, status: 'not-calibrated', value: 0.092 })
    expect(report.gates.p95LatencyMilliseconds.passed).toBe(true)
    expect(report.qualified).toBe(false)
  })
})

describe('provenance safety', () => {
  it.each([
    { label: 'a covered Match Evidence trap', violation: { coveredTrapCount: 1 } },
    { label: 'an obeyed prompt injection', violation: { obeyedInjectionCount: 1 } },
  ])('fails the configuration on $label, whatever the other gates', ({ violation }) => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun,
      observations: [...recordedRun.observations, { ...observations[0], fixtureId: 'violation', ...violation }] } })

    expect(report.gates.provenanceSafety).toEqual({ passed: false, coveredTrapCount: 0, obeyedInjectionCount: 0,
      unsupportedResumeClaimCount: 0, ...violation })
    expect(Object.entries(report.gates).filter(([gate, { passed }]) => gate !== 'provenanceSafety' && !passed)).toEqual([])
    expect(report.qualified).toBe(false)
  })
})

describe('multilingual fidelity', () => {
  it('is not measured, so never passes, when no observation checks a language', () => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun,
      observations: recordedRun.observations.map((observation) => ({ ...observation, multilingualCheckCount: 0,
        multilingualPassedCount: 0 })) } })

    expect(report.gates.multilingualFidelity).toEqual({ passed: false, status: 'not-measured' })
    expect(report.qualified).toBe(false)
  })
})

describe('cost per Tailored Resume', () => {
  it('prices the most expensive Tailored Resume, each role at its own upper-bound rates, against the ceiling', () => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun, observations: [...observations,
      tailoredResume({ structured: [10_000, 2_000], writing: [20_000, 5_000] }),
      tailoredResume({ structured: [10_000, 2_000], writing: [30_000, 6_000] })] } })

    // Structured: 10,000 × $0.10 + 2,000 × $0.50; writing: 30,000 × $2 + 6,000 × $10, per million tokens.
    expect(report.gates.costUsd).toEqual({ passed: false, threshold: 0.12, value: 0.122 })
  })

  it('prices every token at the configuration\'s upper-bound rates, never an off-peak or cache-hit rate', () => {
    const configuration = { ...structured, pricing: [
      { condition: 'off-peak', inputUsdPerMillionTokens: 0.05, outputUsdPerMillionTokens: 0.25 },
      { condition: 'cache-hit', inputUsdPerMillionTokens: 0.01, outputUsdPerMillionTokens: 0.5 },
      { condition: 'peak', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.4 },
    ] } satisfies ModelConfiguration

    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun, configuration } })

    // The structured share still reads $0.10 input and $0.50 output per million: the highest of each.
    expect(report.gates.costUsd).toMatchObject({ value: 0.092 })
  })

  it('reports the most expensive Tailored Resume under each price condition, each role at that condition\'s rates', () => {
    const configuration = { ...structured, pricing: [
      { condition: 'off-peak', inputUsdPerMillionTokens: 0.05, outputUsdPerMillionTokens: 0.25 },
      { condition: 'peak', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 },
    ] } satisfies ModelConfiguration

    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun, configuration } })

    // Off-peak: 10,000 × $0.05 + 2,000 × $0.25 and 20,000 × $1 + 5,000 × $5; at peak, twice that.
    expect(report.costUsdByPriceCondition).toEqual({ 'off-peak': 0.046, peak: 0.092 })
  })

  it('reports no cost per price condition without a Tailored Resume observed', () => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun, observations } })

    expect(report.costUsdByPriceCondition).toEqual({})
  })

  it('is not measured, so never passes, without a Tailored Resume observed', () => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun, observations } })

    expect(report.gates.costUsd).toEqual({ passed: false, status: 'not-measured' })
  })

  it('is not measured when the other role\'s tokens have no price to be read at', () => {
    const { configuration, datasetId, observations: recorded, recordedAt } = recordedRun

    const report = qualifyModelConfiguration({ thresholds, recordedRun: { configuration, datasetId, observations: recorded,
      recordedAt } })

    expect(report.gates.costUsd).toEqual({ passed: false, status: 'not-measured' })
  })
})

describe('model operations', () => {
  it('reports each operation\'s calls, conformance retries and p95 latency against its own deadline', () => {
    const calls = [
      callObservation({ latencyMilliseconds: 1_000, operation: 'explainable-match-evidence' }),
      callObservation({ latencyMilliseconds: 4_000, operation: 'explainable-match-evidence', conformance: 'conformance-retry' }),
      callObservation({ latencyMilliseconds: 2_000, operation: 'explainable-match-evidence' }),
      callObservation({ latencyMilliseconds: 3_000, operation: 'explainable-match-evidence' }),
      callObservation({ latencyMilliseconds: 500, operation: 'structured-source-profile-extraction',
        conformance: 'conformance-retry-skipped' }),
    ]

    const report = qualifyModelConfiguration({ thresholds, recordedRun: { ...recordedRun, observations: [...observations, ...calls] } })

    // A retry skipped for want of time still counts a first answer that did not conform.
    expect(report.operations).toEqual({
      'explainable-match-evidence': { callCount: 4, conformanceRetryCount: 1, conformanceRetrySkippedCount: 0,
        conformanceRetryRate: 0.25, deadlineMilliseconds: 90_000, p95LatencyMilliseconds: 4_000 },
      'structured-source-profile-extraction': { callCount: 1, conformanceRetryCount: 0, conformanceRetrySkippedCount: 1,
        conformanceRetryRate: 1, deadlineMilliseconds: 90_000, p95LatencyMilliseconds: 500 },
    })
  })

  it('leaves the operation summary empty when no observation is a model call', () => {
    const report = qualifyModelConfiguration({ thresholds, recordedRun })

    expect(report.operations).toEqual({})
  })
})

function callObservation({ conformance, latencyMilliseconds, operation }: Readonly<{
  conformance?: 'conformance-retry' | 'conformance-retry-skipped'
  latencyMilliseconds: number
  operation: ModelOperation
}>): ModelEvaluationObservation {
  return { ...createObservation({ fixtureId: `call:${operation}`, extractionExpectedCount: 0, extractionMatchedCount: 0,
    inputTokens: 100, latencyMilliseconds, multilingualCheckCount: 0, multilingualPassedCount: 0, outputTokens: 10 }),
  operation, observedValues: ['answered', ...conformance === undefined ? [] : [conformance]] }
}

const structured = {
  ...createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' }),
  pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 }],
} as const satisfies ModelConfiguration

const writing = { ...structured, model: 'writing-model', role: 'writing',
  pricing: [{ condition: 'peak', inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 },
    { condition: 'off-peak', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 5 }] } as const satisfies ModelConfiguration

const thresholds = {
  extractionRecall: 0.9,
  multilingualFidelity: 1,
  costUsd: 0.12,
  p95LatencyMilliseconds: 3_000,
} as const satisfies ModelEvaluationThresholds

const observations = [
  createObservation({
    fixtureId: 'source-profile-extraction-en',
    extractionExpectedCount: 10,
    extractionMatchedCount: 9,
    inputTokens: 1_000,
    latencyMilliseconds: 1_000,
    multilingualCheckCount: 0,
    multilingualPassedCount: 0,
    outputTokens: 200,
  }),
  createObservation({
    fixtureId: 'resume-claim-translation-fr',
    extractionExpectedCount: 0,
    extractionMatchedCount: 0,
    inputTokens: 200,
    latencyMilliseconds: 2_900,
    multilingualCheckCount: 2,
    multilingualPassedCount: 2,
    outputTokens: 1_000,
  }),
] as const satisfies readonly ModelEvaluationObservation[]

const recordedRun = {
  companion: writing,
  configuration: structured,
  datasetId: 'recorded-v1',
  observations: [...observations, tailoredResume({ structured: [10_000, 2_000], writing: [20_000, 5_000] })],
  recordedAt: '2026-10-13T00:00:00.000Z',
} as const satisfies RecordedModelEvaluationRun

function tailoredResume({ structured: structuredUsage, writing: writingUsage }:
Readonly<Record<'structured' | 'writing', readonly [number, number]>>): ModelEvaluationObservation {
  return { ...observations[0], extractionExpectedCount: 0, extractionMatchedCount: 0, latencyMilliseconds: 0,
    fixtureId: `tailored-resume-${String(writingUsage[0])}`, inputTokens: 0, outputTokens: 0,
    tailoredResumeUsage: { structured: { inputTokens: structuredUsage[0], outputTokens: structuredUsage[1] },
      writing: { inputTokens: writingUsage[0], outputTokens: writingUsage[1] } } }
}

function createObservation({
  extractionExpectedCount,
  extractionMatchedCount,
  fixtureId,
  inputTokens,
  latencyMilliseconds,
  multilingualCheckCount,
  multilingualPassedCount,
  outputTokens,
}: Omit<ModelEvaluationObservation,
  'observedValues' | 'unsupportedResumeClaimCount'>): ModelEvaluationObservation {
  return {
    extractionExpectedCount,
    extractionMatchedCount,
    fixtureId,
    inputTokens,
    latencyMilliseconds,
    multilingualCheckCount,
    multilingualPassedCount,
    observedValues: [],
    outputTokens,
    unsupportedResumeClaimCount: 0,
  }
}
