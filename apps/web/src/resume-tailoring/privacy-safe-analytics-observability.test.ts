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

  it('writes a preparation phase timing with its random identifier, duration and render count', () => {
    const writeEvent = vi.fn()

    const result = recordPrivacySafeAnalytics({ value: overflowReductionTiming, writeEvent })

    expect(result).toEqual({ ok: true })
    expect(writeEvent).toHaveBeenCalledWith(overflowReductionTiming)
  })

  it.each([
    ['a content field', { ...overflowReductionTiming, jobPostingText: 'Senior Frontend Engineer at Northwind' }],
    ['content in place of the identifier', { ...overflowReductionTiming, preparationId: 'alex.morgan@example.com' }],
    ['an Overflow Reduction without its render count', { name: 'preparation-phase-timed',
      preparationId: overflowReductionTiming.preparationId, phase: 'overflow-reduction', durationMilliseconds: 4_200 }],
    ['a render count on another phase', { ...overflowReductionTiming, phase: 'coherence' }],
  ])('rejects a preparation phase timing with %s', (_case, value) => {
    const writeEvent = vi.fn()

    const result = recordPrivacySafeAnalytics({ value, writeEvent })

    expect(result).toEqual({ ok: false })
    expect(writeEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['2026-10-12T01:00:00Z', 'peak'],
    ['2026-10-13T03:59:59Z', 'peak'],
    ['2026-10-14T04:00:00Z', 'off-peak'],
    ['2026-10-15T05:59:59Z', 'off-peak'],
    ['2026-10-16T06:00:00Z', 'peak'],
    ['2026-10-16T09:59:59Z', 'peak'],
    ['2026-10-16T10:00:00Z', 'off-peak'],
    ['2026-10-12T00:59:59Z', 'off-peak'],
    ['2026-10-17T07:00:00Z', 'off-peak'],
    ['2026-10-18T02:00:00Z', 'off-peak'],
  ])('marks a timing recorded at %s as DeepSeek %s', (recordedAt, window) => {
    const metric = createPrivacySafeAggregateMetric(overflowReductionTiming, { recordedAt: Date.parse(recordedAt) })

    expect(metric).toEqual({
      category: 'privacy-safe-mvp-analytics',
      metric: 'preparation-phase-timed',
      value: 1,
      dimensions: { preparationId: overflowReductionTiming.preparationId, phase: 'overflow-reduction',
        durationMilliseconds: 4_200, renderCount: 3, deepSeekWindow: window },
    })
  })
})

const overflowReductionTiming = {
  name: 'preparation-phase-timed',
  preparationId: '3f0c9a52-7d1e-4b8a-9c3e-5a6b7c8d9e0f',
  phase: 'overflow-reduction',
  durationMilliseconds: 4_200,
  renderCount: 3,
} as const
