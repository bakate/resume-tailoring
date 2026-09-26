import { describe, expect, it } from 'vitest'

import { createOpenAiJobRequirementExtractor } from './openai-job-requirement-extractor'

const jobPostingContent = 'You must know TypeScript and preferably React.'

describe('OpenAI Job Requirement extractor contract', () => {
  it('uses a stateless strict request containing only the reviewed Job Posting', async () => {
    const { extractor, requests, signals } = createContractTestExtractor()

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(expectedExtractionResult)
    expect(await readRequestBody(requests)).toMatchObject(expectedRequestBody)
    expect(signals).toEqual([expect.any(AbortSignal)])
  })

  it.each([
    ['a compound requirement', 'Know TypeScript and React', jobPostingContent],
    ['a comma-separated requirement list', 'Know TypeScript, React', jobPostingContent],
    ['a slash-separated requirement list', 'Know TypeScript/React', jobPostingContent],
    ['a fabricated source excerpt', 'Know TypeScript', 'TypeScript is mandatory.'],
  ])('rejects %s returned by the model', async (_caseName, value, sourceExcerpt) => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        requirements: [{
          classification: 'required',
          sourceExcerpt,
          value,
        }],
      }))),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(extractionUnavailableResult)
  })

  it('rejects more than 200 requirements returned by the model', async () => {
    const requirements = Array.from({ length: 201 }, (_unusedValue, requirementIndex) => ({
      classification: 'required',
      sourceExcerpt: jobPostingContent,
      value: `Know technology ${String(requirementIndex)}`,
    }))
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({ requirements }))),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(extractionUnavailableResult)
  })

  it('maps an aborted upstream request to an unavailable extraction', async () => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(extractionUnavailableResult)
  })
})

function createContractTestExtractor() {
  const requests: Request[] = []
  const signals: (AbortSignal | null)[] = []
  const extractor = createOpenAiJobRequirementExtractor({
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

function createOpenAiResponse({
  requirements = expectedExtractionResult.value,
}: Readonly<{
  requirements?: readonly Readonly<{
    classification: string
    sourceExcerpt: string
    value: string
  }>[]
}> = {}) {
  return {
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        text: JSON.stringify({ requirements }),
      }],
    }],
  }
}

const expectedExtractionResult = {
  ok: true,
  value: [
    {
      classification: 'required',
      sourceExcerpt: jobPostingContent,
      value: 'Know TypeScript',
    },
    {
      classification: 'preferred',
      sourceExcerpt: jobPostingContent,
      value: 'Know React',
    },
  ],
} as const

const expectedRequestBody = {
  model: 'structured-model',
  store: false,
  input: [
    { role: 'developer' },
    { role: 'user', content: [{ type: 'input_text', text: jobPostingContent }] },
  ],
  text: {
    format: {
      type: 'json_schema',
      name: 'job_requirements',
      strict: true,
      schema: { properties: { requirements: { maxItems: 200 } } },
    },
  },
} as const

const extractionUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-extraction-unavailable' },
} as const
