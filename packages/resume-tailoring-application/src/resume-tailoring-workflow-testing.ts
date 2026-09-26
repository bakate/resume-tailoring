import { initialResumeTailoringState } from '@resume-tailoring/domain/resume-tailoring-state'
import type { ResumeTailoringState } from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  CandidateSessionPersistence,
  PrivacySafeTelemetry,
} from './resume-tailoring-workflow-ports'

export function createInMemoryCandidateSessionPersistence({
  initialState = initialResumeTailoringState,
}: Readonly<{
  initialState?: ResumeTailoringState
}> = {}): CandidateSessionPersistence {
  let currentState: ResumeTailoringState = initialState

  return {
    read: () => Promise.resolve({ ok: true, value: currentState }),
    write: (state) => {
      currentState = state
      return Promise.resolve({ ok: true, value: currentState })
    },
  }
}

export function createTelemetrySpy() {
  const events: ('resume-tailoring-opened')[] = []
  const adapter: PrivacySafeTelemetry = {
    record: (event) => {
      events.push(event)
      return Promise.resolve({ ok: true, value: undefined })
    },
  }

  return {
    ...adapter,
    recordedEvents: () => [...events],
  }
}
