import { describe, expect, it } from 'vitest'

import { createOpenAiStructuredSourceProfileExtractor } from './openai-structured-source-profile-extractor'

describe('OpenAI structured Source Profile extractor contract', () => {
  it('uses a stateless Structured Output request for minimized professional content', async () => {
    const requests: Request[] = []
    const extractor = createOpenAiStructuredSourceProfileExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: (input, init) => {
        requests.push(new Request(input, init))
        return Promise.resolve(Response.json(createOpenAiResponse()))
      },
    })

    const result = await extractor.extract({ professionalContent: 'TypeScript' })

    expect(result).toEqual({ ok: true, value: structuredSourceProfile })
    expect(await requests[0]?.json()).toMatchObject({
      model: 'structured-model',
      reasoning: { effort: 'low' },
      store: false,
      input: [
        { role: 'developer' },
        { role: 'user', content: [{ type: 'input_text', text: 'TypeScript' }] },
      ],
      text: { format: { name: 'structured_source_profile', strict: true } },
    })
  })

  it('rejects malformed structured evidence', async () => {
    const extractor = createOpenAiStructuredSourceProfileExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        profile: { ...structuredSourceProfile, skills: [{ name: '' }] },
      }))),
    })

    const result = await extractor.extract({ professionalContent: 'TypeScript' })

    expect(result).toEqual({ ok: false, error: 'source-profile-extraction-unavailable' })
  })

  it('preserves explicit partial entries without requiring invented evidence', async () => {
    const partialProfile = {
      ...structuredSourceProfile,
      education: [{ institution: null, qualification: 'MSc Computer Science' }],
      experiences: [{
        achievements: [], context: null, endDate: null, organization: null,
        role: 'Developer', startDate: null,
      }],
      projects: [{ description: null, name: 'Billing platform' }],
    }
    const extractor = createOpenAiStructuredSourceProfileExtractor({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        profile: partialProfile,
      }))),
    })

    const result = await extractor.extract({ professionalContent: 'Developer, MSc, Billing' })

    expect(result).toEqual({ ok: true, value: partialProfile })
  })
})

function createOpenAiResponse({
  profile = structuredSourceProfile,
}: Readonly<{ profile?: unknown }> = {}) {
  return {
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(profile) }],
    }],
  }
}

const structuredSourceProfile = {
  certifications: [],
  criticalAmbiguities: [],
  education: [],
  experiences: [],
  languages: [],
  projects: [],
  skills: [{ category: 'Programming language', name: 'TypeScript' }],
} as const
