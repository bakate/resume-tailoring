import type { ModelConfiguration } from './model-qualification'

export const structuredModelConfiguration = {
  provider: 'openai',
  model: 'gpt-6-luna',
  pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 }],
  providerOptions: { reasoningEffort: 'low', store: false, strictJsonSchema: true },
  role: 'structured',
} as const satisfies ModelConfiguration

export const writingModelConfiguration = {
  provider: 'openai',
  model: 'gpt-6-sol',
  pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 }],
  providerOptions: { reasoningEffort: 'medium', store: false, strictJsonSchema: true },
  role: 'writing',
} as const satisfies ModelConfiguration
