import { describe, expect, it } from 'vitest'

import { renderResumeDocument } from '../adapters/server/resume-document-renderer'
import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import { qualifyCrossSegmentDocuments } from './cross-segment-document-qualification'
import { qualificationSplits } from './cross-segment-qualification'

describe('cross-segment document qualification with the production PDF renderer', () => {
  it.each(qualificationSplits)('exports a valid supported PDF for every %s scenario', async (split) => {
    const report = await qualifyCrossSegmentDocuments({ corpus: crossSegmentQualificationCorpus, renderDocument: renderResumeDocument, split })

    console.info(JSON.stringify({ split, overall: report.overall, roleFamilies: report.roleFamilies,
      scenarios: report.outcomes.length, pageCounts: countBy(report.outcomes.map(({ pageCount }) => String(pageCount))),
      purposes: countBy(report.outcomes.map(({ purpose }) => purpose)),
      languages: countBy(report.outcomes.map(({ language }) => language)),
      failures: report.outcomes.filter(({ exportBlockers, unsupportedFieldIds }) => exportBlockers.length > 0 || unsupportedFieldIds.length > 0) }))
    expect(report.outcomes.filter(({ exportBlockers }) => exportBlockers.length > 0)).toEqual([])
    expect(report.outcomes.filter(({ unsupportedFieldIds }) => unsupportedFieldIds.length > 0)).toEqual([])
    expect(report.passed).toBe(true)
  }, 600_000)
})

function countBy(values: readonly string[]) {
  return values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})
}
