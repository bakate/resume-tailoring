import { describe, expect, it, vi } from 'vitest'

import type { ProcessingConsent } from '@resume-tailoring/application/language-model-gateway'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'

describe('OpenAI Language Model Gateway adapter', () => {
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
