import type { ModelRole } from './model-qualification'
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

export function isQualifiedModelConfiguration({
  model,
  reasoningEffort,
  role,
}: Readonly<{
  model: string
  reasoningEffort: string
  role: ModelRole
}>) {
  return recordedModelQualificationReports.some((report) => report.qualified
    && report.configuration.role === role
    && report.configuration.model === model
    && report.configuration.reasoningEffort === reasoningEffort)
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
