import { describe, expect, it, vi } from 'vitest'

import { formatResumeClaimText, submitReformulation } from './tailored-resume-workspace'

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

const resumeClaim = {
  id: 'resume-claim-experience',
  segments: [{ factIds: ['source-fact-experience'], text: 'Built APIs' }],
} as const

const readyView = {
  status: 'ready',
  sessionId: 'candidate-session-test',
  expiresAt: 1,
} as const
