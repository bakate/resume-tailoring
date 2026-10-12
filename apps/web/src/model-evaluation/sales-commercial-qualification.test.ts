import { describe, expect, it } from 'vitest'

import { salesCommercialQualificationCorpus } from './sales-commercial-corpus'
import {
  crossSegmentQualificationThresholds,
  qualifyCrossSegmentCorpus,
} from './cross-segment-qualification'

describe('sales and commercial qualification corpus', () => {
  it('contains twenty reviewed French and English commercial scenarios', () => {
    const { fixtures } = salesCommercialQualificationCorpus

    const composition = { roleFamilies: new Set(fixtures.map(({ roleFamily }) => roleFamily)), ids: fixtures.map(({ id }) => id),
      french: fixtures.filter(({ jobPosting }) => jobPosting.includes('[FR]')),
      english: fixtures.filter(({ jobPosting }) => jobPosting.includes('[EN]')) }

    expect(fixtures).toHaveLength(20)
    expect(composition.roleFamilies).toEqual(new Set(['sales']))
    expect(composition.ids).toEqual([
      'sales-01', 'sales-02', 'sales-03', 'sales-04', 'sales-05',
      'sales-06', 'sales-07', 'sales-08', 'sales-09', 'sales-10',
      'sales-11', 'sales-12', 'sales-13', 'sales-14', 'sales-15',
      'sales-16', 'sales-17', 'sales-18', 'sales-19', 'sales-20',
    ])
    expect(composition.french).toHaveLength(10)
    expect(composition.english).toHaveLength(10)
  })

  it('qualifies sales extraction, matching, evidence, score, provenance, and export independently', () => {
    const report = qualifyCrossSegmentCorpus({
      corpus: salesCommercialQualificationCorpus,
      split: 'development',
      thresholds: crossSegmentQualificationThresholds,
    })

    expect(report).toMatchObject({
      corpusId: 'sales-commercial-qualification-v1',
      heldOutFixtureCount: 6,
      passed: true,
      split: 'development',
    })
    expect(report.overall).toEqual({
      extractionPrecision: { passed: true, threshold: 0.95, value: 1 },
      extractionRecall: { passed: true, threshold: 0.95, value: 1 },
      matchEvidencePrecision: { passed: true, threshold: 0.98, value: 1 },
      meanMatchScoreError: { passed: true, threshold: 5, value: 0 },
      maximumMatchScoreError: { passed: true, threshold: 10, value: 0 },
      validEvidenceRecall: { passed: true, threshold: 0.9, value: 1 },
    })
  })

  it('keeps the held-out sales scenarios out of the development report', () => {
    const report = qualifyCrossSegmentCorpus({
      corpus: salesCommercialQualificationCorpus,
      split: 'held-out',
    })

    expect(report.passed).toBe(true)
    expect(report.heldOutFixtureCount).toBe(6)
    expect(report.overall.extractionRecall.value).toBe(1)
  })
})
