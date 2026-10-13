import type { ModelConnection } from '../adapters/server/language-model-request'
import { languageModelApiKeyVariables } from '../language-model-configuration'
import { modelConfigurationCandidates } from './model-configurations'
import { liveModelEvaluationDatasetId, liveModelEvaluationThresholds } from './model-evaluation-baselines'
import { liveModelObservationSources } from './live-model-observation-sources'
import {
  runModelQualification,
  type ModelObservationSource,
  type QualificationCandidate,
} from './model-qualification-runner'
import type { ModelQualificationReport, RecordedModelEvaluationRun } from './model-qualification'

/**
 * Runs every live source for one declared candidate, with the key its provider reads from the local environment. The
 * key only signs calls: neither the recorded run nor the report holds it.
 */
export async function recordModelQualification({
  apiKeyVariables = languageModelApiKeyVariables, candidateId, candidates = modelConfigurationCandidates, environment,
  providers, sources = liveModelObservationSources,
}: Readonly<{
  apiKeyVariables?: Readonly<Record<string, string>>
  candidateId: string
  candidates?: Readonly<Record<string, QualificationCandidate>>
  environment: Readonly<Record<string, string | undefined>>
  providers?: ModelConnection['providers']
  sources?: readonly ModelObservationSource[]
}>) {
  const candidate = Object.hasOwn(candidates, candidateId) ? candidates[candidateId] : undefined
  if (candidate === undefined) {
    throw new Error(`Unknown candidate "${candidateId}"; record one of: ${Object.keys(candidates).join(', ')}`)
  }
  const { provider, role } = candidate.configuration
  const keyVariable = apiKeyVariables[provider] ?? ''
  const key = environment[keyVariable]?.trim() ?? ''
  if (key === '') throw new Error(`${keyVariable || 'A provider key'} must be set to record "${candidateId}"`)
  return runModelQualification({ apiKey: { value: key }, candidate, datasetId: liveModelEvaluationDatasetId, sources,
    thresholds: liveModelEvaluationThresholds[role], ...(providers === undefined ? {} : { providers }) })
}

/** The recorded runs with this one in place of any earlier run of the very same configuration. */
export function mergeRecordedRuns({ recordedRun, runs }: Readonly<{
  recordedRun: RecordedModelEvaluationRun
  runs: readonly RecordedModelEvaluationRun[]
}>) {
  const identity = readConfigurationIdentity(recordedRun)
  return [...runs.filter((run) => readConfigurationIdentity(run) !== identity), recordedRun]
}

export function renderRecordedRunsModule({ runs }: Readonly<{ runs: readonly RecordedModelEvaluationRun[] }>) {
  return [
    "import type { RecordedModelEvaluationRun } from './model-qualification'",
    '',
    '// Written by `pnpm test:evaluation:record <candidate>`: one run per Qualified Model Configuration candidate.',
    `export const recordedLiveModelEvaluationRuns: readonly RecordedModelEvaluationRun[] = ${JSON.stringify(runs, null, 2)}`,
    '',
  ].join('\n')
}

/**
 * The JSON report a recording writes: the configuration, its gates and verdict, then what is reported beside them: the
 * cost at each price condition and each operation's calls. Its observations stay in the recorded runs alone, which
 * `recordedAt` points to.
 */
export function renderQualificationReport({ recordedRun, report }: Readonly<{
  recordedRun: RecordedModelEvaluationRun
  report: ModelQualificationReport
}>) {
  const { configuration, costUsdByPriceCondition, datasetId, gates, operations, qualified } = report
  return `${JSON.stringify({ configuration, datasetId, recordedAt: recordedRun.recordedAt, gates, qualified,
    costUsdByPriceCondition, operations }, null, 2)}\n`
}

/** Every setting but the prices, which weigh the evaluated cost and are no setting of the configuration. */
// A configuration is the same whatever order its fields were written in, so its identity sorts them at every level.
function readConfigurationIdentity({ configuration }: RecordedModelEvaluationRun) {
  return JSON.stringify(sortFields(Object.fromEntries(Object.entries(configuration).filter(([name]) => name !== 'pricing'))))
}

function sortFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortFields)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([name, field]) => [name, sortFields(field)]))
}
