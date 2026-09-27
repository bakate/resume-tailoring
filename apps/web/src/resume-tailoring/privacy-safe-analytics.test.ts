import { describe, expect, it, vi } from 'vitest'

import type { PrivacySafeTelemetry } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import { createPrivacySafeBrowserTelemetry } from './browser-adapters'

describe('privacy-safe browser analytics', () => {
  it('transmits an allowlisted aggregate outcome', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }))
    const telemetry = createPrivacySafeBrowserTelemetry({ request })

    const result = await telemetry.record({
      name: 'resume-relevance-rated',
      assessment: 'relevant',
      matchScoreBand: '75-100',
    })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(request).toHaveBeenCalledWith('/api/analytics', {
      body: JSON.stringify({
        name: 'resume-relevance-rated',
        assessment: 'relevant',
        matchScoreBand: '75-100',
      }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })

  it.each([
    'candidateName',
    'contactDetails',
    'sourceDocumentText',
    'sourceProfileFacts',
    'jobPostingText',
    'photo',
    'resumeClaims',
    'preview',
    'pdfContent',
  ])('fails closed before transmitting %s', async (forbiddenProperty) => {
    const request = vi.fn<typeof fetch>()
    const telemetry = createPrivacySafeBrowserTelemetry({ request })
    const eventWithCandidateContent = {
      name: 'resume-downloaded',
      matchScoreBand: '75-100',
      [forbiddenProperty]: 'Private Candidate content',
    } as Parameters<PrivacySafeTelemetry['record']>[0]

    const result = await telemetry.record(eventWithCandidateContent)

    expect(result).toEqual({ ok: false, error: { type: 'adapter-unavailable' } })
    expect(request).not.toHaveBeenCalled()
  })
})
