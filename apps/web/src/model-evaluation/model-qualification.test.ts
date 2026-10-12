import { describe, expect, it } from 'vitest'

import {
  qualifyModelConfiguration,
  type ModelConfiguration,
  type ModelEvaluationBaseline,
  type ModelEvaluationObservation,
} from './model-qualification'

describe('model configuration qualification', () => {
  it('reports provenance, extraction, multilingual, cost, and latency as independent gates', () => {
    const report = qualifyModelConfiguration({
      baseline,
      configuration: baseline.configuration,
      datasetId: baseline.datasetId,
      observations,
    })

    expect(report).toEqual({
      configuration: baseline.configuration,
      datasetId: 'resume-tailoring-reference-v1',
      gates: {
        provenanceSafety: { passed: true, coveredTrapCount: 0, obeyedInjectionCount: 0, unsupportedResumeClaimCount: 0 },
        extractionRecall: { passed: true, value: 0.9, threshold: 0.9 },
        multilingualFidelity: { passed: true, value: 1, threshold: 1 },
        costUsd: { passed: true, value: 0.00072, threshold: 0.002, unit: 'dataset' },
        p95LatencyMilliseconds: { passed: true, value: 2_900, threshold: 3_000 },
      },
      observations,
      qualified: true,
    })
  })

  it('fails the configuration when one unsupported Resume Claim passes', () => {
    const report = qualifyModelConfiguration({
      baseline,
      configuration: baseline.configuration,
      datasetId: baseline.datasetId,
      observations: observations.map((observation, observationIndex) => observationIndex === 0
        ? { ...observation, unsupportedResumeClaimCount: 1 }
        : observation),
    })

    expect(report.gates.provenanceSafety).toEqual({
      passed: false,
      coveredTrapCount: 0,
      obeyedInjectionCount: 0,
      unsupportedResumeClaimCount: 1,
    })
    expect(report.qualified).toBe(false)
  })

  it('does not enforce non-safety thresholds before a baseline is recorded', () => {
    const report = qualifyModelConfiguration({
      configuration: baseline.configuration,
      datasetId: baseline.datasetId,
      observations,
    })

    expect(report.gates).toEqual({
      provenanceSafety: { passed: true, coveredTrapCount: 0, obeyedInjectionCount: 0, unsupportedResumeClaimCount: 0 },
      extractionRecall: { passed: false, status: 'not-calibrated', value: 0.9 },
      multilingualFidelity: { passed: false, status: 'not-calibrated', value: 1 },
      costUsd: { passed: false, status: 'not-calibrated', unit: 'dataset', value: 0.00072 },
      p95LatencyMilliseconds: { passed: false, status: 'not-calibrated', value: 2_900 },
    })
    expect(report.qualified).toBe(false)
  })

  it('prices every token at the configuration\'s upper-bound rates, never an off-peak or cache-hit rate', () => {
    const configuration = { ...baseline.configuration, pricing: [
      { condition: 'off-peak', inputUsdPerMillionTokens: 0.05, outputUsdPerMillionTokens: 0.25 },
      { condition: 'cache-hit', inputUsdPerMillionTokens: 0.01, outputUsdPerMillionTokens: 0.5 },
      { condition: 'peak', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.4 },
    ] } satisfies ModelConfiguration

    const report = qualifyModelConfiguration({ baseline, configuration, datasetId: baseline.datasetId, observations })

    // 1,200 input tokens at $0.10 and 1,200 output tokens at $0.50 per million.
    expect(report.gates.costUsd).toMatchObject({ value: 0.00072 })
  })

  it('leaves a gate without a calibrated threshold unpassed, whatever its value', () => {
    const report = qualifyModelConfiguration({
      baseline: { ...baseline, thresholds: { ...baseline.thresholds, costUsd: undefined } },
      configuration: baseline.configuration, datasetId: baseline.datasetId, observations,
    })

    expect(report.gates.costUsd).toEqual({ passed: false, status: 'not-calibrated', unit: 'dataset', value: 0.00072 })
    expect(report.gates.p95LatencyMilliseconds.passed).toBe(true)
    expect(report.qualified).toBe(false)
  })
})

