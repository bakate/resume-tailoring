import { describe, expect, it, vi } from 'vitest'

import {
  createOpenAiJobMatchEvidenceMatcher,
  requestOpenAiJobMatchEvidence,
} from './openai-job-match-evidence-matcher'
import { createOpenAiJobPostingExtractor } from './openai-job-posting-extractor'

describe('OpenAI explainable Job Match adapters', () => {
  it('extracts source-backed requirements through a stateless Structured Output request', async () => {
    const requests: Request[] = []
    const extractor = createOpenAiJobPostingExtractor({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: extractedJobPosting, requests }),
    })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual({ ok: true, value: expectedExtractedJobPosting })
    expect(await requests[0]?.json()).toMatchObject({
      model: 'structured-model', store: false,
      text: { format: { name: 'explainable_job_posting', strict: true } },
    })
  })

  it('reads the proposal from Responses API output items', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: evidenceProposal, requests: [] }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
  })

  it('accepts the aggregated Responses API output_text field', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: evidenceProposal, requests: [], response: 'output-text' }),
    })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
  })

  it('requests evidence excerpts per side without an exact-versus-controlled relationship', async () => {
    const requests: Request[] = []
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: evidenceProposal, requests }),
    })

    await matcher.match(matchRequest)

    const body = await requests[0]?.json() as { text: { format: { name: string; schema: unknown; strict: boolean } } }
    expect(body.text.format).toMatchObject({ name: 'explainable_match_evidence', strict: true })
    expect(JSON.stringify(body.text.format.schema)).toContain('"factExcerpt"')
    expect(JSON.stringify(body.text.format.schema)).toContain('"requirementExcerpt"')
    expect(JSON.stringify(body.text.format.schema)).not.toContain('relationship')
  })

  it('requests Adjacent Evidence with one verbatim excerpt per Candidate Fact', async () => {
    const requests: Request[] = []
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: adjacentStackProposal, requests }),
    })

    await matcher.match(adjacentStackMatchRequest)

    const body = await requests[0]?.json() as {
      input: { content: { text: string }[] }[]
      text: { format: { schema: { properties: Record<string, unknown> } } }
    }
    expect(body.text.format.schema.properties.adjacentEvidence).toMatchObject({
      items: { properties: { factMatches: { items: {
        properties: { factExcerpt: { type: 'string' }, factId: { type: 'string' } },
        required: ['factExcerpt', 'factId'],
      } }, requirementId: { type: 'string' } } },
    })
    expect(body.input[0]?.content[0]?.text).toContain('adjacentEvidence')
  })

  it('returns unverified proposals for the matching engine to judge', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: fabricatedProposal, requests: [] }),
    })

    const result = await matcher.match(adjacentStackMatchRequest)

    expect(result).toEqual({ ok: true, value: fabricatedProposal })
  })

  it('records how many links the model proposed without Candidate content', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: { source: 'operator', value: 'test-api-key' }, model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: fabricatedProposal, requests: [] }),
    })

    await matcher.match(adjacentStackMatchRequest)

    const lines = info.mock.calls.map(([line]) => String(line))
    info.mockRestore()
    expect(lines.map((line) => JSON.parse(line) as Record<string, unknown>)).toContainEqual({
      category: 'privacy-safe-openai-request', metric: 'accepted', value: 1,
      dimensions: { operation: 'explainable-match-evidence', proposedRelevance: 1, proposedEvidence: 0,
        proposedAdjacentEvidence: 2 },
    })
    expect(lines.join('\n')).not.toMatch(/React|TypeScript|Java|Angular/u)
  })

  it('returns a typed failure before sending an oversized matching request', async () => {
    const result = await requestOpenAiJobMatchEvidence({
      apiKey: { source: 'operator', value: 'test-api-key' },
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
  adjacentEvidence: [],
  evidence: [{
    coverage: 'covered',
    factMatches: [{ factExcerpt: 'TypeScript', factId: 'source-fact-1', requirementExcerpt: 'TypeScript' }],
    requirementId: 'job-requirement-1',
  }],
  relevance: [{
    factMatch: { factExcerpt: 'TypeScript', factId: 'source-fact-1', requirementExcerpt: 'TypeScript' },
    requirementId: 'job-requirement-1',
  }],
} as const

const adjacentStackMatchRequest = {
  candidateFacts: [
    { id: 'source-fact-react', kind: 'experience', value: 'Built customer dashboards with React and TypeScript' },
  ],
  requirements: [{
    capability: { dimension: 'technical-expertise', name: 'Java, JEE and Angular' },
    id: 'job-requirement-java-stack' as const,
    importance: 'critical',
    importanceRationale: 'The posting says required.',
    sourceExcerpt: 'Java, JEE and Angular are required.',
    value: 'Develop with Java, JEE and Angular',
  }],
} as const

const adjacentStackProposal = {
  adjacentEvidence: [{
    factMatches: [{ factExcerpt: 'React and TypeScript', factId: 'source-fact-react' }],
    requirementId: 'job-requirement-java-stack',
  }],
  evidence: [],
  relevance: [],
} as const

const fabricatedProposal = {
  adjacentEvidence: [
    ...adjacentStackProposal.adjacentEvidence,
    { factMatches: [{ factExcerpt: 'Angular', factId: 'source-fact-invented' }], requirementId: 'job-requirement-java-stack' },
  ],
  evidence: [],
  relevance: [{
    factMatch: { factExcerpt: 'Angular', factId: 'source-fact-react', requirementExcerpt: 'Angular' },
    requirementId: 'job-requirement-java-stack',
  }],
} as const
