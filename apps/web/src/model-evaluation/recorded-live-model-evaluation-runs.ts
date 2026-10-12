import type { RecordedModelEvaluationRun } from './model-qualification-runner'

// Written by `pnpm test:evaluation:record <candidate>`: one run per Qualified Model Configuration candidate.
export const recordedLiveModelEvaluationRuns: readonly RecordedModelEvaluationRun[] = []
