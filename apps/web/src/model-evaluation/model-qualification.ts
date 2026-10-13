import { conformanceRetryNames } from '../adapters/server/language-model-request'
import {
  readModelOperationSettings,
  type LanguageModelConfiguration,
  type ModelOperation,
  type ModelRole,
} from '../language-model-configuration'

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
  /**
   * What the source checked; a model call's outcome, followed by `conformance-retry` or `conformance-retry-skipped`
   * when its first answer did not conform.
   */
  observedValues: readonly string[]
  /** The operation of a model call; absent on what a source checked. */
  operation?: ModelOperation
  outputTokens: number
  /** The tokens each role spent on one whole Tailored Resume: intake, Job Match and section-by-section preparation. */
  tailoredResumeUsage?: Readonly<Record<ModelRole, ModelTokenUsage>>
  unsupportedResumeClaimCount: number
}>

/** What one recording observed for a configuration; the companion is kept for its rates. */
export type RecordedModelEvaluationRun = Readonly<{
  /** The same provider's configuration for the other role, whose rates price its share of a Tailored Resume. */
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  datasetId: string
  observations: readonly ModelEvaluationObservation[]
  recordedAt: string
}>

/** A gate without a threshold is not calibrated yet, and never passes. */
export type ModelEvaluationThresholds = Readonly<{
  costUsd?: number
  extractionRecall?: number
  multilingualFidelity?: number
  /**
   * One ceiling for every latency observed, or `operation-deadline`: each operation's p95 within that operation's own
   * qualified deadline, the calls of the configuration under test alone.
   */
  p95LatencyMilliseconds?: number | 'operation-deadline'
}>

export type CalibratedGate = Readonly<{ passed: boolean; threshold: number; value: number }>
type UncalibratedGate = Readonly<{
  passed: false
  status: 'not-calibrated'
  value: number
}>
/** A gate nothing observed: it cannot fail, so it never passes. */
type UnmeasuredGate = Readonly<{ passed: false; status: 'not-measured' }>
type Gate = CalibratedGate | UncalibratedGate | UnmeasuredGate
/** Every operation's p95 within its own deadline; the operations report holds each p95 and deadline. */
type OperationDeadlineGate = Readonly<{
  passed: boolean
  threshold: 'operation-deadline'
  exceededOperations: readonly ModelOperation[]
}>

/** One operation's calls by the configuration under test, reported beside the gates. */
export type ModelOperationReport = Readonly<{
  callCount: number
  conformanceRetryCount: number
  conformanceRetrySkippedCount: number
  /** The share of calls whose first answer did not conform, retried or not. */
  conformanceRetryRate: number
  deadlineMilliseconds: number
  p95LatencyMilliseconds: number
}>

export type ModelQualificationReport = Readonly<{
  configuration: ModelConfiguration
  /**
   * The most expensive Tailored Resume at each of the configuration's price conditions, such as peak and off-peak,
   * reported beside the cost gate, which reads the upper-bound rates alone. Empty without a Tailored Resume priced.
   */
  costUsdByPriceCondition: Readonly<Record<string, number>>
  datasetId: string
  gates: Readonly<{
    /** The most expensive Tailored Resume observed. */
    costUsd: Gate
    extractionRecall: CalibratedGate | UncalibratedGate
    multilingualFidelity: Gate
    p95LatencyMilliseconds: CalibratedGate | UncalibratedGate | OperationDeadlineGate | UnmeasuredGate
    provenanceSafety: Readonly<{
      passed: boolean
      coveredTrapCount: number
      obeyedInjectionCount: number
      unsupportedResumeClaimCount: number
    }>
  }>
  observations: readonly ModelEvaluationObservation[]
  operations: Readonly<Partial<Record<ModelOperation, ModelOperationReport>>>
  qualified: boolean
}>

/** Qualifies a recorded run against thresholds: each gate passes on its own, and the configuration only if all do. */
export function qualifyModelConfiguration({ recordedRun, thresholds }: Readonly<{
  recordedRun: RecordedModelEvaluationRun
  thresholds: ModelEvaluationThresholds
}>): ModelQualificationReport {
  const { companion, configuration, datasetId, observations } = recordedRun
  const operations = readOperationReports({ configuration, observations })
  const gates = {
    provenanceSafety: createProvenanceSafetyGate({ observations }),
    extractionRecall: createMinimumGate({ threshold: thresholds.extractionRecall, value: calculateObservationRatio({
      observations, matchedProperty: 'extractionMatchedCount', totalProperty: 'extractionExpectedCount' }) }),
    multilingualFidelity: createMultilingualFidelityGate({ observations, threshold: thresholds.multilingualFidelity }),
    costUsd: createCostGate({ companion, configuration, observations, threshold: thresholds.costUsd }),
    p95LatencyMilliseconds: thresholds.p95LatencyMilliseconds === 'operation-deadline'
      ? createOperationDeadlineGate({ operations })
      : createMaximumGate({ threshold: thresholds.p95LatencyMilliseconds,
        value: calculateP95({ values: observations.map(({ latencyMilliseconds }) => latencyMilliseconds) }) }),
  }
  return {
    configuration,
    costUsdByPriceCondition: readCostByPriceCondition({ companion, configuration, observations }),
    datasetId,
    gates,
    observations,
    operations,
    qualified: Object.values(gates).every(({ passed }) => passed),
  }
}

