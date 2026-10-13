import type { ModelConfiguration } from './model-qualification'
import type { QualificationCandidate } from './model-qualification-runner'

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

/** Every configuration `pnpm test:evaluation:record <candidate>` records, with the same provider's other role. */
export const modelConfigurationCandidates = {
  'openai-structured': { configuration: structuredModelConfiguration, companion: writingModelConfiguration },
  'openai-writing': { configuration: writingModelConfiguration, companion: structuredModelConfiguration },
} as const satisfies Readonly<Record<string, QualificationCandidate>>
