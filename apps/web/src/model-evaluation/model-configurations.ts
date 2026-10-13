import { createDeepSeekModelConfiguration, createOpenAiModelConfiguration } from '../language-model-configuration'
import type { ModelConfiguration } from './model-qualification'
import type { QualificationCandidate } from './model-qualification-runner'

export const structuredModelConfiguration = {
  ...createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' }),
  pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 }],
} as const satisfies ModelConfiguration

export const writingModelConfiguration = {
  ...createOpenAiModelConfiguration({ model: 'gpt-6-sol', reasoningEffort: 'medium', role: 'writing' }),
  pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 }],
} as const satisfies ModelConfiguration

/**
 * The DeepSeek configurations BAK-171 recommends, `deepseek-flash` for both roles, at its cache-miss prices off-peak
 * and at peak. They stay unqualified, so the server refuses them, until BAK-167 records their baselines.
 */
const deepSeekFlashPricing = [
  { condition: 'off-peak, cache miss', inputUsdPerMillionTokens: 0.15, outputUsdPerMillionTokens: 0.6 },
  { condition: 'peak, cache miss', inputUsdPerMillionTokens: 0.3, outputUsdPerMillionTokens: 1.2 },
] as const

export const deepSeekStructuredModelConfiguration = {
  ...createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'structured' }),
  pricing: deepSeekFlashPricing,
} as const satisfies ModelConfiguration

export const deepSeekWritingModelConfiguration = {
  ...createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'writing' }),
  pricing: deepSeekFlashPricing,
} as const satisfies ModelConfiguration

/** Every configuration `pnpm test:evaluation:record <candidate>` records, with the same provider's other role. */
export const modelConfigurationCandidates = {
  'deepseek-structured': { configuration: deepSeekStructuredModelConfiguration, companion: deepSeekWritingModelConfiguration },
  'deepseek-writing': { configuration: deepSeekWritingModelConfiguration, companion: deepSeekStructuredModelConfiguration },
  'openai-structured': { configuration: structuredModelConfiguration, companion: writingModelConfiguration },
  'openai-writing': { configuration: writingModelConfiguration, companion: structuredModelConfiguration },
} as const satisfies Readonly<Record<string, QualificationCandidate>>
