import { describe, expect, it } from 'vitest'

import {
  matchBandThresholds,
  readMatchBand,
} from '@resume-tailoring/matching-engine'
import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import { calibrateMatchBands } from './match-band-calibration'

describe('Match Band calibration', () => {
  it('calibrates boundaries from development anchors and verifies held-out anchors', () => {
    const developmentObservations = createObservations({ split: 'development' })
    const heldOutObservations = createObservations({ split: 'held-out' })
    const calibration = calibrateMatchBands({ observations: developmentObservations })

    expect(calibration.thresholds).toEqual(matchBandThresholds)
    expect(readObservedBands({ observations: developmentObservations })).toEqual(
      developmentObservations.map(({ score, band }) => ({ band, score: readMatchBand({ matchScore: score }) })),
    )
    expect(readObservedBands({ observations: heldOutObservations })).toEqual(
      heldOutObservations.map(({ score, band }) => ({ band, score: readMatchBand({ matchScore: score }) })),
    )
  })
})

function createObservations({ split }: Readonly<{ split: 'development' | 'held-out' }>) {
  return crossSegmentQualificationCorpus.fixtures
    .filter((fixture) => fixture.split === split)
    .map(({ expectedMatchScoreRange }) => {
      const score = expectedMatchScoreRange.minimum
      return { band: readExpectedBand({ score }), score } as const
    })
}

function readExpectedBand({ score }: Readonly<{ score: number }>) {
  if (score === 0) return 'ambitious' as const
  if (score === 50) return 'credible' as const
  return 'strong' as const
}

function readObservedBands({
  observations,
}: Readonly<{
  observations: readonly Readonly<{ band: ReturnType<typeof readExpectedBand>; score: number }>[]
}>) {
  return observations.map(({ band, score }) => ({ band, score: readMatchBand({ matchScore: score }) }))
}
