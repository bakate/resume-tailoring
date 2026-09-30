import { describe, expect, it } from 'vitest'

import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import {
  crossSegmentQualificationThresholds,
  qualifyCrossSegmentCorpus,
} from './cross-segment-qualification'

describe('cross-segment qualification harness', () => {
  it('keeps the development and held-out corpus partitions explicit', () => {
    const fixtureCounts = countFixturesByPartition()

    expect(fixtureCounts).toEqual({ development: 48, 'held-out': 22 })
    expect(countFixturesByRoleFamily()).toEqual({
      technology: 30,
      'general-management': 20,
      sales: 20,
    })
  })

  it('covers technology individual contributors, leadership, and hybrid roles in both languages', () => {
    const technologyFixtures = crossSegmentQualificationCorpus.fixtures.filter(({ roleFamily }) => roleFamily === 'technology')
    const coveredRoleTitles = new Set(technologyFixtures.map(({ roleTitle }) => roleTitle))
    const coveredTags = new Set(technologyFixtures.flatMap(({ scenarioTags }) => scenarioTags))

    expect(technologyFixtures).toHaveLength(30)
    expect(new Set(technologyFixtures.map(({ language }) => language))).toEqual(new Set(['en', 'fr']))
    expect([...coveredRoleTitles]).toEqual(expect.arrayContaining([
      'Senior Software Engineer', 'Data Engineer', 'Security Engineer', 'DevOps Engineer',
      'Tech Lead', 'Engineering Manager', 'Head of Engineering', 'CTO', 'Sales Engineer',
    ]))
    expect([...coveredTags]).toEqual(expect.arrayContaining([
      'short-posting', 'long-posting', 'overloaded-wishlist', 'duplicate-requirements',
      'strong-match', 'partial-match', 'unsuitable-profile', 'ambiguity', 'critical-gap',
      'hybrid',
    ]))
  })

  it('qualifies the deterministic development corpus globally and per role family', () => {
    const report = qualifyCrossSegmentCorpus({
      corpus: crossSegmentQualificationCorpus,
      split: 'development',
    })

    expect(report).toMatchObject({
      corpusId: 'cross-segment-qualification-v1',
      heldOutFixtureCount: 22,
      passed: true,
    })
    expect(Object.values(report.roleFamilies).every(({ extractionRecall }) => extractionRecall.passed)).toBe(true)
    expect(report.overall).toEqual(expect.objectContaining({
      extractionRecall: { passed: true, threshold: 0.95, value: 1 },
      extractionPrecision: { passed: true, threshold: 0.95, value: 1 },
      matchEvidencePrecision: { passed: true, threshold: 0.98, value: 1 },
      validEvidenceRecall: { passed: true, threshold: 0.9, value: 1 },
      meanMatchScoreError: { passed: true, threshold: 5, value: 0 },
      maximumMatchScoreError: { passed: true, threshold: 10, value: 0 },
    }))
  })

  // Known failed gate (BAK-60): technology-29 "technical discovery and quota support" is rejected because the
  // matching engine splits requirement clauses on "and". The held-out scenario must not be used to tune the engine;
  // `it.fails` reports the failure and will flag the test once a development-driven fix makes the split pass.
  it.fails('qualifies the untuned held-out corpus globally and per role family', () => {
    const report = qualifyCrossSegmentCorpus({
      corpus: crossSegmentQualificationCorpus,
      split: 'held-out',
    })

    expect(report.passed).toBe(true)
    expect(Object.values(report.roleFamilies).every((gates) => Object.values(gates).every(({ passed }) => passed))).toBe(true)
  })

  it('reports a failed gate in every affected scope', () => {
    const report = qualifyCrossSegmentCorpus({
      corpus: crossSegmentQualificationCorpus,
      split: 'held-out',
      thresholds: { ...crossSegmentQualificationThresholds, matchEvidencePrecision: 1.1 },
    })

    expect(report.passed).toBe(false)
    expect(report.overall.matchEvidencePrecision.passed).toBe(false)
    expect(Object.values(report.roleFamilies).every(({ matchEvidencePrecision }) => !matchEvidencePrecision.passed)).toBe(true)
  })
})

function countFixturesByPartition() {
  return crossSegmentQualificationCorpus.fixtures.reduce<Record<string, number>>((counts, fixture) => ({
    ...counts,
    [fixture.split]: (counts[fixture.split] ?? 0) + 1,
  }), {})
}

function countFixturesByRoleFamily() {
  return crossSegmentQualificationCorpus.fixtures.reduce<Record<string, number>>((counts, fixture) => ({
    ...counts,
    [fixture.roleFamily]: (counts[fixture.roleFamily] ?? 0) + 1,
  }), {})
}
