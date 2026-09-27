import { describe, expect, it } from 'vitest'

import { referenceModelEvaluationDataset } from './reference-dataset'

describe('model evaluation reference dataset', () => {
  it('covers every structured and writing capability', () => {
    const capabilities = new Set(referenceModelEvaluationDataset.fixtures.map(({ capability }) =>
      capability))

    expect(capabilities).toEqual(new Set([
      'source-profile-extraction',
      'job-requirement-extraction',
      'matching',
      'validation',
      'translation',
      'resume-writing',
    ]))
  })

  it('attempts every prohibited strengthening dimension', () => {
    const strengtheningDimensions = new Set(referenceModelEvaluationDataset.fixtures
      .flatMap((fixture) => 'strengtheningDimension' in fixture
        ? [fixture.strengtheningDimension]
        : []))

    expect(strengtheningDimensions).toEqual(new Set([
      'seniority',
      'causality',
      'scope',
      'dates',
      'quantity',
      'outcome',
    ]))
  })

  it('uses stable unique fixture identifiers', () => {
    const fixtureIds = referenceModelEvaluationDataset.fixtures.map(({ id }) => id)

    expect(new Set(fixtureIds).size).toBe(fixtureIds.length)
    expect(referenceModelEvaluationDataset.id).toBe('resume-tailoring-reference-v1')
  })

  it('defines an explicit target locale for every writing fixture', () => {
    const writingLocales = referenceModelEvaluationDataset.fixtures.flatMap((fixture) =>
      'expectedLocale' in fixture ? [fixture.expectedLocale] : [])

    expect(writingLocales).toEqual(['fr', 'en'])
  })
})
