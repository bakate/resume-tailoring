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

  it('discards relevance that references an unknown Candidate Fact and keeps valid evidence', async () => {
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

    expect(result).toEqual({ ok: true, value: { ...evidenceProposal, relevance: [] } })
  })

  it('requests evidence excerpts per side without an exact-versus-controlled relationship', async () => {
    const requests: Request[] = []
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: evidenceProposal, requests }),
    })

    await matcher.match(matchRequest)

    const body = await requests[0]?.json() as { text: { format: { name: string; schema: unknown; strict: boolean } } }
    expect(body.text.format).toMatchObject({ name: 'explainable_match_evidence', strict: true })
    expect(JSON.stringify(body.text.format.schema)).toContain('"factExcerpt"')
    expect(JSON.stringify(body.text.format.schema)).toContain('"requirementExcerpt"')
    expect(JSON.stringify(body.text.format.schema)).not.toContain('relationship')
  })

  it('accepts a reformulated capability quoted verbatim from both sides', async () => {
    const reformulatedProposal = {
      adjacentEvidence: [],
      evidence: [{ coverage: 'covered', factMatches: [reformulatedFactMatch], requirementId: 'job-requirement-web' }],
      relevance: [{ factMatch: reformulatedFactMatch, requirementId: 'job-requirement-web' }],
    } as const
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({ output: reformulatedProposal, requests: [] }),
    })

    const result = await matcher.match(fullStackMatchRequest)

    expect(result).toEqual({ ok: true, value: reformulatedProposal })
  })

  it('discards only the proposals whose excerpts are not verbatim', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({
        output: {
          adjacentEvidence: [],
          evidence: [
            { coverage: 'covered', factMatches: [{ ...reformulatedFactMatch, factExcerpt: 'Angular applications' }],
              requirementId: 'job-requirement-web' },
            ...evidenceProposal.evidence,
          ],
          relevance: [
            { factMatch: { ...reformulatedFactMatch, requirementExcerpt: 'mobile applications' },
              requirementId: 'job-requirement-web' },
            ...evidenceProposal.relevance,
          ],
        },
        requests: [],
      }),
    })

    const result = await matcher.match(fullStackMatchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
  })

  it('records how many proposed links survive sanitization without Candidate content', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
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

    await matcher.match(matchRequest)

    const records = info.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
    info.mockRestore()
    expect(records).toContainEqual({
      category: 'privacy-safe-openai-request', metric: 'sanitized', value: 1,
      dimensions: { operation: 'explainable-match-evidence', proposedRelevance: 1, keptRelevance: 0,
        proposedEvidence: evidenceProposal.evidence.length, keptEvidence: evidenceProposal.evidence.length,
        proposedAdjacentEvidence: 0, keptAdjacentEvidence: 0 },
    })
  })

  it('requests Adjacent Evidence with one verbatim excerpt per Candidate Fact', async () => {
    const requests: Request[] = []
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
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

  it('keeps structurally valid Adjacent Evidence and discards a fabricated excerpt', async () => {
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({
        output: { ...adjacentStackProposal, adjacentEvidence: [
          { factMatches: [{ factExcerpt: 'Angular', factId: 'source-fact-react' }],
            requirementId: 'job-requirement-java-stack' },
          ...adjacentStackProposal.adjacentEvidence,
        ] },
        requests: [],
      }),
    })

    const result = await matcher.match(adjacentStackMatchRequest)

    expect(result).toEqual({ ok: true, value: adjacentStackProposal })
  })

  it('records proposed and kept Adjacent Evidence counts without Candidate content', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const matcher = createOpenAiJobMatchEvidenceMatcher({
      apiKey: 'test-api-key', model: 'structured-model', reasoningEffort: 'low',
      request: createRecordedRequest({
        output: { ...adjacentStackProposal, adjacentEvidence: [
          ...adjacentStackProposal.adjacentEvidence,
          { factMatches: [{ factExcerpt: 'React', factId: 'source-fact-invented' }],
            requirementId: 'job-requirement-java-stack' },
        ] },
        requests: [],
      }),
    })

    await matcher.match(adjacentStackMatchRequest)

    const lines = info.mock.calls.map(([line]) => String(line))
    info.mockRestore()
    expect(lines.map((line) => JSON.parse(line) as Record<string, unknown>)).toContainEqual({
      category: 'privacy-safe-openai-request', metric: 'sanitized', value: 1,
      dimensions: { operation: 'explainable-match-evidence', proposedRelevance: 0, keptRelevance: 0,
        proposedEvidence: 0, keptEvidence: 0, proposedAdjacentEvidence: 2, keptAdjacentEvidence: 1 },
    })
    expect(lines.join('\n')).not.toMatch(/React|TypeScript|Java/u)
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

const fullStackMatchRequest = {
  candidateFacts: [
    ...matchRequest.candidateFacts,
    { id: 'source-fact-2', kind: 'experience', value: 'Built end-to-end Next.js applications for 40 clients' },
  ],
  requirements: [...matchRequest.requirements, {
    ...matchRequest.requirements[0],
    capability: { dimension: 'execution', name: 'Web application development' },
    id: 'job-requirement-web' as const,
    importance: 'central',
    importanceRationale: 'The posting lists it among the main duties.',
    sourceExcerpt: 'Design, build and maintain web applications.',
    value: 'Design, build and maintain web applications',
  }],
} as const

const reformulatedFactMatch = {
  factExcerpt: 'end-to-end Next.js applications',
  factId: 'source-fact-2',
  requirementExcerpt: 'build and maintain web applications',
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
