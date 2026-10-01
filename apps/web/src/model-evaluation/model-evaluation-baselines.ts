import type { ModelEvaluationBaseline } from './model-qualification'
import type { SectionPreparationBudgets } from './section-preparation-qualification'
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

/**
 * Latency budgets for section-by-section preparation of the real-sized resume (ADR-0016). A section is measured
 * from its first writing call to its last call, retries included; the preparation from planning to coherence.
 */
export const sectionPreparationBudgets = {
  // A third of the 90-second per-request timeout: a section near it is one slow retry away from timing out.
  sectionP95LatencyMilliseconds: 30_000,
  // The per-request timeout the single writing call hit twice in production (BAK-67); sections together must beat it.
  preparationWallTimeMilliseconds: 90_000,
} as const satisfies SectionPreparationBudgets
