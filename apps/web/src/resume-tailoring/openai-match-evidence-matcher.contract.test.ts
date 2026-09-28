import type { MatchInputs } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { describe, expect, it } from 'vitest'

import { createOpenAiMatchEvidenceMatcher } from './openai-match-evidence-matcher'

describe('OpenAI Match Evidence matcher contract', () => {
  it('uses a stateless strict request limited to Job Requirements and Verified Facts', async () => {
    const requests: Request[] = []
    const signals: (AbortSignal | null)[] = []
    const matcher = createOpenAiMatchEvidenceMatcher({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: (input, init) => {
        requests.push(new Request(input, init))
        signals.push(init?.signal ?? null)
        return Promise.resolve(Response.json(createOpenAiResponse()))
      },
    })

    const result = await matcher.match({ requirements, verifiedFacts })

    expect(result).toEqual({ ok: true, value: expectedAnalysis })
    const requestBody = await readRequestBody(requests)
    expect(requestBody).toMatchObject({
      model: 'structured-model',
      store: false,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'developer',
          content: [{ type: 'input_text' }],
        },
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: JSON.stringify({ requirements, verifiedFacts }),
          }],
        },
      ],
      text: { format: { type: 'json_schema', name: 'match_evidence', strict: true } },
    })
    expect(JSON.stringify(requestBody)).toMatch(/controlled synonyms and translations/iu)
    expect(JSON.stringify(requestBody)).toMatch(/shortest exact contiguous/iu)
    expect(JSON.stringify(requestBody)).toMatch(/do not calculate or combine employment date ranges/iu)
    expect(JSON.stringify(requestBody)).toMatch(
      /role, a transferable skill, or qualitative seniority as implicit proof/iu,
    )
    expect(signals).toEqual([expect.any(AbortSignal)])
  })

  it('rejects evidence that references input identifiers not supplied to the model', async () => {
    const matcher = createOpenAiMatchEvidenceMatcher({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({ analysis: {
        evidence: [{
          coverage: 'covered',
          requirementId: 'job-requirement-invented',
          factMatches: [{
            factId: 'source-fact-invented',
            factTerm: 'TypeScript',
            relationship: 'exact',
            requirementTerm: 'TypeScript',
          }],
        }],
        improvementOpportunities: [],
        relevantFactIds: ['source-fact-invented'],
      } }))),
    })

    const result = await matcher.match({ requirements, verifiedFacts })

    expect(result).toEqual(matchAnalysisUnavailableResult)
  })

  it('matches large Job Requirement sets in bounded requests and combines the evidence', async () => {
    const requests: Request[] = []
    const largeRequirements = createRequirements({ count: 26 })
    const matcher = createOpenAiMatchEvidenceMatcher({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: (input, init) => {
        requests.push(new Request(input, init))
        const offset = requests.length === 1 ? 0 : 25
        const batchRequirements = largeRequirements.slice(offset, offset + 25)
        return Promise.resolve(Response.json(createOpenAiResponse({
          analysis: createAnalysis({ requirements: batchRequirements }),
        })))
      },
    })

    const result = await matcher.match({ requirements: largeRequirements, verifiedFacts })

    expect(result).toEqual({
      ok: true,
      value: createAnalysis({ requirements: largeRequirements }),
    })
    expect(await readRequirementCounts(requests)).toEqual([25, 1])
  })
})

async function readRequestBody(requests: readonly Request[]) {
  const [request] = requests
  expect(request).toBeDefined()
  return request?.json() as Promise<unknown> | undefined
}

function createOpenAiResponse({
  analysis = expectedAnalysis,
}: Readonly<{ analysis?: unknown }> = {}) {
  return {
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(analysis) }],
    }],
  }
}

async function readRequirementCounts(requests: readonly Request[]) {
  return Promise.all(requests.map(async (request) => {
    const requestBody = await request.json() as OpenAiRequestBody
    const matchRequest = JSON.parse(requestBody.input[1].content[0].text) as MatchInputs
    return matchRequest.requirements.length
  }))
}

function createRequirements({ count }: Readonly<{ count: number }>) {
  return Array.from({ length: count }, (unusedValue, requirementIndex) => {
    void unusedValue
    return {
      id: `job-requirement-${String(requirementIndex)}` as const,
      classification: 'preferred' as const,
      value: `Use TypeScript for capability ${String(requirementIndex)}`,
    }
  })
}

function createAnalysis({ requirements: inputRequirements }: Readonly<{
  requirements: MatchInputs['requirements']
}>) {
  return {
    evidence: inputRequirements.map(({ id }) => ({
      coverage: 'covered' as const,
      requirementId: id,
      factMatches: [{
        factId: 'source-fact-typescript' as const,
        factTerm: 'TypeScript',
        relationship: 'exact' as const,
        requirementTerm: 'TypeScript',
      }],
    })),
    improvementOpportunities: [],
    relevantFactIds: ['source-fact-typescript' as const],
  }
}

type OpenAiRequestBody = Readonly<{
  input: readonly [unknown, Readonly<{
    content: readonly [Readonly<{ text: string }>]
  }>]
}>

const verifiedFacts = [{
  id: 'source-fact-typescript',
  kind: 'skill',
  value: 'TypeScript',
}] as const satisfies MatchInputs['verifiedFacts']

const requirements = [{
  id: 'job-requirement-typescript',
  classification: 'required',
  value: 'Know TS',
}] as const satisfies MatchInputs['requirements']

const expectedAnalysis = {
  evidence: [{
    coverage: 'covered',
    requirementId: 'job-requirement-typescript',
    factMatches: [{
      factId: 'source-fact-typescript',
      factTerm: 'TypeScript',
      relationship: 'controlled',
      requirementTerm: 'TS',
    }],
  }],
  improvementOpportunities: [],
  relevantFactIds: ['source-fact-typescript'],
} as const

const matchAnalysisUnavailableResult = {
  ok: false,
  error: { type: 'match-analysis-unavailable' },
} as const
