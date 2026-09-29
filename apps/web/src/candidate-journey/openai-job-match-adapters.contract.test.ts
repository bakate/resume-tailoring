import { describe, expect, it } from 'vitest'

import {
  createOpenAiJobMatchEvidenceMatcher,
  requestOpenAiJobMatchEvidence,
} from './openai-job-match-evidence-matcher'
import { createOpenAiJobPostingExtractor } from './openai-job-posting-extractor'

describe('OpenAI explainable Job Match adapters', () => {
  it('extracts source-backed requirements through a stateless Structured Output request', async () => {
    const requests: Request[] = []
    const extractor = createOpenAiJobPostingExtractor({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: extractedJobPosting, requests }),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual({ ok: true, value: expectedExtractedJobPosting })
    expect(await requests[0]?.json()).toMatchObject({
      model: 'structured-model', store: false,
      text: { format: { name: 'explainable_job_posting', strict: true } },
    })
  })

  it('proposes evidence without accepting unknown references', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: evidenceProposal, requests: [] }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
  })

  it('accepts the aggregated Responses API output_text field', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: evidenceProposal, requests: [], response: 'output-text' }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
  })

  it('rejects evidence that references an unknown Candidate Fact', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({
        output: { ...evidenceProposal, relevance: [{
          factMatch: { ...evidenceProposal.relevance[0].factMatch, factId: 'source-fact-invented' },
          requirementId: 'job-requirement-1',
        }] },
        requests: [],
      }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: { evidence: [], relevance: [] } })
  })

  it('rejects relevance that does not prove equivalent evidence terms', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({
        output: {
          ...evidenceProposal,
          relevance: [{
            factMatch: {
              ...evidenceProposal.relevance[0].factMatch,
              factTerm: 'UI library',
              relationship: 'controlled',
              requirementTerm: 'deployment process',
            },
            requirementId: 'job-requirement-1',
          }],
        },
        requests: [],
      }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: { evidence: [], relevance: [] } })
  })

  it('retries an invalid relevance response with a correction instruction', async () => {
    const requests: Request[] = []
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createSequentialRecordedRequest({
        outputs: [{
          ...evidenceProposal,
          relevance: [{
            factMatch: {
              ...evidenceProposal.relevance[0].factMatch,
              factTerm: 'UI library',
              relationship: 'controlled',
              requirementTerm: 'deployment process',
            },
            requirementId: 'job-requirement-1',
          }],
        }, evidenceProposal],
        requests,
      }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
    expect(requests).toHaveLength(2)
    const secondRequestBody = await requests[1]?.text()
    expect(secondRequestBody).toContain('failed deterministic validation')
  })

  it('returns a typed failure before sending an oversized matching request', async () => {
    const result = await requestOpenAiJobMatchEvidence({
      apiKey: 'test-api-key',
      matchRequest: {
        candidateFacts: Array.from({ length: 70 }, (factIndex) => ({
          id: `source-fact-${String(factIndex)}`,
          kind: 'experience' as const,
          value: 'A'.repeat(1_000),
        })),
        requirements: matchRequest.requirements,
      },
      model: 'structured-model',
      reasoningEffort: 'low',
      request: () => Promise.reject(new Error('Request should not be sent')),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.type).toBe('request-too-large')
  })
})

function createRecordedRequest({ output, requests, response = 'output-items' }: Readonly<{
  output: unknown
  requests: Request[]
  response?: 'output-items' | 'output-text'
}>) {
  return (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init))
    return Promise.resolve(Response.json({
      id: 'response-1',
      ...(response === 'output-text'
        ? { output_text: JSON.stringify(output) }
        : { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }),
    }))
  }
}

function createSequentialRecordedRequest({ outputs, requests }: Readonly<{
  outputs: readonly unknown[]
  requests: Request[]
}>) {
  let responseIndex = 0
  return (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init))
    const output = outputs[responseIndex] ?? outputs.at(-1)
    responseIndex += 1
    return Promise.resolve(Response.json({
      id: `response-${String(responseIndex)}`,
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
    }))
  }
}

const jobPostingContent = 'We are hiring a Staff Engineer. TypeScript is required.'
const extractedJobPosting = {
  practicalConstraints: [],
  requirements: [{
    capability: { dimension: 'technical-expertise', name: 'TypeScript' },
    importance: 'critical',
    importanceRationale: 'The posting says required.',
    sourceExcerpt: 'TypeScript is required.',
    substitutableGroup: null,
    value: 'TypeScript',
  }],
  targetRole: {
    sourceExcerpt: 'We are hiring a Staff Engineer.',
    value: 'Staff Engineer',
  },
} as const

const expectedExtractedJobPosting = {
  ...extractedJobPosting,
  requirements: [{
    ...extractedJobPosting.requirements[0],
    id: 'job-requirement-1' as const,
    substitutableGroup: undefined,
  }],
}

const matchRequest = {
  candidateFacts: [{ id: 'source-fact-1', kind: 'skill', value: 'TypeScript' }],
  requirements: expectedExtractedJobPosting.requirements,
} as const

const evidenceProposal = {
  evidence: [{
    coverage: 'covered',
    factMatches: [{
      factId: 'source-fact-1',
      factTerm: 'TypeScript',
      relationship: 'exact',
      requirementTerm: 'TypeScript',
    }],
    requirementId: 'job-requirement-1',
  }],
  relevance: [{
    factMatch: {
      factId: 'source-fact-1',
      factTerm: 'TypeScript',
      relationship: 'exact',
      requirementTerm: 'TypeScript',
    },
    requirementId: 'job-requirement-1',
  }],
} as const
