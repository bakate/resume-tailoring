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
      provenanceSafety: { passed: true, threshold: 1, value: 1 },
      pdfExportValidity: { passed: true, threshold: 1, value: 1 },
    }))
  })

  it('reports a failed gate in every affected scope', () => {
    const report = qualifyCrossSegmentCorpus({
      corpus: crossSegmentQualificationCorpus,
      split: 'held-out',
      thresholds: { ...crossSegmentQualificationThresholds, provenanceSafety: 1.1 },
    })

    expect(report.passed).toBe(false)
    expect(report.overall.provenanceSafety.passed).toBe(false)
    expect(Object.values(report.roleFamilies).every(({ provenanceSafety }) => !provenanceSafety.passed)).toBe(true)
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
