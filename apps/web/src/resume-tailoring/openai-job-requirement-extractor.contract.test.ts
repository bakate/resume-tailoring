import { describe, expect, it } from 'vitest'

import { createOpenAiJobRequirementExtractor } from './openai-job-requirement-extractor'

const jobPostingContent = 'You must know TypeScript and preferably React.'

describe('OpenAI Job Requirement extractor contract', () => {
  it('uses a stateless strict request containing only the reviewed Job Posting', async () => {
    const { extractor, requests, signals } = createContractTestExtractor()

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(expectedExtractionResult)
    const requestBody = await readRequestBody(requests)
    expect(requestBody).toMatchObject(expectedRequestBody)
    expect(JSON.stringify(requestBody)).not.toContain('?!')
    expect(signals).toEqual([expect.any(AbortSignal)])
  })

  it('returns an unambiguous target role with exact source provenance', async () => {
    const targetRole = 'Senior FullStack Developer'
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        targetRole: { sourceExcerpt: targetRole, value: targetRole },
        requirements: [],
      }))),
    })

    const result = await extractor.extract({ jobPostingContent: `Role: ${targetRole}` })

    expect(result).toEqual({
      ok: true,
      value: {
        practicalConstraints: [],
        targetRole: { sourceExcerpt: targetRole, value: targetRole },
        requirements: [],
      },
    })
  })

  it('preserves a missing target role instead of inventing one', async () => {
    const { extractor } = createContractTestExtractor()

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toMatchObject({ ok: true, value: { targetRole: null } })
  })

  it('rejects a target role without exact source provenance', async () => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        targetRole: { sourceExcerpt: 'Invented role', value: 'Invented role' },
        requirements: [],
      }))),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(extractionUnavailableResult)
  })

  it('rejects an invented target role value despite a valid source excerpt', async () => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        targetRole: { sourceExcerpt: jobPostingContent, value: 'Chief Technology Officer' },
        requirements: [],
      }))),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(extractionUnavailableResult)
  })

  it.each([
    ['multiple lines in one requirement', 'Know TypeScript\nKnow React', jobPostingContent],
    ['semicolon-separated requirements', 'Know TypeScript; Know React', jobPostingContent],
    ['a fabricated source excerpt', 'Know TypeScript', 'TypeScript is mandatory.'],
  ])('rejects %s returned by the model', async (_caseName, value, sourceExcerpt) => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        targetRole: null,
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

  it('accepts atomic requirements containing aliases and grammatical conjunctions', async () => {
    const sourceExcerpt = 'Build robust and reusable libraries with JavaScript / Vanilla JS.'
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        targetRole: null,
        requirements: [{
          classification: 'required',
          sourceExcerpt,
          value: 'Build robust and reusable libraries with JavaScript / Vanilla JS.',
        }],
      }))),
    })

    const result = await extractor.extract({ jobPostingContent: sourceExcerpt })

    expect(result).toEqual({
      ok: true,
      value: {
        practicalConstraints: [],
        targetRole: null,
        requirements: [{
          classification: 'required',
          sourceExcerpt,
          value: 'Build robust and reusable libraries with JavaScript / Vanilla JS.',
        }],
      },
    })
  })

  it('preserves an explicit Practical Constraint outside professional coverage', async () => {
    const sourceExcerpt = 'Hybrid work in Paris three days per week.'
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        practicalConstraints: [{ sourceExcerpt, value: sourceExcerpt }],
        targetRole: null,
        requirements: [],
      }))),
    })

    const result = await extractor.extract({ jobPostingContent: sourceExcerpt })

    expect(result).toMatchObject({
      ok: true,
      value: { practicalConstraints: [{ sourceExcerpt, value: sourceExcerpt }] },
    })
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
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        practicalConstraints: [], targetRole: null, requirements,
      }))),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual(extractionUnavailableResult)
  })

  it('maps an aborted upstream request to an unavailable extraction', async () => {
    const extractor = createOpenAiJobRequirementExtractor({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
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
    reasoningEffort: 'low',
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
  practicalConstraints = expectedExtractionResult.value.practicalConstraints,
  targetRole = expectedExtractionResult.value.targetRole,
  requirements = expectedExtractionResult.value.requirements,
}: Readonly<{
  practicalConstraints?: readonly Readonly<{ sourceExcerpt: string; value: string }>[]
  targetRole?: Readonly<{ sourceExcerpt: string; value: string }> | null
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
        text: JSON.stringify({ practicalConstraints, requirements, targetRole }),
      }],
    }],
  }
}

const expectedExtractionResult = {
  ok: true,
  value: {
    targetRole: null,
    practicalConstraints: [],
    requirements: [
      {
        classification: 'required',
        sourceExcerpt: jobPostingContent,
        value: 'TypeScript',
      },
      {
        classification: 'preferred',
        sourceExcerpt: jobPostingContent,
        value: 'React',
      },
    ],
  },
} as const

const expectedRequestBody = {
  model: 'structured-model',
  reasoning: { effort: 'low' },
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
      schema: {
        required: ['targetRole', 'practicalConstraints', 'requirements'],
        properties: {
          requirements: {
            maxItems: 200,
            items: {
              required: ['classification', 'sourceExcerpt', 'value'],
            },
          },
          practicalConstraints: {
            maxItems: 200,
            items: { required: ['sourceExcerpt', 'value'] },
          },
        },
      },
    },
  },
} as const

const extractionUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-extraction-unavailable' },
} as const
