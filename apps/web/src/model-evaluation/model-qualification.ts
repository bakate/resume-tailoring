import type { OpenAiReasoningEffort } from '../openai-model-configuration'

export type ModelRole = 'structured' | 'writing'

export type ModelConfiguration = Readonly<{
  model: string
  pricing: Readonly<{
    inputUsdPerMillionTokens: number
    outputUsdPerMillionTokens: number
  }>
  reasoningEffort: OpenAiReasoningEffort
  role: ModelRole
}>

export type ModelEvaluationObservation = Readonly<{
  extractionExpectedCount: number
  extractionMatchedCount: number
  fixtureId: string
  inputTokens: number
  latencyMilliseconds: number
  multilingualCheckCount: number
  multilingualPassedCount: number
  observedValues: readonly string[]
  outputTokens: number
  unsupportedResumeClaimCount: number
}>

export type ModelEvaluationBaseline = Readonly<{
  configuration: ModelConfiguration
  datasetId: string
  observations: readonly ModelEvaluationObservation[]
  recordedAt: string
  thresholds: Readonly<{
    costUsd: number
    extractionRecall: number
    multilingualFidelity: number
    p95LatencyMilliseconds: number
  }>
}>

export type CalibratedGate = Readonly<{ passed: boolean; threshold: number; value: number }>
type UncalibratedGate = Readonly<{
  passed: false
  status: 'not-calibrated'
  value: number
}>

export type ModelQualificationReport = Readonly<{
  configuration: ModelConfiguration
  datasetId: string
  gates: Readonly<{
    costUsd: CalibratedGate | UncalibratedGate
    extractionRecall: CalibratedGate | UncalibratedGate
    multilingualFidelity: CalibratedGate | UncalibratedGate
    p95LatencyMilliseconds: CalibratedGate | UncalibratedGate
    provenanceSafety: Readonly<{
      passed: boolean
      unsupportedResumeClaimCount: number
    }>
  }>
  observations: readonly ModelEvaluationObservation[]
  qualified: boolean
}>

export function qualifyModelConfiguration({
  baseline,
  configuration,
  datasetId,
  observations,
}: Readonly<{
  baseline?: ModelEvaluationBaseline
  configuration: ModelConfiguration
  datasetId: string
  observations: readonly ModelEvaluationObservation[]
}>): ModelQualificationReport {
  const evaluationValues = calculateEvaluationValues({ configuration, observations })
  const gates = createGates({ baseline, datasetId, evaluationValues })
  return {
    configuration,
    datasetId,
    gates,
    observations,
    qualified: Object.values(gates).every(({ passed }) => passed),
  }
}

function calculateEvaluationValues({
  configuration,
  observations,
}: Readonly<{
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
}>) {
  return {
    costUsd: calculateCostUsd({ configuration, observations }),
    ...calculateQualityValues({ observations }),
    p95LatencyMilliseconds: calculateObservationP95({ observations }),
    unsupportedResumeClaimCount: countUnsupportedResumeClaims({ observations }),
  }
}

function calculateQualityValues({
  observations,
}: Readonly<{ observations: readonly ModelEvaluationObservation[] }>) {
  return {
    extractionRecall: calculateObservationRatio({
      observations, matchedProperty: 'extractionMatchedCount', totalProperty: 'extractionExpectedCount',
    }),
    multilingualFidelity: calculateObservationRatio({
      observations, matchedProperty: 'multilingualPassedCount', totalProperty: 'multilingualCheckCount',
    }),
  }
}

function createGates({
  baseline,
  datasetId,
  evaluationValues,
}: Readonly<{
  baseline?: ModelEvaluationBaseline
  datasetId: string
  evaluationValues: ReturnType<typeof calculateEvaluationValues>
}>) {
  const thresholds = baseline !== undefined && hasRecordedBaseline({ baseline, datasetId })
    ? baseline.thresholds
    : undefined
  return {
    provenanceSafety: createProvenanceSafetyGate({ evaluationValues }),
    ...createNonSafetyGates({ evaluationValues, thresholds }),
  }
}

