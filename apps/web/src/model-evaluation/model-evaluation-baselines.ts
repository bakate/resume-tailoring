import type { ModelEvaluationBaseline } from './model-qualification'
import {
  recordedStructuredModelEvaluation,
  recordedWritingModelEvaluation,
} from './recorded-model-evaluation-runs'

export const structuredModelEvaluationBaseline = {
  ...recordedStructuredModelEvaluation,
  thresholds: {
    extractionRecall: 0.9,
    multilingualFidelity: 1,
    costUsd: 0.001,
    p95LatencyMilliseconds: 10_000,
  },
} as const satisfies ModelEvaluationBaseline

export const writingModelEvaluationBaseline = {
  ...recordedWritingModelEvaluation,
  thresholds: {
    extractionRecall: 1,
    multilingualFidelity: 1,
    costUsd: 0.005,
    p95LatencyMilliseconds: 10_000,
  },
} as const satisfies ModelEvaluationBaseline
