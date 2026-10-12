import { describe, expect, it } from 'vitest'

import { createOpenAiModelConfiguration } from '../language-model-configuration'
import {
  isQualifiedModelConfiguration,
  recordedModelQualificationReports,
} from './qualified-model-configurations'

describe('qualified model configurations', () => {
  it('derives fallback eligibility from passing recorded reports', () => {
    expect(recordedModelQualificationReports.every(({ qualified }) => qualified)).toBe(true)
    expect(isQualifiedModelConfiguration({ configuration: createOpenAiModelConfiguration({
      model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured',
    }) })).toBe(true)
  })

  it('rejects a configuration without a passing recorded report', () => {
    expect(isQualifiedModelConfiguration({ configuration: createOpenAiModelConfiguration({
      model: 'gpt-6-sol', reasoningEffort: 'medium', role: 'structured',
    }) })).toBe(false)
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
})
