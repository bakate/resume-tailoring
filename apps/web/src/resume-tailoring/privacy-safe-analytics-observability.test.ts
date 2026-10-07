import { describe, expect, it, vi } from 'vitest'

import {
  createPrivacySafeAggregateMetric,
  recordPrivacySafeAnalytics,
} from './privacy-safe-analytics-observability'

describe('privacy-safe analytics observability', () => {
  it('writes an aggregate event without a Candidate identifier', () => {
    const writeEvent = vi.fn()

    const result = recordPrivacySafeAnalytics({
      value: {
        name: 'resume-downloaded',
        matchScoreBand: '50-74',
      },
      writeEvent,
    })

    expect(result).toEqual({ ok: true })
    expect(writeEvent).toHaveBeenCalledWith({
      name: 'resume-downloaded',
      matchScoreBand: '50-74',
    })
  })

  it('rejects an unexpected analytics property before it reaches observability', () => {
    const writeEvent = vi.fn()

    const result = recordPrivacySafeAnalytics({
      value: {
        name: 'resume-downloaded',
        matchScoreBand: '50-74',
        sourceProfile: 'Private Candidate history',
      },
      writeEvent,
    })

    expect(result).toEqual({ ok: false })
    expect(writeEvent).not.toHaveBeenCalled()
  })

  it('rejects an uncaught error report that carries its message', () => {
    const writeEvent = vi.fn()

    const result = recordPrivacySafeAnalytics({
      value: { name: 'uncaught-error-reported', source: 'error', message: 'Alex Morgan cannot be rendered' },
      writeEvent,
    })

    expect(result).toEqual({ ok: false })
    expect(writeEvent).not.toHaveBeenCalled()
  })

  it('produces counters operators can aggregate by outcome and Match Score band', () => {
    const metric = createPrivacySafeAggregateMetric({
      name: 'resume-usefulness-rated',
      hasComment: false,
      matchScoreBand: '25-49',
      useful: false,
    })

    expect(metric).toEqual({
      category: 'privacy-safe-mvp-analytics',
      metric: 'resume-usefulness-rated',
      value: 1,
      dimensions: {
        hasComment: false,
        matchScoreBand: '25-49',
        useful: false,
      },
    })
    expect(metric.dimensions).not.toHaveProperty('candidateId')
  })

  it('produces a render failure counter with only the category and retry flag', () => {
    const metric = createPrivacySafeAggregateMetric({
      name: 'resume-render-failed',
      category: 'timeout',
      retried: true,
    })

    expect(metric).toEqual({
      category: 'privacy-safe-mvp-analytics',
      metric: 'resume-render-failed',
      value: 1,
      dimensions: { category: 'timeout', retried: true },
    })
  })

  it('produces a journey counter with only the reached phase', () => {
    const metric = createPrivacySafeAggregateMetric({
      name: 'candidate-journey-phase-reached',
      phase: 'tailored-resume-preparation',
    })

    expect(metric).toEqual({
      category: 'privacy-safe-mvp-analytics',
      metric: 'candidate-journey-phase-reached',
      value: 1,
      dimensions: { phase: 'tailored-resume-preparation' },
    })
    expect(metric.dimensions).not.toHaveProperty('sessionId')
  })
})
