import type { LanguageModelConfiguration } from '../language-model-configuration'
import { qualifyModelConfiguration } from './model-qualification'
import {
  structuredModelEvaluationBaseline,
  writingModelEvaluationBaseline,
} from './model-evaluation-baselines'
import {
  recordedStructuredModelEvaluation,
  recordedWritingModelEvaluation,
} from './recorded-model-evaluation-runs'

export const recordedModelQualificationReports = [
  qualifyRecordedConfiguration({
    baseline: structuredModelEvaluationBaseline,
    recordedEvaluation: recordedStructuredModelEvaluation,
  }),
  qualifyRecordedConfiguration({
    baseline: writingModelEvaluationBaseline,
    recordedEvaluation: recordedWritingModelEvaluation,
  }),
] as const

/** A configuration is qualified only as a whole: the same provider, model, role and every provider option. */
export function isQualifiedModelConfiguration({ configuration }: Readonly<{
  configuration: LanguageModelConfiguration
}>) {
  return recordedModelQualificationReports.some((report) => report.qualified
    // Only one provider exists yet; the comparison keeps a second one from reusing another provider's baseline.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    && report.configuration.provider === configuration.provider
    && report.configuration.role === configuration.role
    && report.configuration.model === configuration.model
    && hasSameProviderOptions({ qualified: report.configuration.providerOptions, requested: configuration.providerOptions }))
}

function hasSameProviderOptions({ qualified, requested }: Readonly<{
  qualified: LanguageModelConfiguration['providerOptions']
  requested: LanguageModelConfiguration['providerOptions']
}>) {
  const qualifiedEntries = Object.entries(qualified)
  return qualifiedEntries.length === Object.keys(requested).length
    && qualifiedEntries.every(([name, value]) => (requested as Readonly<Record<string, unknown>>)[name] === value)
}

function qualifyRecordedConfiguration({
  baseline,
  recordedEvaluation,
}: Readonly<{
  baseline: typeof structuredModelEvaluationBaseline | typeof writingModelEvaluationBaseline
  recordedEvaluation: typeof recordedStructuredModelEvaluation | typeof recordedWritingModelEvaluation
}>) {
  return qualifyModelConfiguration({
    baseline,
    configuration: recordedEvaluation.configuration,
    datasetId: recordedEvaluation.datasetId,
    observations: recordedEvaluation.observations,
  })
}
