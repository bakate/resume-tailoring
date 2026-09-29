import { describe, expect, it } from 'vitest'

import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import {
  crossSegmentQualificationThresholds,
  qualifyCrossSegmentCorpus,
} from './cross-segment-qualification'

describe('general-management qualification corpus', () => {
  it('contains twenty reviewed French and English scenarios across the supported subdomains', () => {
    const fixtures = crossSegmentQualificationCorpus.fixtures.filter(({ roleFamily }) =>
      roleFamily === 'general-management')
    const scenarios = fixtures.flatMap(({ generalManagement }) => generalManagement === undefined ? [] : [generalManagement])

    expect(fixtures).toHaveLength(20)
    expect(new Set(scenarios.map(({ language }) => language))).toEqual(new Set(['en', 'fr']))
    expect(new Set(scenarios.map(({ domain }) => domain))).toEqual(new Set([
      'operations', 'finance', 'hr', 'program-leadership', 'cross-functional',
    ]))
    expect(scenarios.every(({ constraints }) => constraints.length > 0)).toBe(true)
    expect(scenarios.some(({ ambiguity }) => ambiguity !== 'none')).toBe(true)
    expect(scenarios.some(({ scenario }) => scenario === 'critical-gap')).toBe(true)
    expect(scenarios.some(({ scenario }) => scenario === 'partial-match')).toBe(true)
  })

  it.each(['development', 'held-out'] as const)('passes all independent gates for the %s split', (split) => {
    const report = qualifyCrossSegmentCorpus({
      corpus: {
        ...crossSegmentQualificationCorpus,
        fixtures: crossSegmentQualificationCorpus.fixtures.filter(({ roleFamily }) =>
          roleFamily === 'general-management'),
      },
      split,
      thresholds: crossSegmentQualificationThresholds,
    })

    expect(report.passed).toBe(true)
    expect(Object.values(report.overall).every(({ passed }) => passed)).toBe(true)
  })
})
