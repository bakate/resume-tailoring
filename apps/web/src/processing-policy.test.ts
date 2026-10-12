import { describe, expect, it } from 'vitest'

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
  it('keeps the OpenAI Processing Policy Candidates already consented to', () => {
    expect(createProcessingPolicy({ provider: 'openai' })).toEqual(consentedOpenAiProcessingPolicy)
  })

  it('gives every provider its own policy version, so a provider change always asks for new consent', () => {
    const versions = languageModelProviders.map((provider) => createProcessingPolicy({ provider }).version)

    expect(new Set(versions).size).toBe(languageModelProviders.length)
  })

  it('states on the landing the policy of the provider the server calls', () => {
    const environment = { LANGUAGE_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'secret-key' }
    const serverEnvironment = validateServerEnvironment({ environment })
    if (!serverEnvironment.ok) throw new Error('The test environment is valid')

    expect(readActiveProcessingPolicy({ environment }))
      .toEqual(createProcessingPolicy({ provider: serverEnvironment.value.languageModel.provider }))
  })

  it('states no policy for a provider the server refuses', () => {
    expect(() => readActiveProcessingPolicy({ environment: { LANGUAGE_MODEL_PROVIDER: 'another-provider' } }))
      .toThrow('invalid-server-environment')
  })
})
