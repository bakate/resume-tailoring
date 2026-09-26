import { describe, expect, it } from 'vitest'

import { validateServerEnvironment } from './env'

describe('server environment validation', () => {
  it('accepts a configured OpenAI key and model', () => {
    const result = validateServerEnvironment({
      environment: {
        OPENAI_API_KEY: 'secret-key',
        OPENAI_STRUCTURED_MODEL: 'gpt-6-sol',
      },
    })

    expect(result).toEqual({
      ok: true,
      value: {
        openAiApiKey: 'secret-key',
        openAiStructuredModel: 'gpt-6-sol',
      },
    })
  })

  it('uses the default structured model', () => {
    const result = validateServerEnvironment({
      environment: { OPENAI_API_KEY: 'secret-key' },
    })

    expect(result).toEqual({
      ok: true,
      value: {
        openAiApiKey: 'secret-key',
        openAiStructuredModel: 'gpt-6-luna',
      },
    })
  })

  it.each([
    {},
    { OPENAI_API_KEY: '' },
    { OPENAI_API_KEY: '   ' },
    { OPENAI_API_KEY: 'secret-key', OPENAI_STRUCTURED_MODEL: '' },
  ])('rejects invalid OpenAI configuration: %o', (environment) => {
    const result = validateServerEnvironment({ environment })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.type).toBe('invalid-server-environment')
    expect(result.error.issues.length).toBeGreaterThan(0)
  })
})
