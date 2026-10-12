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

/** A configuration is qualified only as a whole: the same provider, model, role, provider options and operation settings. */
export function isQualifiedModelConfiguration({ configuration, reports = recordedModelQualificationReports }: Readonly<{
  configuration: LanguageModelConfiguration
  reports?: readonly ModelQualificationReport[]
}>) {
  return reports.some((report) => report.qualified
    && isSameSetting({ qualified: readSettings(report.configuration), requested: readSettings(configuration) }))
}

/** Prices weigh the evaluated cost; they are no setting of the configuration. */
function readSettings(configuration: LanguageModelConfiguration) {
  return Object.fromEntries(Object.entries(configuration).filter(([name]) => name !== 'pricing'))
}

/** Settings may nest, such as budgets per operation; every value, at any depth, must be the recorded one. */
function isSameSetting({ qualified, requested }: Readonly<{ qualified: unknown; requested: unknown }>): boolean {
  if (typeof qualified !== 'object' || qualified === null || typeof requested !== 'object' || requested === null) {
    return qualified === requested
  }
  const qualifiedEntries = Object.entries(qualified)
  return qualifiedEntries.length === Object.keys(requested).length
    && qualifiedEntries.every(([name, value]) => Object.hasOwn(requested, name)
      && isSameSetting({ qualified: value, requested: (requested as Readonly<Record<string, unknown>>)[name] }))
}

/** A run recorded on another dataset than the live one has no calibrated threshold, so it qualifies nothing. */
function qualifyLiveRun(recordedRun: RecordedModelEvaluationRun) {
  const thresholds = recordedRun.datasetId === liveModelEvaluationDatasetId
    ? liveModelEvaluationThresholds[recordedRun.configuration.role] : {}
  return qualifyModelConfiguration({ recordedRun, thresholds })
}
