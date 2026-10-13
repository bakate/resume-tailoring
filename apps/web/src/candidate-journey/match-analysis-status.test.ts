import { describe, expect, it } from 'vitest'

import { coverageTones, readCriticalReserveStatus } from './match-analysis-status'

describe('Match Analysis status', () => {
  it('gives each Requirement Coverage a distinct tone', () => {
    const tones = coverageTones

    expect(tones).toEqual({ covered: 'success', 'partially-covered': 'warning', uncovered: 'error' })
  })

  it('headlines a clear Critical Requirement Reserve as covered', () => {
    const status = readCriticalReserveStatus({ status: 'clear' })

    expect(status)
      .toEqual({ tone: 'success', headingKey: 'jobMatch.criticalReserve.heading.clear', messageKey: 'jobMatch.criticalReserve.clear' })
  })

  it('headlines a present Critical Requirement Reserve as not fully covered', () => {
    const status = readCriticalReserveStatus({ status: 'present' })

    expect(status)
      .toEqual({ tone: 'warning', headingKey: 'jobMatch.criticalReserve.heading.present', messageKey: 'jobMatch.criticalReserve.present' })
  })
})
