import { describe, expect, it, vi } from 'vitest'
import type { ProcessingConsent } from '@resume-tailoring/application/language-model-gateway'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
import { createResumeDocumentModelAdapters } from './resume-document-model-adapters'

const verifiedFacts = [{ id: 'source-fact-experiences-0-achievements-0', kind: 'experience',
  value: 'Built accessible billing screens' }] as const
const claim = { id: 'resume-claim-summary-billing', segments: [{ text: 'Delivered accessible billing screens',
  factIds: ['source-fact-experiences-0-achievements-0'] }] } as const
const condensationRequest = { claim: { segments: claim.segments }, locale: 'en', verifiedFacts } as const

describe('resume document professional model boundary', () => {
  it.each([
    { supported: true, feedback: [] },
    { supported: false, feedback: [{ code: 'unsupported-meaning', segmentIndex: 0 }] },
  ])('reads a semantic validation that judges the claim supported: $supported', async ({ supported, feedback }) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, value: { supported, feedback } }))
    const adapters = createResumeDocumentModelAdapters({ gateway: createConsentedGateway({ request }) })

    const result = await adapters.validateClaim({ claim, verifiedFacts })

    expect(result).toEqual({ ok: true, value: { supported } })
    expect(await readPayload({ request })).toEqual({ claim, verifiedFacts })
  })

  it('asks for faithful shortening without requirements or evidence and returns the proposed wording', async () => {
    const condensed = { segments: [{ text: 'Accessible billing screens', factIds: ['source-fact-experiences-0-achievements-0'] }] }
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, value: { claims: [condensed] } }))
    const adapters = createResumeDocumentModelAdapters({ gateway: createConsentedGateway({ request }) })

    const result = await adapters.condenseClaim(condensationRequest)

    expect(result).toEqual({ ok: true, value: condensed })
    const payload = await readPayload({ request }) as Readonly<{ request?: unknown }>
    expect(payload).toMatchObject({ claim: condensationRequest.claim, locale: 'en', verifiedFacts,
      feedback: [], requirements: [], evidence: [] })
    expect(String(payload.request)).toContain('Preserve every factual detail')
  })

  it('requires current processing consent before transmitting a claim', async () => {
    const request = vi.fn<typeof fetch>()
    const adapters = createResumeDocumentModelAdapters({
      gateway: createOpenAiLanguageModelGateway({ request, readProcessingConsent: () => null }),
    })

    const outcomes = await Promise.all([adapters.validateClaim({ claim, verifiedFacts }),
      adapters.condenseClaim(condensationRequest)])

    const failure = { ok: false, error: 'processing-consent-required' }
    expect(outcomes).toEqual([failure, failure])
    expect(request).not.toHaveBeenCalled()
  })

  it('reports an unavailable model when the claim service fails', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false }, { status: 503 }))
    const adapters = createResumeDocumentModelAdapters({ gateway: createConsentedGateway({ request }) })

    const outcomes = await Promise.all([adapters.validateClaim({ claim, verifiedFacts }),
      adapters.condenseClaim(condensationRequest)])

    const failure = { ok: false, error: 'unavailable' }
    expect(outcomes).toEqual([failure, failure])
  })
})

function createConsentedGateway({ request }: Readonly<{ request: typeof fetch }>) {
  let consent: ProcessingConsent | null = null
  const gateway = createOpenAiLanguageModelGateway({ readProcessingConsent: () => consent, request })
  consent = { grantedAt: 1, policy: gateway.processingPolicy }
  return gateway
}

async function readPayload({ request }: Readonly<{ request: ReturnType<typeof vi.fn<typeof fetch>> }>): Promise<unknown> {
  return JSON.parse(await new Request('https://example.test', request.mock.calls[0]?.[1]).text())
}
