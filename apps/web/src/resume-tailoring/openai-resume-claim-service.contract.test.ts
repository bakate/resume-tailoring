import type {
  ResumeClaim,
  ResumeClaimWritingInputs,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { describe, expect, it } from 'vitest'

import {
  createOpenAiResumeClaimSemanticValidator,
  createOpenAiResumeClaimWriter,
} from './openai-resume-claim-service'

describe('OpenAI Resume Claim service contract', () => {
  it('writes strict structured claims through a stateless writing-model request', async () => {
    const requests: Request[] = []
    const writer = createOpenAiResumeClaimWriter({
      apiKey: 'test-api-key',
      model: 'writing-model',
      reasoningEffort: 'medium',
      request: createRequestSpy({ requests, value: { claims: [proposedClaim] } }),
    })

    const result = await writer.write(writingInputs)

    expect(result).toEqual({ ok: true, value: [proposedClaim] })
    const requestBody = await readRequestBody({ requests })
    expect(requestBody).toMatchObject({
      model: 'writing-model',
      reasoning: { effort: 'medium' },
      store: false,
      input: [
        { role: 'developer', content: [{ type: 'input_text' }] },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(writingInputs) }],
        },
      ],
      text: { format: { type: 'json_schema', name: 'resume_claims', strict: true } },
    })
    expect(JSON.stringify(requestBody)).toMatch(/causality, scope, autonomy, seniority/iu)
  })

  it('rejects claims that reference facts outside the minimized writing input', async () => {
    const writer = createOpenAiResumeClaimWriter({
      apiKey: 'test-api-key',
      model: 'writing-model',
      reasoningEffort: 'medium',
      request: createRequestSpy({
        requests: [],
        value: { claims: [{
          segments: [{ text: 'Invented', factIds: ['source-fact-invented'] }],
        }] },
      }),
    })

    const result = await writer.write(writingInputs)

    expect(result).toEqual(resumeClaimWritingUnavailableResult)
  })

  it('semantically validates one deterministic claim with the structured model', async () => {
    const requests: Request[] = []
    const validator = createOpenAiResumeClaimSemanticValidator({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: createRequestSpy({ requests, value: { supported: true } }),
    })

    const result = await validator.validate({
      claim: storedClaim,
      verifiedFacts: writingInputs.verifiedFacts,
    })

    expect(result).toEqual({ ok: true, value: true })
    const requestBody = await readRequestBody({ requests })
    expect(requestBody).toMatchObject({
      model: 'structured-model',
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: { type: 'json_schema', name: 'resume_claim_validation', strict: true },
      },
    })
  })
})

function createRequestSpy({
  requests,
  value,
}: Readonly<{ requests: Request[]; value: unknown }>): typeof fetch {
  return (input, init) => {
    requests.push(new Request(input, init))
    return Promise.resolve(Response.json({
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(value) }],
      }],
    }))
  }
}

async function readRequestBody({ requests }: Readonly<{ requests: readonly Request[] }>) {
  const [request] = requests
  expect(request).toBeDefined()
  return request?.json() as Promise<unknown> | undefined
}

const writingInputs = {
  evidence: [{
    requirementId: 'job-requirement-typescript',
    factIds: ['source-fact-typescript'],
  }],
  requirements: [{
    id: 'job-requirement-typescript',
    classification: 'required',
    value: 'TypeScript',
  }],
  verifiedFacts: [{
    id: 'source-fact-typescript',
    kind: 'skill',
    value: 'Used TypeScript',
  }],
} as const satisfies ResumeClaimWritingInputs

const proposedClaim = {
  segments: [{ text: 'Used TypeScript', factIds: ['source-fact-typescript'] }],
} as const

const storedClaim = {
  id: 'resume-claim-typescript',
  ...proposedClaim,
} as const satisfies ResumeClaim

const resumeClaimWritingUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-writing-unavailable' },
} as const
