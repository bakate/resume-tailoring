import { initialResumeTailoringState } from '@resume-tailoring/domain/resume-tailoring-state'
import type {
  CandidateSessionId,
  ResumeTailoringState,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  CandidateSessionClock,
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
    create: (state) => {
      if (currentState.status === 'ready') return Promise.resolve(inactiveResult)
      currentState = state
      return Promise.resolve({ ok: true, value: currentState })
    },
    update: ({ sessionId, state }) => {
      if (!isActiveSession({ currentState, sessionId })) return Promise.resolve(inactiveResult)
      currentState = state
      return Promise.resolve({ ok: true, value: currentState })
    },
    erase: ({ sessionId }) => {
      if (!isActiveSession({ currentState, sessionId })) {
        return Promise.resolve({ ok: true, value: currentState })
      }
      currentState = initialResumeTailoringState
      return Promise.resolve({ ok: true, value: currentState })
    },
    subscribe: () => ignoreResult,
  }
}

export function createControllableCandidateSessionClock({
  now: initialTimestamp,
}: Readonly<{ now: number }>) {
  let currentTimestamp = initialTimestamp
  const expirations = new Map<number, () => Promise<void>>()
  let nextExpirationIdentifier = 0

  return {
    now: () => currentTimestamp,
    scheduleExpiration({ expiresAt, onExpire }) {
      const expirationIdentifier = nextExpirationIdentifier
      nextExpirationIdentifier += 1
      expirations.set(expirationIdentifier, async () => {
        if (expiresAt <= currentTimestamp) await onExpire()
      })
      return () => expirations.delete(expirationIdentifier)
    },
    advanceTo({ timestamp }: Readonly<{ timestamp: number }>) {
      currentTimestamp = timestamp
    },
    async runDueExpirations() {
      await Promise.all([...expirations.values()].map((expire) => expire()))
    },
  } satisfies CandidateSessionClock & {
    readonly advanceTo: (request: Readonly<{ timestamp: number }>) => void
    readonly runDueExpirations: () => Promise<void>
  }
}

export function createTelemetrySpy() {
  const events: Parameters<PrivacySafeTelemetry['record']>[0][] = []
  const adapter: PrivacySafeTelemetry = {
    record: (event) => {
      events.push(event)
      return Promise.resolve({ ok: true, value: undefined })
    },
  }

  return { ...adapter, recordedEvents: () => [...events] }
}

function isActiveSession({
  currentState,
  sessionId,
}: Readonly<{ currentState: ResumeTailoringState; sessionId: CandidateSessionId }>) {
  return currentState.status === 'ready' && currentState.sessionId === sessionId
}

function ignoreResult(): undefined {
  return undefined
}

const inactiveResult = {
  ok: false,
  error: { type: 'candidate-session-inactive' },
} as const
