import { describe, expect, it, vi } from 'vitest'

import {
  createLanguageModelGateway,
} from '@resume-tailoring/application/language-model-gateway'
import type {
  LanguageModelGatewayAdapter,
  ProcessingConsent,
  ProcessingPolicy,
} from '@resume-tailoring/application/language-model-gateway'

const activeProcessingPolicy = {
  provider: 'Example Model Provider',
  purposes: ['Extract professional evidence', 'Write supported resume content'],
  retentionPolicy: 'Requests may be retained for abuse monitoring for up to 30 days.',
  storageBehavior: 'Candidate content is not stored for model training.',
  transmittedDataCategories: ['Professional facts', 'Job Posting content'],
  version: '2026-09-29',
} as const satisfies ProcessingPolicy

describe('Language Model Gateway contract', () => {
  it('exposes the active policy and both model roles after consent', async () => {
    const processingConsent = {
      grantedAt: 1_000,
      policy: activeProcessingPolicy,
    } satisfies ProcessingConsent
    const system = createSystemUnderTest({ processingConsent })

    const structuredResult = await system.gateway.structured.process({ content: 'Facts' })
    const writingResult = await system.gateway.writing.process({ content: 'Evidence' })

    expect(system.gateway.processingPolicy).toEqual(activeProcessingPolicy)
    expect(structuredResult).toEqual(successfulModelResult)
    expect(writingResult).toEqual(successfulModelResult)
  })

  it.each(['structured', 'writing'] as const)(
    'does not transmit Candidate content through the %s role before consent',
    async (role) => {
      const system = createSystemUnderTest({ processingConsent: null })

      const result = await system.gateway[role].process({ content: 'Candidate content' })

      expect(result).toEqual({ ok: false, error: { type: 'processing-consent-required' } })
      expect(system.processStructuredContent).not.toHaveBeenCalled()
      expect(system.processWritingContent).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['provider', { provider: 'Changed Model Provider' }],
    ['version', { version: '2026-09-30' }],
    ['purposes', { purposes: ['Changed purpose'] }],
    ['transmitted categories', { transmittedDataCategories: ['Changed category'] }],
    ['retention policy', { retentionPolicy: 'Changed retention.' }],
    ['storage behavior', { storageBehavior: 'Changed storage.' }],
  ] as const)('requires renewed consent after changed %s', async (_change, policyChange) => {
    const processingConsent = {
      grantedAt: 1_000,
      policy: { ...activeProcessingPolicy, ...policyChange },
    } satisfies ProcessingConsent
    const system = createSystemUnderTest({ processingConsent })

    const result = await system.gateway.structured.process({ content: 'Candidate content' })

    expect(result).toEqual({ ok: false, error: { type: 'processing-consent-required' } })
    expect(system.processStructuredContent).not.toHaveBeenCalled()
  })
})

function createSystemUnderTest({ processingConsent }: Readonly<{
  processingConsent: ProcessingConsent | null
}>) {
  const processStructuredContent = vi.fn<LanguageModelProcessor>()
  const processWritingContent = vi.fn<LanguageModelProcessor>()
  processStructuredContent.mockResolvedValue(successfulModelResult)
  processWritingContent.mockResolvedValue(successfulModelResult)
  const adapter = createAdapter({ processStructuredContent, processWritingContent })
  return {
    gateway: createLanguageModelGateway({
      adapter,
      readProcessingConsent: () => processingConsent,
    }),
    processStructuredContent,
    processWritingContent,
  }
}

function createAdapter({ processStructuredContent, processWritingContent }: Readonly<{
  processStructuredContent: LanguageModelProcessor
  processWritingContent: LanguageModelProcessor
}>): LanguageModelGatewayAdapter<ModelRequest, ModelResponse> {
  return {
    processingPolicy: activeProcessingPolicy,
    structured: { process: processStructuredContent },
    writing: { process: processWritingContent },
  }
}

type ModelRequest = Readonly<{ content: string }>
type ModelResponse = Readonly<{ result: string }>
const successfulModelResult = {
  ok: true,
  value: { result: 'Processed content' },
} as const
type LanguageModelProcessor = (request: ModelRequest) => Promise<{
  readonly ok: true
  readonly value: ModelResponse
} | {
  readonly ok: false
  readonly error: { readonly type: 'language-model-unavailable' }
}>
