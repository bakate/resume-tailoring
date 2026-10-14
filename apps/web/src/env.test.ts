import { describe, expect, it } from 'vitest'

import { createDeepSeekModelConfiguration, createOpenAiModelConfiguration, languageModelProviders } from './language-model-configuration'
import { readLanguageModelSelection, validateServerEnvironment } from './env'
import { serverEnvironmentFilePrefixes } from './server-environment-files'

const qualifiedStructured = createOpenAiModelConfiguration({ model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured' })
const qualifiedWriting = createOpenAiModelConfiguration({ model: 'gpt-6-sol', reasoningEffort: 'medium', role: 'writing' })
const openAi = { LANGUAGE_MODEL_PROVIDER: 'openai' }

describe('server environment validation', () => {
  it('accepts the prequalified OpenAI configurations', () => {
    const result = validateServerEnvironment({
      environment: {
        LANGUAGE_MODEL_PROVIDER: 'openai',
        OPENAI_API_KEY: 'secret-key',
        OPENAI_STRUCTURED_MODEL: 'gpt-6-luna',
        OPENAI_STRUCTURED_REASONING_EFFORT: 'low',
        OPENAI_WRITING_MODEL: 'gpt-6-sol',
        OPENAI_WRITING_REASONING_EFFORT: 'medium',
      },
    })

    expect(result).toEqual({
      ok: true,
      value: { languageModel: {
        apiKey: 'secret-key',
        provider: 'openai',
        structured: { active: qualifiedStructured },
        writing: { active: qualifiedWriting },
      } },
    })
  })

  it('uses DeepSeek, the provider production runs on, and its qualified configurations by default', () => {
    const result = validateServerEnvironment({
      environment: {
        DEEPSEEK_API_KEY: 'secret-key',
      },
    })

    expect(result).toEqual({
      ok: true,
      value: { languageModel: {
        apiKey: 'secret-key',
        provider: 'deepseek',
        structured: { active: createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'structured' }) },
        writing: { active: createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'writing' }) },
      } },
    })
  })

  it('accepts fallbacks qualified on the live evaluations', () => {
    const result = validateServerEnvironment({
      environment: {
        ...openAi,
        OPENAI_API_KEY: 'secret-key',
        OPENAI_STRUCTURED_FALLBACK_MODEL: 'gpt-6-luna',
        OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT: 'low',
        OPENAI_WRITING_FALLBACK_MODEL: 'gpt-6-sol',
        OPENAI_WRITING_FALLBACK_REASONING_EFFORT: 'medium',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      value: { languageModel: {
        structured: { fallback: qualifiedStructured },
        writing: { fallback: qualifiedWriting },
      } },
    })
  })

  it.each([
    {
      OPENAI_STRUCTURED_FALLBACK_MODEL: 'gpt-6-sol',
      OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT: 'medium',
    },
    {
      OPENAI_WRITING_FALLBACK_MODEL: 'gpt-6-luna',
      OPENAI_WRITING_FALLBACK_REASONING_EFFORT: 'low',
    },
    { OPENAI_STRUCTURED_FALLBACK_MODEL: 'gpt-6-luna' },
  ])('rejects a fallback without same-suite qualification: %o', (fallbackEnvironment) => {
    const result = validateServerEnvironment({
      environment: { ...openAi, OPENAI_API_KEY: 'secret-key', ...fallbackEnvironment },
    })

    expect(result.ok).toBe(false)
  })

  it.each([
    {},
    { ...openAi },
    { ...openAi, OPENAI_API_KEY: '' },
    { ...openAi, OPENAI_API_KEY: '   ' },
    { ...openAi, OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_MODEL: '' },
    { ...openAi, OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_MODEL: 'gpt-6-sol' },
    { ...openAi, OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_REASONING_EFFORT: 'extreme' },
    { ...openAi, OPENAI_API_KEY: 'secret-key', OPENAI_WRITING_MODEL: 'unqualified-model' },
    { ...openAi, OPENAI_API_KEY: 'secret-key', OPENAI_WRITING_REASONING_EFFORT: 'high' },
    { OPENAI_API_KEY: 'secret-key', LANGUAGE_MODEL_PROVIDER: 'another-provider' },
    { OPENAI_API_KEY: 'secret-key', LANGUAGE_MODEL_PROVIDER: '' },
  ])('refuses a provider, model or effort without a Qualified Model Configuration: %o', (environment) => {
    const result = validateServerEnvironment({ environment })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.type).toBe('invalid-server-environment')
    expect(result.error.issues.length).toBeGreaterThan(0)
  })

  it('never names the key in a validation issue', () => {
    const result = validateServerEnvironment({
      environment: { ...openAi, OPENAI_API_KEY: 'sk-private-operator-key', OPENAI_WRITING_MODEL: 'sk-private-operator-key' },
    })

    expect(JSON.stringify(result)).not.toContain('sk-private-operator-key')
  })
})

