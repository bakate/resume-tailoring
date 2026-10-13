import { describe, expect, it } from 'vitest'

import {
  createDeepSeekModelConfiguration,
  createOpenAiModelConfiguration,
  deepSeekMeasuredReasoningTokens,
  modelRoleOperations,
} from './language-model-configuration'
import type { ModelRole, RoleModelConfigurations } from './language-model-configuration'

const qualifiedStructured = createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' })
const modelRoles = ['structured', 'writing'] as const satisfies readonly ModelRole[]

describe('Qualified Model Configuration', () => {
  it('freezes stateless requests and strict Structured Outputs for OpenAI', () => {
    const configuration = createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' })

    expect(configuration).toMatchObject({ provider: 'openai', model: 'gpt-6-luna', role: 'structured',
      providerOptions: { reasoningEffort: 'low', store: false, strictJsonSchema: true } })
  })

  it.each(modelRoles)('settles a budget and a deadline for every %s operation, and only for them', (role) => {
    const configurations = [createOpenAiModelConfiguration({ model: 'model', reasoningEffort: 'low', role }),
      createDeepSeekModelConfiguration({ model: 'deepseek-flash', role })]

    for (const configuration of configurations) {
      expect(Object.keys(configuration.operations).sort()).toEqual([...modelRoleOperations[role]].sort())
    }
  })

  it('keeps a fallback on the provider of the active configuration', () => {
    const structured: RoleModelConfigurations<'deepseek'> = {
      active: createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'structured' }),
      // @ts-expect-error A fallback never names another provider than the active one: it would be an unconsented processor.
      fallback: qualifiedStructured,
    }

    expect(structured.active.provider).toBe('deepseek')
  })
})

describe('DeepSeek operation settings', () => {
  const deepSeek = { ...createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'structured' }).operations,
    ...createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'writing' }).operations }
  const openAi = { ...createOpenAiModelConfiguration({ model: 'model', reasoningEffort: 'low', role: 'structured' }).operations,
    ...createOpenAiModelConfiguration({ model: 'model', reasoningEffort: 'low', role: 'writing' }).operations }

  it('thinks low to extract a Job Posting and to match, not to extract a Source Profile, and high to write', () => {
    const thinking = Object.fromEntries(Object.entries(deepSeek).map(([operation, settings]) => [operation, settings.thinking]))

    // BAK-167: without thinking, Job Posting extraction recall fell to about 60% against 94% at low.
    expect(thinking).toMatchObject({ 'explainable-job-posting-extraction': 'low', 'explainable-match-evidence': 'low',
      'structured-source-profile-extraction': 'disabled', 'resume-section-writing': 'high' })
  })

  it.each(Object.keys(deepSeek))('leaves %s the answer budget plus the reasoning the spike measured', (operation) => {
    const settings = deepSeek[operation as keyof typeof deepSeek]
    const answerBudget = openAi[operation as keyof typeof openAi]?.maxOutputTokens ?? Infinity

    const measuredReasoning = (deepSeekMeasuredReasoningTokens as Partial<Record<string, number>>)[settings?.thinking ?? 'max']

    expect(measuredReasoning).toBeDefined()
    expect(settings?.maxOutputTokens).toBeGreaterThanOrEqual(answerBudget + (measuredReasoning ?? Infinity))
  })

  it('gives match evidence the 32,000 tokens without which 7 of 20 spike answers were cut, and a deadline past its 82 s p95', () => {
    const matching = deepSeek['explainable-match-evidence']

    expect(matching).toMatchObject({ maxOutputTokens: 32_000, deadlineMilliseconds: 110_000 })
  })
})