function createProvenanceSafetyGate({
  evaluationValues,
}: Readonly<{ evaluationValues: ReturnType<typeof calculateEvaluationValues> }>) {
  return {
    passed: evaluationValues.unsupportedResumeClaimCount === 0,
    unsupportedResumeClaimCount: evaluationValues.unsupportedResumeClaimCount,
  }
}

function createNonSafetyGates({ evaluationValues, thresholds }: Readonly<{
  evaluationValues: ReturnType<typeof calculateEvaluationValues>
  thresholds?: ModelEvaluationBaseline['thresholds']
}>) {
  return {
    extractionRecall: createMinimumGate({ threshold: thresholds?.extractionRecall, value: evaluationValues.extractionRecall }),
    multilingualFidelity: createMinimumGate({ threshold: thresholds?.multilingualFidelity, value: evaluationValues.multilingualFidelity }),
    costUsd: createMaximumGate({ threshold: thresholds?.costUsd, value: evaluationValues.costUsd }),
    p95LatencyMilliseconds: createMaximumGate({
      threshold: thresholds?.p95LatencyMilliseconds, value: evaluationValues.p95LatencyMilliseconds,
    }),
  }
}

function createMinimumGate({ threshold, value }: Readonly<{ threshold?: number; value: number }>) {
  if (threshold === undefined) return createUncalibratedGate({ value })
  return { passed: value >= threshold, threshold, value } as const
}

function createMaximumGate({ threshold, value }: Readonly<{ threshold?: number; value: number }>) {
  if (threshold === undefined) return createUncalibratedGate({ value })
  return { passed: value <= threshold, threshold, value } as const
}

function createUncalibratedGate({ value }: Readonly<{ value: number }>): UncalibratedGate {
  return { passed: false, status: 'not-calibrated', value }
}

function calculateCostUsd({
  configuration,
  observations,
}: Readonly<{
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
}>) {
  const inputTokens = sum({ values: observations.map(({ inputTokens }) => inputTokens) })
  const outputTokens = sum({ values: observations.map(({ outputTokens }) => outputTokens) })
  const cost = inputTokens * configuration.pricing.inputUsdPerMillionTokens / 1_000_000
    + outputTokens * configuration.pricing.outputUsdPerMillionTokens / 1_000_000
  return Number(cost.toFixed(8))
}

function calculateRatio({ matched, total }: Readonly<{ matched: number; total: number }>) {
  if (total === 0) return 1
  return Number((matched / total).toFixed(4))
}

function calculateObservationRatio({
  matchedProperty,
  observations,
  totalProperty,
}: Readonly<{
  matchedProperty: 'extractionMatchedCount' | 'multilingualPassedCount'
  observations: readonly ModelEvaluationObservation[]
  totalProperty: 'extractionExpectedCount' | 'multilingualCheckCount'
}>) {
  return calculateRatio({
    matched: sum({ values: observations.map((observation) => observation[matchedProperty]) }),
    total: sum({ values: observations.map((observation) => observation[totalProperty]) }),
  })
}

function hasRecordedBaseline({
  baseline,
  datasetId,
}: Readonly<{ baseline?: ModelEvaluationBaseline; datasetId: string }>) {
  return baseline?.datasetId === datasetId && baseline.observations.length > 0
}

function calculateObservationP95({
  observations,
}: Readonly<{ observations: readonly ModelEvaluationObservation[] }>) {
  return calculateP95({ values: observations.map(({ latencyMilliseconds }) => latencyMilliseconds) })
}

function countUnsupportedResumeClaims({
  observations,
}: Readonly<{ observations: readonly ModelEvaluationObservation[] }>) {
  return sum({
    values: observations.map(({ unsupportedResumeClaimCount }) => unsupportedResumeClaimCount),
  })
}

function calculateP95({ values }: Readonly<{ values: readonly number[] }>) {
  if (values.length === 0) return 0
  const orderedValues = [...values].sort((leftValue, rightValue) => leftValue - rightValue)
  const percentileIndex = Math.ceil(orderedValues.length * 0.95) - 1
  return orderedValues[percentileIndex] ?? 0
}

function sum({ values }: Readonly<{ values: readonly number[] }>) {
  return values.reduce((total, value) => total + value, 0)
}
