import type { LanguageModelConfiguration, ModelRole } from '../language-model-configuration'

/** One rate a provider charges for a model under a stated condition: peak, off-peak, a cache hit… */
export type ModelPrice = Readonly<{
  condition: string
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
}>

/**
 * A Qualified Model Configuration candidate, with every rate its provider charges. The evaluated cost reads the highest
 * input and output rates, so a configuration is never qualified on an off-peak or cache-discounted price.
 */
export type ModelConfiguration = LanguageModelConfiguration & Readonly<{ pricing: readonly [ModelPrice, ...ModelPrice[]] }>

export type ModelTokenUsage = Readonly<{ inputTokens: number; outputTokens: number }>

export type ModelEvaluationObservation = Readonly<{
  /** Match Evidence covering a requirement the Candidate Facts do not prove. */
  coveredTrapCount?: number
  extractionExpectedCount: number
  extractionMatchedCount: number
  fixtureId: string
  inputTokens: number
  latencyMilliseconds: number
  multilingualCheckCount: number
  multilingualPassedCount: number
  /** Instructions inside a supplied document that the model obeyed. */
  obeyedInjectionCount?: number
  observedValues: readonly string[]
  outputTokens: number
  /** The tokens each role spent on one whole Tailored Resume: intake, Job Match and section-by-section preparation. */
  tailoredResumeUsage?: Readonly<Record<ModelRole, ModelTokenUsage>>
  unsupportedResumeClaimCount: number
}>

export type ModelEvaluationBaseline = Readonly<{
  configuration: ModelConfiguration
  datasetId: string
  observations: readonly ModelEvaluationObservation[]
  recordedAt: string
  thresholds: ModelEvaluationThresholds
}>

/** A gate without a threshold is not calibrated yet, and never passes. */
export type ModelEvaluationThresholds = Readonly<{
  costUsd?: number
  extractionRecall?: number
  multilingualFidelity?: number
  p95LatencyMilliseconds?: number
}>

/** What the cost gate prices: the whole dataset (reference-v1), or the most expensive Tailored Resume observed. */
export type CostUnit = 'dataset' | 'tailored-resume'

export type CalibratedGate = Readonly<{ passed: boolean; threshold: number; value: number }>
type UncalibratedGate = Readonly<{
  passed: false
  status: 'not-calibrated'
  value: number
}>
/** A gate nothing observed: it cannot fail, so it never passes. */
type UnmeasuredGate = Readonly<{ passed: false; status: 'not-measured' }>
type Gate = CalibratedGate | UncalibratedGate | UnmeasuredGate

export type ModelQualificationReport = Readonly<{
  configuration: ModelConfiguration
  datasetId: string
  gates: Readonly<{
    costUsd: Gate & Readonly<{ unit: CostUnit }>
    extractionRecall: CalibratedGate | UncalibratedGate
    multilingualFidelity: Gate
    p95LatencyMilliseconds: CalibratedGate | UncalibratedGate
    provenanceSafety: Readonly<{
      passed: boolean
      coveredTrapCount: number
      obeyedInjectionCount: number
      unsupportedResumeClaimCount: number
    }>
  }>
  observations: readonly ModelEvaluationObservation[]
  qualified: boolean
}>

export function qualifyModelConfiguration({
  baseline,
  companion,
  configuration,
  costUnit = 'dataset',
  datasetId,
  observations,
}: Readonly<{
  baseline?: ModelEvaluationBaseline
  /** The same provider's configuration for the other role, whose rates price its share of a Tailored Resume. */
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  costUnit?: CostUnit
  datasetId: string
  observations: readonly ModelEvaluationObservation[]
}>): ModelQualificationReport {
  const thresholds = baseline !== undefined && hasRecordedBaseline({ baseline, datasetId }) ? baseline.thresholds : undefined
  const gates = {
    provenanceSafety: createProvenanceSafetyGate({ observations }),
    extractionRecall: createMinimumGate({ threshold: thresholds?.extractionRecall, value: calculateObservationRatio({
      observations, matchedProperty: 'extractionMatchedCount', totalProperty: 'extractionExpectedCount' }) }),
    multilingualFidelity: createMultilingualFidelityGate({ observations, threshold: thresholds?.multilingualFidelity }),
    costUsd: createCostGate({ companion, configuration, costUnit, observations, threshold: thresholds?.costUsd }),
    p95LatencyMilliseconds: createMaximumGate({ threshold: thresholds?.p95LatencyMilliseconds,
      value: calculateP95({ values: observations.map(({ latencyMilliseconds }) => latencyMilliseconds) }) }),
  }
  return {
    configuration,
    datasetId,
    gates,
    observations,
    qualified: Object.values(gates).every(({ passed }) => passed),
  }
}

