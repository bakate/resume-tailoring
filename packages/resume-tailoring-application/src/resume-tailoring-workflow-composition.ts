import { openResumeTailoringWorkflow } from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from './resume-tailoring-workflow'
import type {
  CandidateSessionPersistence,
  PrivacySafeTelemetry,
} from './resume-tailoring-workflow-ports'

type ResumeTailoringDependencies = Readonly<{
  candidateSessionPersistence: CandidateSessionPersistence
  telemetry: PrivacySafeTelemetry
}>

export function createResumeTailoringWorkflow({
  candidateSessionPersistence,
  telemetry,
}: ResumeTailoringDependencies): ResumeTailoringWorkflow {
  let executionQueue = Promise.resolve()

  return {
    execute: () => {
      const execution = executionQueue.then(openWorkflow)
      executionQueue = execution.then(ignoreResult, ignoreResult)
      return execution
    },
    readView: async () => {
      const currentState = await candidateSessionPersistence.read()
      return currentState.ok ? currentState : unavailableResult
    },
  }

  async function openWorkflow(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await candidateSessionPersistence.read()
    if (!currentState.ok) return unavailableResult

    const transition = openResumeTailoringWorkflow({ currentState: currentState.value })
    if (!transition.ok) return transition

    const persistedState = await candidateSessionPersistence.write(transition.value)
    if (!persistedState.ok) return unavailableResult

    await telemetry.record('resume-tailoring-opened')
    return { ok: true, value: persistedState.value }
  }
}

function ignoreResult() {}

const unavailableResult = {
  ok: false,
  error: { type: 'candidate-session-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>
