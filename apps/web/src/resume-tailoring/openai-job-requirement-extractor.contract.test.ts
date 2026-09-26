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
    ['a fabricated source excerpt', 'Know TypeScript', 'TypeScript is mandatory.'],
  ])('rejects %s returned by the model', async (_caseName, value, sourceExcerpt) => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        requirements: [{
          classification: 'required',
          groupKey: 'requirement-group-engineering-stack',
          sourceExcerpt,
          value,
        }],
      }))),
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
    groupKey: string
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
      groupKey: 'requirement-group-engineering-stack',
      sourceExcerpt: jobPostingContent,
      value: 'Know TypeScript',
    },
    {
      classification: 'preferred',
      groupKey: 'requirement-group-engineering-stack',
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
  text: { format: { type: 'json_schema', name: 'job_requirements', strict: true } },
} as const

const extractionUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-extraction-unavailable' },
} as const
