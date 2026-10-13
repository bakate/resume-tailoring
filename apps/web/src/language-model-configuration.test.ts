import { describe, expect, it } from 'vitest'

import { createOpenAiModelConfiguration } from './language-model-configuration'
import type { RoleModelConfigurations } from './language-model-configuration'

const qualifiedStructured = createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' })

describe('Qualified Model Configuration', () => {
  it('freezes stateless requests and strict Structured Outputs for OpenAI', () => {
    const configuration = createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' })

    expect(configuration).toEqual({ provider: 'openai', model: 'gpt-6-luna', role: 'structured',
      providerOptions: { reasoningEffort: 'low', store: false, strictJsonSchema: true } })
  })

  it('keeps a fallback on the provider of the active configuration', () => {
    const structured: RoleModelConfigurations<'openai'> = {
      active: qualifiedStructured,
      // @ts-expect-error A fallback never names another provider than the active one: it would be an unconsented processor.
      fallback: { ...qualifiedStructured, provider: 'another-provider' },
    }

    expect(structured.active.provider).toBe('openai')
  })
})
