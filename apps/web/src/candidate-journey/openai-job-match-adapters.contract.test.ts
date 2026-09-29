import { describe, expect, it } from 'vitest'

import { createOpenAiJobMatchEvidenceMatcher } from './openai-job-match-evidence-matcher'
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

    expect(result).toEqual({ ok: false, error: 'match-evidence-unavailable' })
  })
})

function createRecordedRequest({ output, requests }: Readonly<{
  output: unknown
  requests: Request[]
}>) {
  return (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init))
    return Promise.resolve(Response.json({
      id: 'response-1',
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