describe('server environment validation with DeepSeek', () => {
  const deepSeekEnvironment = { LANGUAGE_MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'secret-key' }

  it('starts on DeepSeek once deepseek-flash is qualified for both roles (BAK-167, BAK-168)', () => {
    const result = validateServerEnvironment({ environment: deepSeekEnvironment })

    expect(result).toMatchObject({ ok: true, value: { languageModel: { apiKey: 'secret-key', provider: 'deepseek' } } })
  })

  it('refuses a DeepSeek structured model with no passing qualification run', () => {
    const result = validateServerEnvironment({ environment: { ...deepSeekEnvironment, DEEPSEEK_STRUCTURED_MODEL: 'deepseek-v4-pro' } })

    expect(result.ok ? [] : result.error.issues).toContain('DEEPSEEK_STRUCTURED_MODEL: Model configuration has no passing qualification run')
  })

  it('requires the DeepSeek key, and only it, when DeepSeek is active', () => {
    const result = validateServerEnvironment({ environment: { LANGUAGE_MODEL_PROVIDER: 'deepseek', OPENAI_API_KEY: 'secret-key' } })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.error.issues).toContain('DEEPSEEK_API_KEY: Invalid input: expected string, received undefined')
    expect(JSON.stringify(result)).not.toContain('OPENAI_API_KEY')
  })

  it('never requires the DeepSeek key when OpenAI is active', () => {
    const result = validateServerEnvironment({ environment: { LANGUAGE_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'secret-key' } })

    expect(result.ok).toBe(true)
  })

  it('never reads the OpenAI model settings for DeepSeek', () => {
    const result = readLanguageModelSelection({ environment: { ...deepSeekEnvironment, OPENAI_WRITING_MODEL: 'unqualified-model' } })

    expect(JSON.stringify(result)).not.toContain('OPENAI_WRITING_MODEL')
  })
})

describe('Language Model selection', () => {
  it('validates the provider and its model settings without the provider key, so the landing never needs it', () => {
    const selection = readLanguageModelSelection({ environment: openAi })

    expect(selection).toEqual({ ok: true, value: {
      provider: 'openai', structured: { active: qualifiedStructured }, writing: { active: qualifiedWriting },
    } })
  })

  it.each([
    { LANGUAGE_MODEL_PROVIDER: 'another-provider' },
    { ...openAi, OPENAI_STRUCTURED_MODEL: 'unqualified-model' },
    { ...openAi, OPENAI_WRITING_REASONING_EFFORT: 'high' },
    { DEEPSEEK_WRITING_MODEL: 'unqualified-model' },
  ])('refuses a selection without a Qualified Model Configuration: %o', (environment) => {
    const selection = readLanguageModelSelection({ environment })

    expect(selection.ok).toBe(false)
  })
})

describe('server settings in local .env files', () => {
  it.each(languageModelProviders)('are all loaded by the development server for %s', (provider) => {
    const readSettings = new Set<string>()
    const environment = new Proxy<Record<string, unknown>>({ LANGUAGE_MODEL_PROVIDER: provider }, {
      get: (target, name) => {
        if (typeof name === 'string') readSettings.add(name)
        return target[name as string]
      },
    })

    validateServerEnvironment({ environment })

    expect(readSettings.size).toBeGreaterThan(1)
    for (const setting of readSettings) {
      expect(serverEnvironmentFilePrefixes.some((prefix) => setting.startsWith(prefix)), setting).toBe(true)
    }
  })
})
