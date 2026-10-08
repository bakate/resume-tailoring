import type { ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'

type ResumeLayout = ResumeRenderResult['assessment']['layout']
/** How much Hidden Content Overflow Reduction produced, achievements apart. */
export type OverflowReductionCounts = Readonly<{ achievements: number; other: number }>

export type PageBudgetStatus = Readonly<
  | { tone: 'success'; message: Readonly<{ kind: 'fits'; pageCount: 1 | 2 }>; action: null }
  | { tone: 'success'; message: Readonly<{ kind: 'reduced'; pageCount: 1 | 2 } & OverflowReductionCounts>; action: 'review-hidden' }
  | { tone: 'error'; message: Readonly<{ kind: 'overflow'; pageCount: number }>; action: 'shorten' }
>

/**
 * The one Page Budget status of a measured layout: the page count it fits, with what Overflow Reduction hid to get
 * there, or the overflow that blocks the download and the shortening that unblocks it.
 */
export function readPageBudgetStatus({ layout, overflowReduction }: Readonly<{
  layout: ResumeLayout; overflowReduction: OverflowReductionCounts
}>): PageBudgetStatus | null {
  if (layout.status === 'overflow') return { tone: 'error', message: { kind: 'overflow', pageCount: layout.pageCount }, action: 'shorten' }
  if (layout.status !== 'fits') return null
  const { pageCount } = layout
  if (overflowReduction.achievements + overflowReduction.other === 0) {
    return { tone: 'success', message: { kind: 'fits', pageCount }, action: null }
  }
  return { tone: 'success', message: { kind: 'reduced', pageCount, ...overflowReduction }, action: 'review-hidden' }
}

/** The sentence for a layout that fits, by its page count. */
export const fitsKeys = { 1: 'pageBudget.fitsOne', 2: 'pageBudget.fitsTwo' } as const
