import { describe, expect, it } from 'vitest'

import { validateServerEnvironment } from './env'

describe('server environment validation', () => {
  it('accepts the prequalified OpenAI configurations', () => {
    const result = validateServerEnvironment({
      environment: {
        OPENAI_API_KEY: 'secret-key',
        OPENAI_STRUCTURED_MODEL: 'gpt-6-luna',
        OPENAI_STRUCTURED_REASONING_EFFORT: 'low',
        OPENAI_WRITING_MODEL: 'gpt-6-sol',
        OPENAI_WRITING_REASONING_EFFORT: 'medium',
      },
    })

    expect(result).toEqual({
      ok: true,
      value: {
        openAiApiKey: 'secret-key',
        openAiStructuredModel: 'gpt-6-luna',
        openAiStructuredReasoningEffort: 'low',
        openAiWritingModel: 'gpt-6-sol',
        openAiWritingReasoningEffort: 'medium',
      },
    })
  })

  it('uses the evaluated structured defaults', () => {
    const result = validateServerEnvironment({
      environment: {
        OPENAI_API_KEY: 'secret-key',
      },
    })

    expect(result).toEqual({
      ok: true,
      value: {
        openAiApiKey: 'secret-key',
        openAiStructuredModel: 'gpt-6-luna',
        openAiStructuredReasoningEffort: 'low',
        openAiWritingModel: 'gpt-6-sol',
        openAiWritingReasoningEffort: 'medium',
      },
    })
  })

  it('accepts fallbacks qualified on the reference dataset', () => {
    const result = validateServerEnvironment({
      environment: {
        OPENAI_API_KEY: 'secret-key',
        OPENAI_STRUCTURED_FALLBACK_MODEL: 'gpt-6-luna',
        OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT: 'low',
        OPENAI_WRITING_FALLBACK_MODEL: 'gpt-6-sol',
        OPENAI_WRITING_FALLBACK_REASONING_EFFORT: 'medium',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        openAiStructuredFallback: { model: 'gpt-6-luna', reasoningEffort: 'low' },
        openAiWritingFallback: { model: 'gpt-6-sol', reasoningEffort: 'medium' },
      },
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
      environment: { OPENAI_API_KEY: 'secret-key', ...fallbackEnvironment },
    })

    expect(result.ok).toBe(false)
  })

  it.each([
    {},
    { OPENAI_API_KEY: '' },
    { OPENAI_API_KEY: '   ' },
    { OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_MODEL: '' },
    { OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_MODEL: 'gpt-6-sol' },
    { OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_REASONING_EFFORT: 'extreme' },
    { OPENAI_API_KEY: 'secret-key', OPENAI_WRITING_MODEL: 'unqualified-model' },
    { OPENAI_API_KEY: 'secret-key', OPENAI_WRITING_REASONING_EFFORT: 'high' },
  ])('rejects invalid OpenAI configuration: %o', (environment) => {
    const result = validateServerEnvironment({ environment })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.type).toBe('invalid-server-environment')
    expect(result.error.issues.length).toBeGreaterThan(0)
  })
})
