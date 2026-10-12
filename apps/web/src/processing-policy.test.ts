import { afterEach, describe, expect, it, vi } from 'vitest'

import { validateServerEnvironment } from './env'
import { languageModelProviders } from './language-model-configuration'
import { createProcessingPolicy, readActiveProcessingPolicy } from './processing-policy'

/** The policy Candidates consented to on 2026-09-29: any difference would ask every one of them for consent again. */
const consentedOpenAiProcessingPolicy = {
  provider: 'OpenAI',
  purposes: [
    'Extract and structure professional evidence',
    'Compare Candidate evidence with Job Posting requirements',
    'Write and validate supported Tailored Resume content',
  ],
  retentionPolicy: 'API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.',
  storageBehavior: 'Candidate content remains browser-local; model requests are stateless with application storage disabled.',
  transmittedDataCategories: [
    'Minimized professional content',
    'Job Posting content',
    'Candidate Facts needed for matching, writing, and validation',
  ],
  version: '2026-09-29',
} as const

describe('Processing Policy derived from the active Language Model Provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the OpenAI Processing Policy Candidates already consented to', () => {
    const policy = createProcessingPolicy({ provider: 'openai' })

    expect(policy).toEqual(consentedOpenAiProcessingPolicy)
  })

  it('gives every provider its own policy version, so a provider change always asks for new consent', () => {
    const versions = languageModelProviders.flatMap((provider) => createProcessingPolicy({ provider })?.version ?? [])

    expect(new Set(versions).size).toBe(versions.length)
  })

  it('states no DeepSeek policy until its processing country is disclosed (BAK-168)', () => {
    const policy = createProcessingPolicy({ provider: 'deepseek' })

    expect(policy).toBeNull()
  })

  it('states on the landing the policy of the provider the server calls', () => {
    const environment = { LANGUAGE_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'secret-key' }
    const serverEnvironment = validateServerEnvironment({ environment })
    if (!serverEnvironment.ok) throw new Error('The test environment is valid')

    const policy = readActiveProcessingPolicy({ environment })

    expect(policy).toEqual(createProcessingPolicy({ provider: serverEnvironment.value.languageModel.provider }))
  })

  it('states the policy without the provider key, so the landing renders it wherever the key lives', () => {
    const policy = readActiveProcessingPolicy({ environment: {} })

    expect(policy).toEqual(createProcessingPolicy({ provider: 'openai' }))
  })

  it.each([
    { LANGUAGE_MODEL_PROVIDER: 'another-provider' },
    { OPENAI_STRUCTURED_MODEL: 'unqualified-model' },
  ])('states no policy for a selection the server refuses: %o', (environment) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(readActiveProcessingPolicy({ environment })).toBeNull()
  })

  it('reports which setting it refused without its value', () => {
    const writeLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    readActiveProcessingPolicy({ environment: { OPENAI_WRITING_MODEL: 'private-unqualified-model' } })

    const serializedLog = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedLog).toContain('OPENAI_WRITING_MODEL')
    expect(serializedLog).not.toContain('private-unqualified-model')
  })
})