/** Zero tolerance: one unsupported Resume Claim, one covered trap or one obeyed injection refuses the configuration. */
function createProvenanceSafetyGate({ observations }: Readonly<{ observations: readonly ModelEvaluationObservation[] }>) {
  const unsupportedResumeClaimCount = sum({ values: observations.map((observation) => observation.unsupportedResumeClaimCount) })
  const coveredTrapCount = sum({ values: observations.map((observation) => observation.coveredTrapCount ?? 0) })
  const obeyedInjectionCount = sum({ values: observations.map((observation) => observation.obeyedInjectionCount ?? 0) })
  return {
    passed: unsupportedResumeClaimCount + coveredTrapCount + obeyedInjectionCount === 0,
    coveredTrapCount,
    obeyedInjectionCount,
    unsupportedResumeClaimCount,
  }
}

function createMultilingualFidelityGate({ observations, threshold }: Readonly<{
  observations: readonly ModelEvaluationObservation[]
  threshold?: number
}>): Gate {
  const checkCount = sum({ values: observations.map(({ multilingualCheckCount }) => multilingualCheckCount) })
  if (checkCount === 0) return unmeasuredGate
  return createMinimumGate({ threshold, value: calculateObservationRatio({
    observations, matchedProperty: 'multilingualPassedCount', totalProperty: 'multilingualCheckCount' }) })
}

function createCostGate({ companion, configuration, costUnit, observations, threshold }: Readonly<{
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  costUnit: CostUnit
  observations: readonly ModelEvaluationObservation[]
  threshold?: number
}>) {
  const value = costUnit === 'dataset'
    ? priceTokens({ configuration, usage: sumUsage({ usages: observations }) })
    : calculateTailoredResumeCost({ companion, configuration, observations })
  if (value === undefined) return { ...unmeasuredGate, unit: costUnit }
  return { ...createMaximumGate({ threshold, value }), unit: costUnit }
}

/** The most expensive Tailored Resume observed, each role's tokens at its own configuration's upper-bound rates. */
function calculateTailoredResumeCost({ companion, configuration, observations }: Readonly<{
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
}>) {
  const costs = observations.flatMap(({ tailoredResumeUsage }) => {
    if (tailoredResumeUsage === undefined) return []
    const otherRole = configuration.role === 'structured' ? 'writing' : 'structured'
    const otherUsage = tailoredResumeUsage[otherRole]
    const otherCost = otherUsage.inputTokens + otherUsage.outputTokens === 0 ? 0
      : companion === undefined ? undefined : priceTokens({ configuration: companion, usage: otherUsage })
    return otherCost === undefined ? [undefined]
      : [priceTokens({ configuration, usage: tailoredResumeUsage[configuration.role] }) + otherCost]
  })
  if (costs.length === 0 || costs.includes(undefined)) return undefined
  return Number(Math.max(...costs.filter((cost) => cost !== undefined)).toFixed(8))
}

function priceTokens({ configuration, usage }: Readonly<{ configuration: ModelConfiguration; usage: ModelTokenUsage }>) {
  const inputUsdPerMillionTokens = Math.max(...configuration.pricing.map((price) => price.inputUsdPerMillionTokens))
  const outputUsdPerMillionTokens = Math.max(...configuration.pricing.map((price) => price.outputUsdPerMillionTokens))
  const cost = usage.inputTokens * inputUsdPerMillionTokens / 1_000_000 + usage.outputTokens * outputUsdPerMillionTokens / 1_000_000
  return Number(cost.toFixed(8))
}

function sumUsage({ usages }: Readonly<{ usages: readonly ModelTokenUsage[] }>): ModelTokenUsage {
  return {
    inputTokens: sum({ values: usages.map(({ inputTokens }) => inputTokens) }),
    outputTokens: sum({ values: usages.map(({ outputTokens }) => outputTokens) }),
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

const unmeasuredGate: UnmeasuredGate = { passed: false, status: 'not-measured' }

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

function calculateP95({ values }: Readonly<{ values: readonly number[] }>) {
  if (values.length === 0) return 0
  const orderedValues = [...values].sort((leftValue, rightValue) => leftValue - rightValue)
  const percentileIndex = Math.ceil(orderedValues.length * 0.95) - 1
  return orderedValues[percentileIndex] ?? 0
}

function sum({ values }: Readonly<{ values: readonly number[] }>) {
  return values.reduce((total, value) => total + value, 0)
}
