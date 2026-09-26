import { describe, expect, it } from 'vitest'

import { createOpenAiSourceProfileExtractor } from './openai-source-profile-extractor'

describe('OpenAI Source Profile extractor contract', () => {
  it('uses a stateless structured request containing only minimized professional content', async () => {
    const { extractor, requests, signals } = createContractTestExtractor()
    const result = await extractor.extract({
      professionalContent: 'Built a billing platform with TypeScript.',
    })

    expect(result).toEqual(expectedExtractionResult)
    const requestBody = await readRequestBody(requests)
    expect(requestBody).toMatchObject(expectedRequestBody)
    expect(JSON.stringify(requestBody)).not.toContain('?!')
    expect(signals).toEqual([expect.any(AbortSignal)])
  })

  it('rejects non-atomic structured facts returned by the model', async () => {
    const extractor = createOpenAiSourceProfileExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        value: 'TypeScript\nReact',
      }))),
    })

    const result = await extractor.extract({ professionalContent: 'TypeScript and React' })

    expect(result).toEqual({
      ok: false,
      error: { type: 'source-profile-extraction-unavailable' },
    })
  })

  it('maps an aborted upstream request to an unavailable extraction', async () => {
    const extractor = createOpenAiSourceProfileExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
    })

    const result = await extractor.extract({ professionalContent: 'TypeScript' })

    expect(result).toEqual({
      ok: false,
      error: { type: 'source-profile-extraction-unavailable' },
    })
  })
})

function createContractTestExtractor() {
  const requests: Request[] = []
  const signals: (AbortSignal | null)[] = []
  const extractor = createOpenAiSourceProfileExtractor({
    apiKey: 'test-api-key',
    model: 'structured-model',
    request: (input, init) => {
      requests.push(new Request(input, init))
      signals.push(init?.signal ?? null)
      return Promise.resolve(Response.json(createOpenAiResponse()))
    },
  })
  return { extractor, requests, signals }
}

async function readRequestBody(requests: readonly Request[]) {
  const [request] = requests
  expect(request).toBeDefined()
  return request?.json() as Promise<unknown> | undefined
}

function createOpenAiResponse({ value = 'TypeScript' }: Readonly<{ value?: string }> = {}) {
  return {
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        text: JSON.stringify({
          facts: [{
            kind: 'skill',
            propositionKey: 'proposition-skill-candidate-typescript',
            value,
          }],
        }),
      }],
    }],
  }
}

const expectedExtractionResult = {
  ok: true,
  value: [{
    kind: 'skill',
    propositionKey: 'proposition-skill-candidate-typescript',
    value: 'TypeScript',
  }],
} as const

const expectedRequestBody = {
  model: 'structured-model',
  store: false,
  input: [
    { role: 'developer' },
    { role: 'user', content: [{
      type: 'input_text', text: 'Built a billing platform with TypeScript.',
    }] },
  ],
  text: { format: { type: 'json_schema', name: 'source_profile_facts', strict: true } },
} as const
