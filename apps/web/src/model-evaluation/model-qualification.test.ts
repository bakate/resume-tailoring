import { describe, expect, it } from 'vitest'

import {
  qualifyModelConfiguration,
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
        provenanceSafety: { passed: true, unsupportedResumeClaimCount: 0 },
        extractionRecall: { passed: true, value: 0.9, threshold: 0.9 },
        multilingualFidelity: { passed: true, value: 1, threshold: 1 },
        costUsd: { passed: true, value: 0.00072, threshold: 0.002 },
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
      provenanceSafety: { passed: true, unsupportedResumeClaimCount: 0 },
      extractionRecall: { passed: false, status: 'not-calibrated', value: 0.9 },
      multilingualFidelity: { passed: false, status: 'not-calibrated', value: 1 },
      costUsd: { passed: false, status: 'not-calibrated', value: 0.00072 },
      p95LatencyMilliseconds: { passed: false, status: 'not-calibrated', value: 2_900 },
    })
    expect(report.qualified).toBe(false)
  })
})

const baseline = {
  configuration: {
    model: 'gpt-6-luna',
    reasoningEffort: 'low',
    role: 'structured',
    pricing: { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 },
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
