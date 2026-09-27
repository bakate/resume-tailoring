import type { ModelConfiguration } from './model-qualification'

export const structuredModelConfiguration = {
  model: 'gpt-6-luna',
  pricing: { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 },
  reasoningEffort: 'low',
  role: 'structured',
} as const satisfies ModelConfiguration

export const writingModelConfiguration = {
  model: 'gpt-6-sol',
  pricing: { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 },
  reasoningEffort: 'medium',
  role: 'writing',
} as const satisfies ModelConfiguration
