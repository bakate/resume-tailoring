import { describe, expect, it } from 'vitest'

import { coverageTones, readCriticalReserveStatus } from './match-analysis-status'

describe('Match Analysis status', () => {
  it('gives each Requirement Coverage its own tone, so its icon differs from the others', () => {
    expect(coverageTones).toEqual({ covered: 'success', 'partially-covered': 'warning', uncovered: 'error' })
  })

  it('headlines a clear Critical Requirement Reserve as covered', () => {
    expect(readCriticalReserveStatus({ status: 'clear' }))
      .toEqual({ tone: 'success', headingKey: 'jobMatch.criticalReserve.heading.clear', messageKey: 'jobMatch.criticalReserve.clear' })
  })

  it('headlines a present Critical Requirement Reserve as not covered', () => {
    expect(readCriticalReserveStatus({ status: 'present' }))
      .toEqual({ tone: 'warning', headingKey: 'jobMatch.criticalReserve.heading.present', messageKey: 'jobMatch.criticalReserve.present' })
  })
})
