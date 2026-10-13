import { conformanceRetryNames, type ModelCallMeasurement, type ModelConnection } from '../adapters/server/language-model-request'
import type { LanguageModelConfiguration, ModelRole } from '../language-model-configuration'
import {
  qualifyModelConfiguration,
  type ModelConfiguration,
  type ModelEvaluationObservation,
  type ModelEvaluationThresholds,
  type ModelQualificationReport,
  type ModelTokenUsage,
  type RecordedModelEvaluationRun,
} from './model-qualification'

/**
 * A live evaluation that measures a model role: it runs the production operation adapters on the connections it is
 * given and states what it checked. The runner adds every call's latency and usage, so a source never reads a
 * provider's answer format.
 */
export type ModelObservationSource = Readonly<{
  id: string
  roles: readonly ModelRole[]
  observe: (context: ModelObservationContext) => Promise<readonly ModelEvaluationObservation[]>
}>

export type ModelObservationContext = Readonly<{
  /** The connection a role's operations use: the configuration under test for its role, its companion otherwise. */
  connect: (role: ModelRole) => ModelConnection
  role: ModelRole
  /** Connections that also add up the tokens each role spends through them, such as on one whole Tailored Resume. */
  trackUsage: () => ModelUsageTracker
}>

export type ModelUsageTracker = Readonly<{
  connect: (role: ModelRole) => ModelConnection
  readUsage: () => Readonly<Record<ModelRole, ModelTokenUsage>>
}>

/** A Qualified Model Configuration candidate, and the same provider's configuration for the other role. */
export type QualificationCandidate = Readonly<{
  configuration: ModelConfiguration
  companion?: ModelConfiguration
}>

/**
 * Runs every source that measures the candidate's role and qualifies the candidate on what they observed. The runner
 * names no provider: the connection carries the configuration, and the call wrapper finds its provider.
 */
export async function runModelQualification({
  apiKey, candidate, datasetId, now = () => new Date(), providers, sources, thresholds,
}: Readonly<{
  apiKey: ModelConnection['apiKey']
  candidate: QualificationCandidate
  datasetId: string
  now?: () => Date
  providers?: ModelConnection['providers']
  sources: readonly ModelObservationSource[]
  thresholds: ModelEvaluationThresholds
}>): Promise<Readonly<{ recordedRun: RecordedModelEvaluationRun; report: ModelQualificationReport }>> {
  const { configuration, companion } = candidate
  assertCompanion({ candidate })
  const observations: ModelEvaluationObservation[] = []
  for (const source of sources.filter(({ roles }) => roles.includes(configuration.role))) {
    observations.push(...await observeSource({ apiKey, candidate, source, ...(providers === undefined ? {} : { providers }) }))
  }
  const recordedRun = { ...(companion === undefined ? {} : { companion }), configuration, datasetId, observations,
    recordedAt: now().toISOString() }
  return { recordedRun, report: qualifyModelConfiguration({ recordedRun, thresholds }) }
}

/**
 * Runs one source for the candidate's role: what the source checked, then one observation per call the configuration
 * under test made. A live evaluation test runs its source through here too, so it asserts what the recording counts.
 */
