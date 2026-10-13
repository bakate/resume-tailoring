import type { ModelRole } from '../language-model-configuration'
import type { ModelEvaluationThresholds } from './model-qualification'
import type { SectionPreparationBudgets } from './section-preparation-qualification'

/**
 * Latency budgets for section-by-section preparation of the real-sized resume. A section is measured by the time its
 * calls took, retries and a coherence rewrite included; the preparation from planning to coherence.
 */
export const sectionPreparationBudgets = {
  // A third of the 90-second per-request timeout: a section near it is one slow retry away from timing out.
  sectionP95LatencyMilliseconds: 30_000,
  // The per-request timeout the single writing call hit twice in production (BAK-67); sections together must beat it.
  preparationWallTimeMilliseconds: 90_000,
} as const satisfies SectionPreparationBudgets

/** The live evaluations of today's pipeline (BAK-172), which replaced the 2026-09-27 reference recordings. */
export const liveModelEvaluationDatasetId = 'resume-tailoring-live-v1'

// Cost is per Tailored Resume, both roles at their upper-bound rates: OpenAI's ~$0.10 in production plus 20%, the most
// a Tailored Resume may cost. The global ceiling assumes the qualified DeepSeek cost instead (daily-spending-limits.js,
// BAK-168): a configuration recorded above it needs the ceiling computed again.
const maximumUsdPerTailoredResume = 0.12

/**
 * Recall and multilingual fidelity keep the floors calibrated on the 2026-09-27 reference recordings: they are ratios
 * whose meaning does not change with the sources. Latency and cost were measured on ~200-token fixtures there, so they
 * are recalibrated to production-sized work.
 */
export const liveModelEvaluationThresholds = {
  structured: {
    // The reference recordings measured 100%; the floor keeps the headroom it was calibrated with.
    extractionRecall: 0.9,
    multilingualFidelity: 1,
    // Each structured operation answers within its own qualified deadline (BAK-166): DeepSeek's Match Evidence thinks
    // for up to 110 s where extraction answers in seconds, so one figure across operations would gate on the slowest.
    p95LatencyMilliseconds: 'operation-deadline',
    costUsd: maximumUsdPerTailoredResume,
  },
  writing: {
    // Writing owns no extraction; its recall counts preparations that end prepared, all of which must.
    extractionRecall: 1,
    multilingualFidelity: 1,
    // Writing is measured per Resume Section, retries included, so it shares the section budget.
    p95LatencyMilliseconds: sectionPreparationBudgets.sectionP95LatencyMilliseconds,
    costUsd: maximumUsdPerTailoredResume,
  },
} as const satisfies Record<ModelRole, ModelEvaluationThresholds>
