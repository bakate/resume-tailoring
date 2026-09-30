import { describe, expect, it, vi } from 'vitest'
import { groupedResumeDocument, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import type { ProcessingConsent } from '@resume-tailoring/application/language-model-gateway'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
import { createResumeDocumentModelAdapters } from './resume-document-model-adapters'

const change = { baseRevision: 'draft-1', section: 'value-proposition', replacement: {
  kind: 'evidence-excerpts', paragraphs: [{ ...groupedResumeDocument.valueProposition.paragraphs[0],
    text: 'Delivered accessible billing screens' }],
} } as const

describe('resume document professional model boundary', () => {
  it('proposes condensed wording with unchanged identities, evidence and structure after semantic validation', async () => {
    const request = vi.fn<typeof fetch>(async (url, options) => {
      if (url === '/api/resume-claim-validation') return Response.json({
        ok: true, value: { supported: true, feedback: [] },
      })
      const payload = JSON.parse(await new Request('https://example.test', options).text()) as { claim: { segments: readonly { text: string; factIds: readonly string[] }[] } }
      return Response.json({ ok: true, value: { claims: [{ segments: payload.claim.segments.map((segment) => ({
        ...segment, text: segment.text.replace('Built accessible billing screens', 'Created accessible billing UI'),
      })) }] } })
    })
    const adapters = createResumeDocumentModelAdapters({ gateway: createConsentedGateway({ request }),
      createProposalId: () => 'proposal-1' })
    const result = await adapters.proposeCondensation({ baseRevision: 'draft-1',
      candidateFacts: structuredResumeSource.candidateFacts, document: groupedResumeDocument, maximumPages: 2 })

    expect(result.status).toBe('proposed')
    if (result.status !== 'proposed') return
    expect(result.proposal).toMatchObject({ id: 'proposal-1', baseRevision: 'draft-1',
      layout: { status: 'unavailable', revision: 'draft-1' }, document: {
        valueProposition: { paragraphs: [{ id: 'summary-billing', text: 'Created accessible billing UI',
          factIds: ['source-fact-experiences-0-achievements-0'] }] },
        sections: groupedResumeDocument.sections,
      } })
    expect(result.proposal.document.experiences).toHaveLength(2)
    expect(result.proposal.document.experiences[0]?.achievements).toEqual([{
      id: 'billing', text: 'Created accessible billing UI', factIds: ['source-fact-experiences-0-achievements-0'],
    }])
    expect(request.mock.calls.filter(([url]) => url === '/api/resume-claim-validation').length).toBeGreaterThanOrEqual(4)
  })

  it('rejects a condensation that loses original evidence even when the new wording is supported', async () => {
    const request = vi.fn<typeof fetch>(async (url, options) => {
      if (url === '/api/resume-claim-writing') return Response.json({ ok: true, value: { claims: [{
        segments: [{ text: 'Built screens', factIds: ['source-fact-experiences-0-achievements-0'] }],
      }] } })
      const reverse = (await new Request('https://example.test', options).text()).includes('source-fact-condensed-evidence')
      return Response.json({ ok: true, value: { supported: !reverse,
        feedback: reverse ? [{ code: 'unsupported-meaning', segmentIndex: 0 }] : [] } })
    })
    const adapters = createResumeDocumentModelAdapters({ gateway: createConsentedGateway({ request }) })
    expect(await adapters.proposeCondensation({ baseRevision: 'draft-1',
      candidateFacts: structuredResumeSource.candidateFacts, document: groupedResumeDocument, maximumPages: 2,
    })).toEqual({ status: 'failed', reason: 'unsupported-content', recovery: 'correct-content' })
  })

  it('requires current processing consent before transmitting editing or condensation content', async () => {
    const request = vi.fn<typeof fetch>()
    const gateway = createOpenAiLanguageModelGateway({ request, readProcessingConsent: () => null })
    const adapters = createResumeDocumentModelAdapters({ gateway })
    const failure = { status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' }
    expect(await adapters.validateSectionChange({ candidateFacts: structuredResumeSource.candidateFacts,
      currentDocument: groupedResumeDocument, change })).toEqual(failure)
    expect(await adapters.proposeCondensation({ baseRevision: 'draft-1',
      candidateFacts: structuredResumeSource.candidateFacts, document: groupedResumeDocument, maximumPages: 2,
    })).toEqual(failure)
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects edits with unattested references before transmitting content', async () => {
    const request = vi.fn<typeof fetch>()
    const adapters = createResumeDocumentModelAdapters({ gateway: createConsentedGateway({ request }) })
    expect(await adapters.validateSectionChange({ candidateFacts: [],
      currentDocument: groupedResumeDocument, change })).toEqual({
      status: 'unsupported', baseRevision: 'draft-1', fieldIds: ['summary-billing'],
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('validates changed meaning against only its linked attested Candidate Facts', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      ok: true, value: { supported: true, feedback: [] },
    }))
    const gateway = createConsentedGateway({ request })
    const adapters = createResumeDocumentModelAdapters({ gateway })

    expect(await adapters.validateSectionChange({ candidateFacts: structuredResumeSource.candidateFacts,
      currentDocument: groupedResumeDocument, change })).toEqual({ status: 'validated', change })
    const payload: unknown = JSON.parse(await new Request('https://example.test', request.mock.calls[0]?.[1]).text())
    expect(request.mock.calls[0]?.[0]).toBe('/api/resume-claim-validation')
    expect(payload).toEqual({ claim: { id: 'resume-claim-summary-billing', segments: [{
      text: 'Delivered accessible billing screens', factIds: ['source-fact-experiences-0-achievements-0'],
    }] }, verifiedFacts: [{ id: 'source-fact-experiences-0-achievements-0', kind: 'experience',
      value: 'Built accessible billing screens' }] })
  })
})

function createConsentedGateway({ request }: Readonly<{ request: typeof fetch }>) {
  let consent: ProcessingConsent | null = null
  const gateway = createOpenAiLanguageModelGateway({ readProcessingConsent: () => consent, request })
  consent = { grantedAt: 1, policy: gateway.processingPolicy }
  return gateway
}
