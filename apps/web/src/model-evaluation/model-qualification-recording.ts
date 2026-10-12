import type { ModelConnection } from '../adapters/server/language-model-request'
import { languageModelApiKeyVariables } from '../language-model-configuration'
import { modelConfigurationCandidates } from './model-configurations'
import { liveModelEvaluationDatasetId, liveModelEvaluationThresholds } from './model-evaluation-baselines'
import { liveModelObservationSources } from './live-model-observation-sources'
import {
  runModelQualification,
  type ModelObservationSource,
  type QualificationCandidate,
  type RecordedModelEvaluationRun,
} from './model-qualification-runner'

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
    "import type { RecordedModelEvaluationRun } from './model-qualification-runner'",
    '',
    '// Written by `pnpm test:evaluation:record <candidate>`: one run per Qualified Model Configuration candidate.',
    `export const recordedLiveModelEvaluationRuns: readonly RecordedModelEvaluationRun[] = ${JSON.stringify(runs, null, 2)}`,
    '',
  ].join('\n')
}

function readConfigurationIdentity({ configuration: { model, provider, providerOptions, role } }: RecordedModelEvaluationRun) {
  return JSON.stringify({ model, provider, providerOptions, role })
}