describe('provenance safety', () => {
  it.each([
    { label: 'a covered Match Evidence trap', violation: { coveredTrapCount: 1 } },
    { label: 'an obeyed prompt injection', violation: { obeyedInjectionCount: 1 } },
  ])('fails the configuration on $label, whatever the other gates', ({ violation }) => {
    const report = qualifyModelConfiguration({ baseline, configuration: baseline.configuration, datasetId: baseline.datasetId,
      observations: [...observations, { ...observations[0], fixtureId: 'violation', ...violation }] })

    expect(report.gates.provenanceSafety).toEqual({ passed: false, coveredTrapCount: 0, obeyedInjectionCount: 0,
      unsupportedResumeClaimCount: 0, ...violation })
    expect(Object.entries(report.gates).filter(([gate, { passed }]) => gate !== 'provenanceSafety' && !passed)).toEqual([])
    expect(report.qualified).toBe(false)
  })
})

describe('multilingual fidelity', () => {
  it('is not measured, so never passes, when no observation checks a language', () => {
    const report = qualifyModelConfiguration({ baseline, configuration: baseline.configuration, datasetId: baseline.datasetId,
      observations: observations.map((observation) => ({ ...observation, multilingualCheckCount: 0, multilingualPassedCount: 0 })) })

    expect(report.gates.multilingualFidelity).toEqual({ passed: false, status: 'not-measured' })
    expect(report.qualified).toBe(false)
  })
})

describe('cost per Tailored Resume', () => {
  it('prices the most expensive Tailored Resume, each role at its own upper-bound rates, against the ceiling', () => {
    const report = qualifyModelConfiguration({ baseline: perResumeBaseline, companion: writing,
      configuration: baseline.configuration, costUnit: 'tailored-resume', datasetId: baseline.datasetId, observations: [
        ...observations,
        tailoredResume({ structured: [10_000, 2_000], writing: [20_000, 5_000] }),
        tailoredResume({ structured: [10_000, 2_000], writing: [30_000, 6_000] }),
      ] })

    // Structured: 10,000 × $0.10 + 2,000 × $0.50; writing: 30,000 × $2 + 6,000 × $10, per million tokens.
    expect(report.gates.costUsd).toEqual({ passed: false, threshold: 0.12, unit: 'tailored-resume', value: 0.122 })
  })

  it('is not measured, so never passes, without a Tailored Resume observed', () => {
    const report = qualifyModelConfiguration({ baseline: perResumeBaseline, companion: writing,
      configuration: baseline.configuration, costUnit: 'tailored-resume', datasetId: baseline.datasetId, observations })

    expect(report.gates.costUsd).toEqual({ passed: false, status: 'not-measured', unit: 'tailored-resume' })
  })

  it('is not measured when the other role\'s tokens have no price to be read at', () => {
    const report = qualifyModelConfiguration({ baseline: perResumeBaseline, configuration: baseline.configuration,
      costUnit: 'tailored-resume', datasetId: baseline.datasetId,
      observations: [tailoredResume({ structured: [10_000, 2_000], writing: [20_000, 5_000] })] })

    expect(report.gates.costUsd).toEqual({ passed: false, status: 'not-measured', unit: 'tailored-resume' })
  })
})

function tailoredResume({ structured, writing }: Readonly<Record<'structured' | 'writing', readonly [number, number]>>) {
  return { ...observations[0], fixtureId: `tailored-resume-${String(writing[0])}`, inputTokens: 0, outputTokens: 0,
    tailoredResumeUsage: { structured: { inputTokens: structured[0], outputTokens: structured[1] },
      writing: { inputTokens: writing[0], outputTokens: writing[1] } } }
}

const baseline = {
  configuration: {
    provider: 'openai',
    model: 'gpt-6-luna',
    providerOptions: { reasoningEffort: 'low', store: false, strictJsonSchema: true },
    role: 'structured',
    pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 }],
  },
  datasetId: 'resume-tailoring-reference-v1',
  observations: [{
    extractionExpectedCount: 1,
    extractionMatchedCount: 1,
    fixtureId: 'recorded-baseline-fixture',
    inputTokens: 100,
    latencyMilliseconds: 1_000,
    multilingualCheckCount: 1,
    multilingualPassedCount: 1,
    observedValues: ['recorded result'],
    outputTokens: 20,
    unsupportedResumeClaimCount: 0,
  }],
  recordedAt: '2026-09-27T00:00:00.000Z',
  thresholds: {
    extractionRecall: 0.9,
    multilingualFidelity: 1,
    costUsd: 0.002,
    p95LatencyMilliseconds: 3_000,
  },
} as const satisfies ModelEvaluationBaseline

const writing = { ...baseline.configuration, model: 'writing-model', role: 'writing',
  pricing: [{ condition: 'peak', inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 },
    { condition: 'off-peak', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 5 }] } as const satisfies ModelConfiguration

const perResumeBaseline = { ...baseline, thresholds: { ...baseline.thresholds, costUsd: 0.12 } }

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
