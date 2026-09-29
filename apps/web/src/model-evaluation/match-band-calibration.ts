import {
  matchBandThresholds,
  type MatchBand,
} from '@resume-tailoring/matching-engine'

export type MatchBandCalibrationObservation = Readonly<{
  band: MatchBand
  score: number
}>

export type MatchBandCalibration = Readonly<{
  thresholds: Readonly<{
    credibleMinimum: number
    strongMinimum: number
  }>
  observations: readonly MatchBandCalibrationObservation[]
}>

export function calibrateMatchBands({
  observations,
}: Readonly<{
  observations: readonly MatchBandCalibrationObservation[]
}>): MatchBandCalibration {
  const orderedObservations = [...observations].sort((leftObservation, rightObservation) =>
    leftObservation.score - rightObservation.score)
  const credibleScores = readScoresForBand({ band: 'credible', observations: orderedObservations })
  const strongScores = readScoresForBand({ band: 'strong', observations: orderedObservations })
  if (credibleScores.length === 0 || strongScores.length === 0) {
    return { observations: orderedObservations, thresholds: matchBandThresholds }
  }
  const highestCredibleScore = Math.max(...credibleScores)
  const lowestStrongScore = Math.min(...strongScores)
  return {
    observations: orderedObservations,
    thresholds: {
      credibleMinimum: Math.min(...credibleScores),
      strongMinimum: Math.ceil((highestCredibleScore + lowestStrongScore) / 2),
    },
  }
}

function readScoresForBand({
  band,
  observations,
}: Readonly<{
  band: MatchBand
  observations: readonly MatchBandCalibrationObservation[]
}>) {
  return observations
    .filter((observation) => observation.band === band)
    .map(({ score }) => score)
}
