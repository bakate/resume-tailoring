import type { ModelRole } from '../language-model-configuration'
import type { ModelEvaluationBaseline, ModelEvaluationThresholds } from './model-qualification'
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
 * Latency budgets for section-by-section preparation of the real-sized resume. A section is measured
 * from its first writing call to its last call, retries included; the preparation from planning to coherence.
 */
export const sectionPreparationBudgets = {
  // A third of the 90-second per-request timeout: a section near it is one slow retry away from timing out.
  sectionP95LatencyMilliseconds: 30_000,
  // The per-request timeout the single writing call hit twice in production (BAK-67); sections together must beat it.
  preparationWallTimeMilliseconds: 90_000,
} as const satisfies SectionPreparationBudgets

/** The live evaluations of today's pipeline (BAK-172), which replace the 2026-09-27 reference recordings. */
export const liveModelEvaluationDatasetId = 'resume-tailoring-live-v1'

/**
 * The reference-v1 thresholds, carried to the live evaluations. Recall and multilingual fidelity are ratios whose meaning
 * does not change with the sources. Latency and cost were measured on ~200-token fixtures, so they are recalibrated.
 */
// Cost is per Tailored Resume, both roles at their upper-bound rates: OpenAI's ~$0.10 in production
// (daily-spending-limits.js) plus 20%, the most a Tailored Resume may cost. Tighten it once BAK-168 sets the budget.
const maximumUsdPerTailoredResume = 0.12

export const liveModelEvaluationThresholds = {
  structured: {
    extractionRecall: structuredModelEvaluationBaseline.thresholds.extractionRecall,
    multilingualFidelity: structuredModelEvaluationBaseline.thresholds.multilingualFidelity,
    // A production-sized extraction answers within the 45 seconds the Job Posting evaluation always allowed one call:
    // half the per-request timeout. The reference 10 seconds bounded ~200-token fixtures.
    p95LatencyMilliseconds: 45_000,
    costUsd: maximumUsdPerTailoredResume,
  },
  writing: {
    extractionRecall: writingModelEvaluationBaseline.thresholds.extractionRecall,
    multilingualFidelity: writingModelEvaluationBaseline.thresholds.multilingualFidelity,
    // Writing is now measured per Resume Section, retries included, so it shares the section budget.
    p95LatencyMilliseconds: sectionPreparationBudgets.sectionP95LatencyMilliseconds,
    costUsd: maximumUsdPerTailoredResume,
  },
} as const satisfies Record<ModelRole, ModelEvaluationThresholds>

