import { describe, expect, it, vi } from 'vitest'

import {
  formatResumeClaimText,
  generateResumeClaims,
  submitReformulation,
} from './tailored-resume-workspace'
import type { CandidateSessionController } from './use-candidate-session'

describe('formatResumeClaimText', () => {
  it('separates adjacent words without adding spaces before punctuation', () => {
    expect(formatResumeClaimText({
      segments: [
        { factIds: ['source-fact-experience'], text: 'Built APIs' },
        { factIds: ['source-fact-typescript'], text: 'with TypeScript' },
        { factIds: ['source-fact-typescript'], text: '.' },
      ],
    })).toBe('Built APIs with TypeScript.')
  })
})

describe('submitReformulation', () => {
  it('preserves the request when reformulation fails', async () => {
    const clearRequest = vi.fn()
    const result = await submitReformulation({
      candidateSession: {
        reformulateResumeClaim: () => Promise.resolve({
          ok: false,
          error: { type: 'resume-claim-writing-unavailable' },
        } as const),
      },
      claim: resumeClaim,
      clearRequest,
      reformulationRequest: 'Make it shorter',
    })

    expect(result.ok).toBe(false)
    expect(clearRequest).not.toHaveBeenCalled()
  })

  it('clears the request when reformulation succeeds', async () => {
    const clearRequest = vi.fn()
    const result = await submitReformulation({
      candidateSession: {
        reformulateResumeClaim: () => Promise.resolve({ ok: true, value: readyView } as const),
      },
      claim: resumeClaim,
      clearRequest,
      reformulationRequest: 'Make it shorter',
    })

    expect(result.ok).toBe(true)
    expect(clearRequest).toHaveBeenCalledOnce()
  })
})

describe('generateResumeClaims', () => {
  it('clears unsupported edits only after successful regeneration', async () => {
    const onGenerated = vi.fn()

    await generateResumeClaims({
      candidateSession: createGenerationController({ result: { ok: true, value: readyView } }),
      locale: 'en',
      onGenerated,
    })

    expect(onGenerated).toHaveBeenCalledOnce()
  })

  it('preserves unsupported edits when regeneration fails', async () => {
    const onGenerated = vi.fn()

    await generateResumeClaims({
      candidateSession: createGenerationController({ result: {
        ok: false, error: { type: 'resume-claim-writing-unavailable' },
      } }),
      locale: 'en',
      onGenerated,
    })

    expect(onGenerated).not.toHaveBeenCalled()
  })
})

function createGenerationController({ result }: Readonly<{
  result: Awaited<ReturnType<CandidateSessionController['generateResumeClaims']>>
}>) {
  return {
    generateResumeClaims: () => Promise.resolve(result),
  }
}

const resumeClaim = {
  id: 'resume-claim-experience',
  segments: [{ factIds: ['source-fact-experience'], text: 'Built APIs' }],
} as const

const readyView = {
  status: 'ready',
  sessionId: 'candidate-session-test',
  expiresAt: 1,
} as const
