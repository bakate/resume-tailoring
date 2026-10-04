import type { ResumeClaim, ResumeClaimWritingInputs } from '@resume-tailoring/application/resume-claims'
import { describe, expect, it } from 'vitest'

import {
  createOpenAiResumeClaimSemanticValidator,
  createOpenAiResumeClaimReformulator,
} from './openai-resume-claim-service'

describe('OpenAI Resume Claim service contract', () => {
  it('reformulates a claim through a strict stateless writing-model request', async () => {
    const requests: Request[] = []
    const reformulator = createOpenAiResumeClaimReformulator({
      apiKey: 'test-api-key',
      model: 'writing-model',
      reasoningEffort: 'medium',
      request: createRequestSpy({ requests, value: { claims: [proposedClaim] } }),
    })

    const result = await reformulator.reformulate(reformulation)

    expect(result).toEqual({ ok: true, value: proposedClaim })
    const requestBody = await readRequestBody({ requests })
    expect(requestBody).toMatchObject({
      model: 'writing-model',
      reasoning: { effort: 'medium' },
      store: false,
      input: [
        { role: 'developer', content: [{ type: 'input_text' }] },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify({ ...writingInputs,
            revision: { claim: proposedClaim, feedback: reformulation.feedback } }) }],
        },
      ],
      text: { format: { type: 'json_schema', name: 'resume_claims', strict: true } },
    })
    expect(JSON.stringify(requestBody)).toMatch(/causality, scope, autonomy, seniority/iu)
    expect(JSON.stringify(requestBody)).toMatch(/exact language requested by locale/iu)
  })

  it('rejects a reformulation that references facts outside the minimized writing input', async () => {
    const reformulator = createOpenAiResumeClaimReformulator({
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

    const result = await reformulator.reformulate(reformulation)

    expect(result).toEqual(resumeClaimWritingUnavailableResult)
  })

  it('semantically rejects inexact fact references with the structured model', async () => {
    const requests: Request[] = []
    const validator = createOpenAiResumeClaimSemanticValidator({
      apiKey: 'test-api-key',
      model: 'structured-model',
      reasoningEffort: 'low',
      request: createRequestSpy({
        requests,
        value: {
          supported: false,
          feedback: [{ code: 'inexact-fact-reference', segmentIndex: 0 }],
        },
      }),
    })

    const result = await validator.validate({
      claim: storedClaim,
      verifiedFacts: writingInputs.verifiedFacts,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        supported: false,
        feedback: [{ code: 'inexact-fact-reference', segmentIndex: 0 }],
      },
    })
    const requestBody = await readRequestBody({ requests })
    expect(requestBody).toMatchObject({
      model: 'structured-model',
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: { type: 'json_schema', name: 'resume_claim_validation', strict: true },
      },
    })
    expect(JSON.stringify(requestBody)).toMatch(/Every referenced fact must directly support/iu)
  })

  it('reuses one deadline across sequential semantic validations', async () => {
    const requests: Request[] = []
    const signals: (AbortSignal | null)[] = []
    const deadlineSignal = new AbortController().signal
    const validator = createOpenAiResumeClaimSemanticValidator({
      apiKey: 'test-api-key',
      deadlineSignal,
      model: 'structured-model',
      reasoningEffort: 'low',
      request: createRequestSpy({
        requests,
        signals,
        value: { supported: true, feedback: [] },
      }),
    })

    await validator.validate({ claim: storedClaim, verifiedFacts: writingInputs.verifiedFacts })
    await validator.validate({ claim: storedClaim, verifiedFacts: writingInputs.verifiedFacts })

    expect(signals).toEqual([deadlineSignal, deadlineSignal])
  })
})

function createRequestSpy({
  requests,
  signals,
  value,
}: Readonly<{
  requests: Request[]
  signals?: (AbortSignal | null)[]
  value: unknown
}>): typeof fetch {
  return (input, init) => {
    requests.push(new Request(input, init))
    signals?.push(init?.signal ?? null)
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
  locale: 'en',
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

const reformulation = {
  ...writingInputs,
  claim: proposedClaim,
  feedback: [{ code: 'unsupported-meaning', segmentIndex: 0 }],
} as const

const storedClaim = {
  id: 'resume-claim-typescript',
  ...proposedClaim,
} as const satisfies ResumeClaim

const resumeClaimWritingUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-writing-unavailable' },
} as const