export async function observeSource({ apiKey, candidate: { companion, configuration }, providers, source }: Readonly<{
  apiKey: ModelConnection['apiKey']
  candidate: Readonly<{ configuration: LanguageModelConfiguration; companion?: LanguageModelConfiguration }>
  providers?: ModelConnection['providers']
  source: ModelObservationSource
}>): Promise<readonly ModelEvaluationObservation[]> {
  const calls: ModelCallMeasurement[] = []
  const connectObserved = ({ observeCall, role }: Readonly<{
    observeCall?: (measurement: ModelCallMeasurement) => void
    role: ModelRole
  }>): ModelConnection => ({
    apiKey, configuration: readRoleConfiguration({ companion, configuration, role }),
    observeCall: (measurement) => { calls.push(measurement); observeCall?.(measurement) },
    ...(providers === undefined ? {} : { providers }),
  })
  const trackUsage = (): ModelUsageTracker => {
    const usage = { structured: { inputTokens: 0, outputTokens: 0 }, writing: { inputTokens: 0, outputTokens: 0 } }
    return {
      connect: (role) => connectObserved({ role, observeCall: ({ configuration: { role: callRole }, usage: callUsage }) => {
        usage[callRole] = { inputTokens: usage[callRole].inputTokens + (callUsage?.inputTokens ?? 0),
          outputTokens: usage[callRole].outputTokens + (callUsage?.outputTokens ?? 0) }
      } }),
      readUsage: () => ({ structured: usage.structured, writing: usage.writing }),
    }
  }
  const sourceObservations = await source.observe({ connect: (role) => connectObserved({ role }), role: configuration.role,
    trackUsage })
  return [...sourceObservations.map((observation) => ({ ...observation, fixtureId: `${source.id}:${observation.fixtureId}` })),
    ...readCallObservations({ calls: calls.filter((call) => call.configuration === configuration), sourceId: source.id })]
}

/**
 * The observations that record a failure: a check the source names as failed, or any provenance safety violation. A
 * live evaluation test expects none.
 */
export function readFailedObservations({ observations }: Readonly<{ observations: readonly ModelEvaluationObservation[] }>) {
  return observations.filter((observation) => observation.observedValues.some((value) => value.startsWith('failed:'))
    || observation.unsupportedResumeClaimCount + (observation.coveredTrapCount ?? 0) + (observation.obeyedInjectionCount ?? 0) > 0)
}

/** An observation that checks only what it names; every count it leaves out is zero. */
export function createModelEvaluationObservation(
  observation: Partial<ModelEvaluationObservation> & Pick<ModelEvaluationObservation, 'fixtureId'>,
): ModelEvaluationObservation {
  return {
    extractionExpectedCount: 0, extractionMatchedCount: 0, inputTokens: 0, latencyMilliseconds: 0,
    multilingualCheckCount: 0, multilingualPassedCount: 0, observedValues: [], outputTokens: 0,
    unsupportedResumeClaimCount: 0, ...observation,
  }
}

/**
 * The candidate for one role of a selection: that role's configuration under test, the other role's as its companion,
 * as a live evaluation runs the configurations the environment validates.
 */
export function readRoleCandidate({ configurations, role }: Readonly<{
  configurations: Readonly<Record<ModelRole, LanguageModelConfiguration>>
  role: ModelRole
}>) {
  return { configuration: configurations[role], companion: configurations[role === 'structured' ? 'writing' : 'structured'] }
}

function assertCompanion({ candidate: { companion, configuration } }: Readonly<{ candidate: QualificationCandidate }>) {
  if (companion === undefined) return
  // A companion of another provider would send Candidate content to a processor the Candidate never consented to.
  if (companion.provider !== configuration.provider) {
    throw new Error('The companion configuration must use the provider under qualification')
  }
  if (companion.role === configuration.role) throw new Error('The companion configuration must serve the other role')
}

function readRoleConfiguration({ companion, configuration, role }: Readonly<{
  companion?: LanguageModelConfiguration
  configuration: LanguageModelConfiguration
  role: ModelRole
}>) {
  if (role === configuration.role) return configuration
  if (companion === undefined) throw new Error(`This source needs a companion configuration for the ${role} role`)
  return companion
}

/**
 * One observation per call: its operation, latency and usage, whether it was answered and whether its first answer
 * needed a conformance retry, never what it carried.
 */
function readCallObservations({ calls, sourceId }: Readonly<{
  calls: readonly ModelCallMeasurement[]
  sourceId: string
}>) {
  return calls.map(({ conformance, latencyMilliseconds, operation, outcome, usage }, callIndex) => createModelEvaluationObservation({
    fixtureId: `${sourceId}:call-${String(callIndex + 1)}:${operation}`, latencyMilliseconds, operation,
    inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0,
    observedValues: [outcome, ...conformance === undefined ? [] : [conformanceRetryNames[conformance]]],
  }))
}
