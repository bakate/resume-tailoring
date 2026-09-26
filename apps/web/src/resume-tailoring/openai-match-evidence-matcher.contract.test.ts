import type {
  JobRequirement,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { describe, expect, it } from 'vitest'

import { createOpenAiMatchEvidenceMatcher } from './openai-match-evidence-matcher'

describe('OpenAI Match Evidence matcher contract', () => {
  it('uses a stateless strict request limited to Job Requirements and Verified Facts', async () => {
    const requests: Request[] = []
    const matcher = createOpenAiMatchEvidenceMatcher({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: (input, init) => {
        requests.push(new Request(input, init))
        return Promise.resolve(Response.json(createOpenAiResponse()))
      },
    })

    const result = await matcher.match({ requirements, verifiedFacts })

    expect(result).toEqual({ ok: true, value: expectedEvidence })
    const requestBody = await readRequestBody(requests)
    expect(requestBody).toMatchObject({
      model: 'structured-model',
      store: false,
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
    expect(JSON.stringify(requestBody)).toMatch(
      /role, a transferable skill, or qualitative seniority as implicit proof/iu,
    )
  })

  it('rejects evidence that references input identifiers not supplied to the model', async () => {
    const matcher = createOpenAiMatchEvidenceMatcher({
      apiKey: 'test-api-key',
      model: 'structured-model',
      request: () => Promise.resolve(Response.json(createOpenAiResponse({
        evidence: [{
          requirementId: 'job-requirement-invented',
          factIds: ['source-fact-invented'],
        }],
      }))),
    })

    const result = await matcher.match({ requirements, verifiedFacts })

    expect(result).toEqual(matchAnalysisUnavailableResult)
  })
})

async function readRequestBody(requests: readonly Request[]) {
  const [request] = requests
  expect(request).toBeDefined()
  return request?.json() as Promise<unknown> | undefined
}

function createOpenAiResponse({
  evidence = expectedEvidence,
}: Readonly<{ evidence?: readonly unknown[] }> = {}) {
  return {
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ evidence }) }],
    }],
  }
}

const verifiedFacts = [{
  id: 'source-fact-typescript',
  kind: 'skill',
  propositionKey: 'proposition-skill-typescript',
  status: 'verified',
  value: 'TypeScript',
}] as const satisfies readonly SourceProfileFact[]

const requirements = [{
  id: 'job-requirement-typescript',
  groupId: 'job-requirement-group-technical',
  classification: 'required',
  sourceExcerpt: 'TS is required.',
  value: 'Know TS',
}] as const satisfies readonly JobRequirement[]

const expectedEvidence = [{
  requirementId: 'job-requirement-typescript',
  factIds: ['source-fact-typescript'],
}] as const

const matchAnalysisUnavailableResult = {
  ok: false,
  error: { type: 'match-analysis-unavailable' },
} as const
