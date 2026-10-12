import type { ModelCallMeasurement, ModelConnection } from '../adapters/server/language-model-request'
import type { LanguageModelConfiguration, ModelRole } from '../language-model-configuration'
import {
  qualifyModelConfiguration,
  type ModelConfiguration,
  type ModelEvaluationObservation,
  type ModelEvaluationThresholds,
  type ModelQualificationReport,
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
}>

/** A Qualified Model Configuration candidate, and the same provider's configuration for the other role. */
export type QualificationCandidate = Readonly<{
  configuration: ModelConfiguration
  companion?: LanguageModelConfiguration
}>

export type RecordedModelEvaluationRun = Readonly<{
  configuration: ModelConfiguration
  datasetId: string
  observations: readonly ModelEvaluationObservation[]
  recordedAt: string
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
    const calls: ModelCallMeasurement[] = []
    const connect = (role: ModelRole): ModelConnection => ({
      apiKey, configuration: readRoleConfiguration({ companion, configuration, role }),
      observeCall: (measurement) => { calls.push(measurement) },
      ...(providers === undefined ? {} : { providers }),
    })
    const sourceObservations = await source.observe({ connect, role: configuration.role })
    observations.push(...sourceObservations.map((observation) => ({ ...observation,
      fixtureId: `${source.id}:${observation.fixtureId}` })))
    observations.push(...readCallObservations({ calls: calls.filter((call) => call.configuration === configuration),
      sourceId: source.id }))
  }
  const recordedRun = { configuration, datasetId, observations, recordedAt: now().toISOString() }
  return { recordedRun, report: qualifyModelConfiguration({ baseline: { ...recordedRun, thresholds }, configuration,
    datasetId, observations }) }
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

function assertCompanion({ candidate: { companion, configuration } }: Readonly<{ candidate: QualificationCandidate }>) {
  if (companion === undefined) return
  // Only one provider exists yet; the check keeps a second one from pairing with another provider's configuration.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (companion.provider !== configuration.provider) {
    throw new Error('The companion configuration must use the provider under qualification')
  }
  if (companion.role === configuration.role) throw new Error('The companion configuration must serve the other role')
}

function readRoleConfiguration({ companion, configuration, role }: Readonly<{
  companion?: LanguageModelConfiguration
  configuration: ModelConfiguration
  role: ModelRole
}>) {
  if (role === configuration.role) return configuration
  if (companion === undefined) throw new Error(`This source needs a companion configuration for the ${role} role`)
  return companion
}

/** One observation per call: its latency and usage, and whether it was answered, never what it carried. */
function readCallObservations({ calls, sourceId }: Readonly<{
  calls: readonly ModelCallMeasurement[]
  sourceId: string
}>) {
  return calls.map(({ latencyMilliseconds, operation, outcome, usage }, callIndex) => createModelEvaluationObservation({
    fixtureId: `${sourceId}:call-${String(callIndex + 1)}:${operation}`, latencyMilliseconds,
    inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0, observedValues: [outcome],
  }))
}
