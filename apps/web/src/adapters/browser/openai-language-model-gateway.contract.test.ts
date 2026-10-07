import { describe, expect, it, vi } from 'vitest'
import type { ProcessingConsent } from '@resume-tailoring/application/language-model-gateway'
import { groupedResumeDocument } from '@resume-tailoring/application/structured-resume-fixtures'

import { failureResponse } from '../../api-failure'
import {
  createGatewayJobPostingExtractor,
  createGatewayMatchEvidenceMatcher,
  createGatewayResumeSectionModels,
  createGatewaySourceProfileExtractor,
} from './language-model-gateway-ports'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
import { createResumeDocumentModelAdapters } from './resume-document-model-adapters'

const rateLimited = { type: 'rate-limited', retryAfterSeconds: 20 } as const
const verifiedFacts = [{ id: 'source-fact-experiences-0-achievements-0', kind: 'experience',
  value: 'Built accessible billing screens' }] as const
const claim = { id: 'resume-claim-summary-billing', segments: [{ text: 'Delivered accessible billing screens',
  factIds: ['source-fact-experiences-0-achievements-0'] }] } as const

describe('API Failures through the OpenAI Language Model Gateway', () => {
  it('tells the Source Profile extraction which API Failure stopped it', async () => {
    const gateway = createGatewayAnswering(() => failureResponse(rateLimited))

    const result = await createGatewaySourceProfileExtractor({ languageModelGateway: gateway })
      .extract({ professionalContent: 'Built billing screens' })

    expect(result).toEqual({ ok: false, error: 'source-profile-extraction-unavailable', apiFailure: rateLimited })
  })

  it('tells the Job Posting extraction which API Failure stopped it', async () => {
    const gateway = createGatewayAnswering(() => failureResponse({ type: 'input-too-large' }))

    const result = await createGatewayJobPostingExtractor({ languageModelGateway: gateway })
      .extract({ jobPostingContent: 'React engineer' })

    expect(result).toEqual({ ok: false, error: 'job-posting-extraction-unavailable', apiFailure: { type: 'input-too-large' } })
  })

  it('tells the Match Evidence comparison that the request never reached the server', async () => {
    const gateway = createGatewayAnswering(() => { throw new TypeError('Failed to fetch') })

    const result = await createGatewayMatchEvidenceMatcher({ languageModelGateway: gateway })
      .match({ candidateFacts: [], requirements: [] })

    expect(result).toEqual({ ok: false, error: 'match-evidence-unavailable', apiFailure: { type: 'network' } })
  })

  it('tells the Match Evidence comparison that the server answered something unreadable', async () => {
    const gateway = createGatewayAnswering(() => Response.json({ ok: true, value: { unexpected: true } }))

    const result = await createGatewayMatchEvidenceMatcher({ languageModelGateway: gateway })
      .match({ candidateFacts: [], requirements: [] })

    expect(result).toEqual({ ok: false, error: 'match-evidence-unavailable', apiFailure: { type: 'unexpected-response' } })
  })

  it.each([
    [{ type: 'provider-unavailable' }, 'transient'],
    [rateLimited, 'transient'],
    [{ type: 'timeout' }, 'timeout'],
    [{ type: 'demo-access-required' }, 'permanent'],
    [{ type: 'invalid-provider-response' }, 'permanent'],
  ] as const)('keeps the API Failure %o beside the %s section model failure', async (apiFailure, type) => {
    const gateway = createGatewayAnswering(() => failureResponse({ ...apiFailure, usage: { inputTokens: 40, outputTokens: 2 } }))

    const result = await createGatewayResumeSectionModels({ languageModelGateway: gateway })
      .checkCoherence({ document: groupedResumeDocument })

    expect(result).toEqual({ ok: false, error: { type, apiFailure } })
  })

  it('keeps the API Failure of a Resume Claim the model could not validate or condense', async () => {
    const adapters = createResumeDocumentModelAdapters({ gateway: createGatewayAnswering(() => failureResponse(rateLimited)) })

    const outcomes = await Promise.all([
      adapters.validateClaim({ claim, verifiedFacts }),
      adapters.condenseClaim({ claim: { segments: claim.segments }, locale: 'en', verifiedFacts }),
    ])

    const failure = { ok: false, error: 'unavailable', apiFailure: rateLimited }
    expect(outcomes).toEqual([failure, failure])
  })
})

function createGatewayAnswering(answer: () => Response) {
  const request = vi.fn<typeof fetch>(() => Promise.resolve().then(answer))
  let consent: ProcessingConsent | null = null
  const gateway = createOpenAiLanguageModelGateway({ readProcessingConsent: () => consent, request })
  consent = { grantedAt: 1, policy: gateway.processingPolicy }
  return gateway
}
