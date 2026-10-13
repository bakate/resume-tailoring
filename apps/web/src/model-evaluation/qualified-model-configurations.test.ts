import { describe, expect, it } from 'vitest'

import { createOpenAiModelConfiguration } from '../language-model-configuration'
import { qualifyModelConfiguration, type ModelConfiguration } from './model-qualification'
import { createModelEvaluationObservation } from './model-qualification-runner'
import {
  isQualifiedModelConfiguration,
  recordedModelQualificationReports,
} from './qualified-model-configurations'

describe('qualified model configurations', () => {
  it('records only passing qualification reports', () => {
    const reports = recordedModelQualificationReports

    const failingReports = reports.filter(({ qualified }) => !qualified)

    expect(failingReports).toEqual([])
  })

  it('derives fallback eligibility from passing recorded reports', () => {
    const configuration = createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' })

    const qualified = isQualifiedModelConfiguration({ configuration })

    expect(qualified).toBe(true)
  })

  it('rejects a configuration without a passing recorded report', () => {
    const configuration = createOpenAiModelConfiguration({ model: 'gpt-6-sol', reasoningEffort: 'medium', role: 'structured' })

    const qualified = isQualifiedModelConfiguration({ configuration })

    expect(qualified).toBe(false)
  })

  it.each([
    { label: 'stored requests', providerOptions: { reasoningEffort: 'low', store: true, strictJsonSchema: true } },
    { label: 'non-strict Structured Outputs', providerOptions: { reasoningEffort: 'low', store: false, strictJsonSchema: false } },
  ])('rejects a qualified model whose provider options allow $label', ({ providerOptions }) => {
    const configuration = { provider: 'openai', model: 'gpt-6-luna', role: 'structured', providerOptions } as never

    expect(isQualifiedModelConfiguration({ configuration })).toBe(false)
  })

  it('rejects a qualified model reached through another provider', () => {
    const configuration = { ...createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' }),
      provider: 'another-provider' } as never

    expect(isQualifiedModelConfiguration({ configuration })).toBe(false)
  })

  describe('once a configuration is recorded', () => {
    it('qualifies exactly the recorded configuration', () => {
      const qualified = isQualifiedModelConfiguration({ configuration: recordedConfiguration, reports: [recordedReport] })

      expect(qualified).toBe(true)
    })

    it.each(optionChanges)('makes the configuration unqualified when $label changes', ({ providerOptions }) => {
      const changed = { ...recordedConfiguration, providerOptions } as unknown as ModelConfiguration

      const qualified = isQualifiedModelConfiguration({ configuration: changed, reports: [recordedReport] })

      expect(qualified).toBe(false)
    })

    it.each(optionChanges)('qualifies the configuration again once it is recorded with $label changed', ({ providerOptions }) => {
      const changed = { ...recordedConfiguration, providerOptions } as unknown as ModelConfiguration
      const reports = [recordedReport, recordReport(changed)]

      const qualified = isQualifiedModelConfiguration({ configuration: changed, reports })

      expect(qualified).toBe(true)
    })
  })
})

// Per-operation options, as a provider that budgets output tokens per operation records them.
const recordedConfiguration = {
  provider: 'scripted', model: 'scripted-writing', role: 'writing',
  pricing: [{ condition: 'peak', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 4 }],
  providerOptions: { thinking: 'low',
    outputTokenBudgets: { 'explainable-match-evidence': 32_000, 'resume-section-writing': 16_000 } },
} as unknown as ModelConfiguration

const recordedReport = recordReport(recordedConfiguration)

const optionChanges = [
  { label: 'a reasoning effort', providerOptions: { ...recordedConfiguration.providerOptions, thinking: 'high' } },
  { label: 'an output token budget', providerOptions: { ...recordedConfiguration.providerOptions,
    outputTokenBudgets: { 'explainable-match-evidence': 32_000, 'resume-section-writing': 8_000 } } },
  { label: 'an added option', providerOptions: { ...recordedConfiguration.providerOptions, temperature: 0 } },
  { label: 'a removed option', providerOptions: { thinking: 'low' } },
]

function recordReport(configuration: ModelConfiguration) {
  const observations = [createModelEvaluationObservation({ fixtureId: 'recorded', extractionExpectedCount: 1,
    extractionMatchedCount: 1, inputTokens: 10, latencyMilliseconds: 10, multilingualCheckCount: 1, multilingualPassedCount: 1,
    outputTokens: 10 })]
  return qualifyModelConfiguration({ configuration, datasetId: 'recorded-v1', observations, baseline: {
    configuration, datasetId: 'recorded-v1', observations, recordedAt: '2026-10-12T10:00:00.000Z',
    thresholds: { costUsd: 1, extractionRecall: 1, multilingualFidelity: 1, p95LatencyMilliseconds: 1_000 } } })
}
