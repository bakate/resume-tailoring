import { describe, expect, it } from 'vitest'

import { createOpenAiStructuredSourceProfileExtractor } from './openai-structured-source-profile-extractor'
import { delimitUntrustedContent } from './untrusted-model-input'

describe('OpenAI structured Source Profile extractor contract', () => {
  it('uses a stateless Structured Output request for minimized professional content', async () => {
    const requests: Request[] = []
    const extractor = createOpenAiStructuredSourceProfileExtractor({
      apiKey: { source: 'operator', value: 'test-api-key' },
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
        { role: 'user', content: [{ type: 'input_text',
          text: delimitUntrustedContent({ kind: 'source-document', content: 'TypeScript' }) }] },
      ],
      text: { format: { name: 'structured_source_profile', strict: true } },
    })
  })

  it('asks for the dates of every education entry, so a degree keeps the year the source gives', async () => {
    const requests: Request[] = []
    const profile = { ...structuredSourceProfile, education: [{ institution: 'Université de Lille',
      qualification: 'Licence professionnelle Développement Web', dates: '2018' }] }
    const extractor = createOpenAiStructuredSourceProfileExtractor({
      apiKey: { source: 'operator', value: 'test-api-key' },
      model: 'structured-model',
      reasoningEffort: 'low',
      request: (input, init) => {
        requests.push(new Request(input, init))
        return Promise.resolve(Response.json(createOpenAiResponse({ profile })))
      },
    })

    const result = await extractor.extract({ professionalContent: 'Licence professionnelle – Université de Lille – 2018' })

    const education = (await requests[0]?.json() as EducationSchemaRequest).text.format.schema.properties.education.items
    expect(result.ok).toBe(true)
    expect(education.properties.dates).toEqual({ anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] })
    expect(education.required).toContain('dates')
  })

  it('rejects malformed structured evidence', async () => {
    const extractor = createOpenAiStructuredSourceProfileExtractor({
      apiKey: { source: 'operator', value: 'test-api-key' },
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        profile: { ...structuredSourceProfile, skills: [{ name: '' }] },
      }))),
    })

    const result = await extractor.extract({ professionalContent: 'TypeScript' })

    expect(result).toEqual({ ok: false, error: 'source-profile-extraction-unavailable' })
  })
})

type EducationSchemaRequest = Readonly<{ text: { format: { schema: { properties: { education: { items: {
  properties: Readonly<Record<string, unknown>>; required: readonly string[] } } } } } } }>

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