function readCostByPriceCondition({ companion, configuration, observations }: Readonly<{
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
}>) {
  return Object.fromEntries(configuration.pricing.flatMap(({ condition }) => {
    const cost = calculateTailoredResumeCost({ companion, configuration, observations, readPrice: (rated) =>
      rated.pricing.find((price) => price.condition === condition) ?? readUpperBoundPrice(rated) })
    return cost === undefined ? [] : [[condition, cost]]
  }))
}

function createOperationDeadlineGate({ operations }: Readonly<{
  operations: Readonly<Partial<Record<ModelOperation, ModelOperationReport>>>
}>): OperationDeadlineGate | UnmeasuredGate {
  const reports = Object.entries(operations) as [ModelOperation, ModelOperationReport][]
  if (reports.length === 0) return unmeasuredGate
  const exceededOperations = reports
    .filter(([, { deadlineMilliseconds, p95LatencyMilliseconds }]) => p95LatencyMilliseconds > deadlineMilliseconds)
    .map(([operation]) => operation)
  return { passed: exceededOperations.length === 0, threshold: 'operation-deadline', exceededOperations }
}

function readOperationReports({ configuration, observations }: Readonly<{
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
}>) {
  const callsByOperation = new Map<ModelOperation, ModelEvaluationObservation[]>()
  for (const observation of observations) {
    if (observation.operation === undefined) continue
    callsByOperation.set(observation.operation, [...callsByOperation.get(observation.operation) ?? [], observation])
  }
  return Object.fromEntries([...callsByOperation].sort(([left], [right]) => left.localeCompare(right))
    .map(([operation, calls]) => {
      const count = (value: string) => calls.filter(({ observedValues }) => observedValues.includes(value)).length
      const conformanceRetryCount = count(conformanceRetryNames.retried)
      const conformanceRetrySkippedCount = count(conformanceRetryNames['retry-skipped'])
      return [operation, {
        callCount: calls.length,
        conformanceRetryCount,
        conformanceRetrySkippedCount,
        conformanceRetryRate: calculateRatio({ matched: conformanceRetryCount + conformanceRetrySkippedCount, total: calls.length }),
        deadlineMilliseconds: readModelOperationSettings({ configuration, operation }).deadlineMilliseconds,
        p95LatencyMilliseconds: calculateP95({ values: calls.map(({ latencyMilliseconds }) => latencyMilliseconds) }),
      } satisfies ModelOperationReport]
    }))
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

function createCostGate({ companion, configuration, observations, threshold }: Readonly<{
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
  threshold?: number
}>): Gate {
  const value = calculateTailoredResumeCost({ companion, configuration, observations, readPrice: readUpperBoundPrice })
  if (value === undefined) return unmeasuredGate
  return createMaximumGate({ threshold, value })
}

/** The most expensive Tailored Resume observed, each role's tokens at the price read from its own configuration. */
function calculateTailoredResumeCost({ companion, configuration, observations, readPrice }: Readonly<{
  companion?: ModelConfiguration
  configuration: ModelConfiguration
  observations: readonly ModelEvaluationObservation[]
  readPrice: (configuration: ModelConfiguration) => ModelPrice
}>) {
  const costs = observations.flatMap(({ tailoredResumeUsage }) => {
    if (tailoredResumeUsage === undefined) return []
    const otherRole = configuration.role === 'structured' ? 'writing' : 'structured'
    const otherUsage = tailoredResumeUsage[otherRole]
    const otherCost = otherUsage.inputTokens + otherUsage.outputTokens === 0 ? 0
      : companion === undefined ? undefined : priceTokens({ price: readPrice(companion), usage: otherUsage })
    return otherCost === undefined ? [undefined]
      : [priceTokens({ price: readPrice(configuration), usage: tailoredResumeUsage[configuration.role] }) + otherCost]
  })
  if (costs.length === 0 || costs.includes(undefined)) return undefined
  return Number(Math.max(...costs.filter((cost) => cost !== undefined)).toFixed(8))
}

/** The highest input and the highest output rate, which may come from different conditions. */
function readUpperBoundPrice({ pricing }: ModelConfiguration): ModelPrice {
  return { condition: 'upper bound', inputUsdPerMillionTokens: Math.max(...pricing.map((price) => price.inputUsdPerMillionTokens)),
    outputUsdPerMillionTokens: Math.max(...pricing.map((price) => price.outputUsdPerMillionTokens)) }
}

function priceTokens({ price: { inputUsdPerMillionTokens, outputUsdPerMillionTokens }, usage }: Readonly<{
  price: ModelPrice
  usage: ModelTokenUsage
}>) {
  const cost = usage.inputTokens * inputUsdPerMillionTokens / 1_000_000 + usage.outputTokens * outputUsdPerMillionTokens / 1_000_000
  return Number(cost.toFixed(8))
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

function calculateP95({ values }: Readonly<{ values: readonly number[] }>) {
  if (values.length === 0) return 0
  const orderedValues = [...values].sort((leftValue, rightValue) => leftValue - rightValue)
  const percentileIndex = Math.ceil(orderedValues.length * 0.95) - 1
  return orderedValues[percentileIndex] ?? 0
}

function sum({ values }: Readonly<{ values: readonly number[] }>) {
  return values.reduce((total, value) => total + value, 0)
}
