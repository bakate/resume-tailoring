import { describe, expect, it, vi } from 'vitest'

import type { ProcessingConsent } from '@resume-tailoring/application/language-model-gateway'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'

describe('OpenAI Language Model Gateway adapter', () => {
  it('does not make a model request before Processing Consent', async () => {
    const request = vi.fn<typeof fetch>()
    const gateway = createOpenAiLanguageModelGateway({
      readProcessingConsent: () => null,
      request,
    })

    const result = await gateway.structured.process({
      input: { professionalContent: 'Candidate content' },
      operation: 'source-profile-extraction',
    })

    expect(result).toEqual({ ok: false, error: { type: 'processing-consent-required' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('blocks structured Source Profile extraction before Processing Consent', async () => {
    const request = vi.fn<typeof fetch>()
    const gateway = createOpenAiLanguageModelGateway({
      readProcessingConsent: () => null,
      request,
    })

    const result = await gateway.structured.process({
      input: { professionalContent: 'Candidate content' },
      operation: 'structured-source-profile-extraction',
    })

    expect(result).toEqual({ ok: false, error: { type: 'processing-consent-required' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('routes structured work through the validated production adapter', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourceProfileResponse))
    const gateway = createConsentedGateway({ request })

    const result = await gateway.structured.process({
      input: { professionalContent: 'TypeScript' },
      operation: 'source-profile-extraction',
    })

    expect(result).toEqual({
      ok: true,
      value: { operation: 'source-profile-extraction', value: sourceProfileResponse.value },
    })
    expect(request).toHaveBeenCalledWith('/api/source-profile-extraction', expect.objectContaining({
      body: JSON.stringify({ professionalContent: 'TypeScript' }), method: 'POST',
    }))
  })

  it('routes structured Source Profile extraction only after Processing Consent', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(structuredSourceProfileResponse),
    )
    const gateway = createConsentedGateway({ request })

    const result = await gateway.structured.process({
      input: { professionalContent: 'TypeScript' },
      operation: 'structured-source-profile-extraction',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        operation: 'structured-source-profile-extraction',
        value: structuredSourceProfileResponse.value,
      },
    })
    expect(request).toHaveBeenCalledWith(
      '/api/structured-source-profile-extraction',
      expect.objectContaining({
        body: JSON.stringify({ professionalContent: 'TypeScript' }),
        method: 'POST',
      }),
    )
  })

  it('routes writing work through the validated production adapter', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(resumeClaimResponse))
    const gateway = createConsentedGateway({ request })

    const result = await gateway.writing.process({
      input: writingInputs,
      operation: 'resume-claim-writing',
    })

    expect(result).toEqual({
      ok: true,
      value: { operation: 'resume-claim-writing', value: resumeClaimResponse.value.claims },
    })
    expect(request).toHaveBeenCalledWith('/api/resume-claim-writing', expect.objectContaining({
      body: JSON.stringify({ operation: 'write', ...writingInputs }), method: 'POST',
    }))
  })
})

function createConsentedGateway({ request }: Readonly<{ request: typeof fetch }>) {
  let processingConsent: ProcessingConsent | null = null
  const gateway = createOpenAiLanguageModelGateway({
    readProcessingConsent: () => processingConsent,
    request,
  })
  processingConsent = { grantedAt: 1_000, policy: gateway.processingPolicy }
  return gateway
}

const sourceProfileResponse = {
  ok: true,
  value: [{
    assessment: 'usable',
    kind: 'skill',
    propositionKey: 'proposition-skill-typescript',
    value: 'TypeScript',
  }],
} as const

const structuredSourceProfileResponse = {
  ok: true,
  value: {
    certifications: [],
    criticalAmbiguities: [],
    education: [],
    experiences: [],
    languages: [],
    projects: [],
    skills: [{ category: null, name: 'TypeScript' }],
  },
} as const

const writingInputs = {
  evidence: [{
    factIds: ['source-fact-typescript'],
    requirementId: 'job-requirement-typescript',
  }],
  locale: 'en',
  requirements: [{
    classification: 'required',
    id: 'job-requirement-typescript',
    value: 'TypeScript',
  }],
  verifiedFacts: [{
    id: 'source-fact-typescript',
    kind: 'skill',
    value: 'TypeScript',
  }],
} as const

const resumeClaimResponse = {
  ok: true,
  value: { claims: [{ segments: [{
    factIds: ['source-fact-typescript'],
    text: 'Built TypeScript systems.',
  }] }] },
} as const
