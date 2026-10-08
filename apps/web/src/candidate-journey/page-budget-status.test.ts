import { describe, expect, it } from 'vitest'

import { readPageBudgetStatus } from './page-budget-status'

const nothingHidden = { achievements: 0, other: 0 }

describe('Page Budget status', () => {
  it.each([1, 2] as const)('says a resume without Hidden Content fits on %i page(s), with no action', (pageCount) => {
    expect(readPageBudgetStatus({ layout: { status: 'fits', revision: 'r', pageCount }, overflowReduction: nothingHidden }))
      .toEqual({ tone: 'success', message: { kind: 'fits', pageCount }, action: null })
  })

  it('names what Overflow Reduction hid for the measured page count, and offers to review it', () => {
    const overflowReduction = { achievements: 9, other: 0 }
    expect(readPageBudgetStatus({ layout: { status: 'fits', revision: 'r', pageCount: 1 }, overflowReduction }))
      .toEqual({ tone: 'success', message: { kind: 'reduced', pageCount: 1, ...overflowReduction }, action: 'review-hidden' })
  })

  it('reports an overflow alone, whatever was hidden, with shortening as its action', () => {
    expect(readPageBudgetStatus({ layout: { status: 'overflow', revision: 'r', pageCount: 3 },
      overflowReduction: { achievements: 2, other: 1 } }))
      .toEqual({ tone: 'error', message: { kind: 'overflow' }, action: 'shorten' })
  })

  it('reports nothing for a layout it could not measure', () => {
    expect(readPageBudgetStatus({ layout: { status: 'unavailable', revision: 'r' }, overflowReduction: nothingHidden })).toBeNull()
  })
})
