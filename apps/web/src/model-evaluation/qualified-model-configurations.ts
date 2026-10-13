import type { LanguageModelConfiguration } from '../language-model-configuration'
import { liveModelEvaluationDatasetId, liveModelEvaluationThresholds } from './model-evaluation-baselines'
import {
  qualifyModelConfiguration,
  type ModelQualificationReport,
  type RecordedModelEvaluationRun,
} from './model-qualification'
import { recordedLiveModelEvaluationRuns } from './recorded-live-model-evaluation-runs'

export const recordedModelQualificationReports: readonly ModelQualificationReport[] =
  recordedLiveModelEvaluationRuns.map(qualifyLiveRun)

/** A configuration is qualified only as a whole: the same provider, model, role and every provider option. */
export function isQualifiedModelConfiguration({ configuration, reports = recordedModelQualificationReports }: Readonly<{
  configuration: LanguageModelConfiguration
  reports?: readonly ModelQualificationReport[]
}>) {
  return reports.some((report) => report.qualified
    // Only one provider exists yet; the comparison keeps a second one from reusing another provider's baseline.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    && report.configuration.provider === configuration.provider
    && report.configuration.role === configuration.role
    && report.configuration.model === configuration.model
    && hasSameValue({ qualified: report.configuration.providerOptions, requested: configuration.providerOptions }))
}

/** Options may nest, such as output token budgets per operation; every value, at any depth, must be the recorded one. */
function hasSameValue({ qualified, requested }: Readonly<{ qualified: unknown; requested: unknown }>): boolean {
  if (typeof qualified !== 'object' || qualified === null || typeof requested !== 'object' || requested === null) {
    return qualified === requested
  }
  const qualifiedEntries = Object.entries(qualified)
  return qualifiedEntries.length === Object.keys(requested).length
    && qualifiedEntries.every(([name, value]) => Object.hasOwn(requested, name)
      && hasSameValue({ qualified: value, requested: (requested as Readonly<Record<string, unknown>>)[name] }))
}

/** A run recorded on another dataset than the live one has no calibrated threshold, so it qualifies nothing. */
function qualifyLiveRun(recordedRun: RecordedModelEvaluationRun) {
  const thresholds = recordedRun.datasetId === liveModelEvaluationDatasetId
    ? liveModelEvaluationThresholds[recordedRun.configuration.role] : {}
  return qualifyModelConfiguration({ recordedRun, thresholds })
}
