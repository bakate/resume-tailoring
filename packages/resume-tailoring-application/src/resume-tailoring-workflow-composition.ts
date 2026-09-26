import {
  hasCandidateSessionExpired,
  openResumeTailoringWorkflow,
} from '@resume-tailoring/domain/resume-tailoring-state'
import type {
  CandidateSessionId,
  ResumeTailoringState,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  ResumeTailoringCommand,
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from './resume-tailoring-workflow'
import type {
  CandidateSessionClock,
  CandidateSessionIdentity,
  CandidateSessionPersistence,
  PrivacySafeTelemetry,
} from './resume-tailoring-workflow-ports'

type ResumeTailoringDependencies = Readonly<{
  candidateSessionClock: CandidateSessionClock
  candidateSessionIdentity: CandidateSessionIdentity
  candidateSessionPersistence: CandidateSessionPersistence
  telemetry: PrivacySafeTelemetry
}>

type ReadyResumeTailoringState = Extract<
  ResumeTailoringState,
  { readonly status: 'ready' }
>

export function createResumeTailoringWorkflow(
  dependencies: ResumeTailoringDependencies,
): ResumeTailoringWorkflow {
  return new DefaultResumeTailoringWorkflow(dependencies)
}

class DefaultResumeTailoringWorkflow implements ResumeTailoringWorkflow {
  readonly #dependencies: ResumeTailoringDependencies
  readonly #listeners = new Set<
    (result: ResumeTailoringResult<ResumeTailoringView>) => void
  >()
  #executionQueue = Promise.resolve()
  #cancelExpiration: () => void = ignoreResult

  constructor(dependencies: ResumeTailoringDependencies) {
    this.#dependencies = dependencies
    dependencies.candidateSessionPersistence.subscribe(() => {
      void this.#enqueue(() => this.#notifyCurrentState())
    })
  }

  execute(command: ResumeTailoringCommand) {
    return this.#enqueue(() => this.#executeCommand(command))
  }

  readView() {
    return this.#enqueue(() => this.#readActiveState())
  }

  subscribe(listener: (result: ResumeTailoringResult<ResumeTailoringView>) => void) {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #enqueue<TValue>(action: () => Promise<TValue>): Promise<TValue> {
    const result = this.#executionQueue.then(action)
    this.#executionQueue = result.then(ignoreResult, ignoreResult)
    return result
  }

  #executeCommand(command: ResumeTailoringCommand) {
    return command.type === 'open-workflow'
      ? this.#openWorkflow()
      : this.#deleteSession()
  }

  async #openWorkflow(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!currentState.ok) return currentState
    if (currentState.value.status === 'ready') return workflowAlreadyOpenResult

    const sessionIdentity = this.#dependencies.candidateSessionIdentity.create()
    if (!sessionIdentity.ok) return unavailableResult
    const transition = openResumeTailoringWorkflow({
      currentState: currentState.value,
      sessionId: sessionIdentity.value,
      startedAt: this.#dependencies.candidateSessionClock.now(),
    })
    if (!transition.ok) return transition
    if (transition.value.status !== 'ready') return unavailableResult
    return this.#persistOpenedSession(transition.value)
  }

  async #persistOpenedSession(state: ReadyResumeTailoringState) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.create(state)
    if (!persistedState.ok) return unavailableResult

    this.#scheduleExpiration(state)
    await this.#dependencies.telemetry.record('resume-tailoring-opened')
    return { ok: true, value: persistedState.value } as const
  }

  async #deleteSession(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!currentState.ok || currentState.value.status === 'not-started') return currentState

    const deletedState = await this.#eraseSession(currentState.value.sessionId)
    if (!deletedState.ok) return deletedState

    await this.#dependencies.telemetry.record('candidate-session-deleted')
    this.#notify(deletedState)
    return deletedState
  }

  async #readActiveState(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const persistedState = await this.#dependencies.candidateSessionPersistence.read()
    if (!persistedState.ok) return unavailableResult
    const hasExpired = hasCandidateSessionExpired({
      currentState: persistedState.value,
      now: this.#dependencies.candidateSessionClock.now(),
    })
    if (!hasExpired) {
      this.#scheduleExpirationIfReady(persistedState.value)
      return persistedState
    }
    if (persistedState.value.status !== 'ready') return persistedState
    return this.#expireSession(persistedState.value)
  }

  async #expireSession(state: ReadyResumeTailoringState) {
    const deletedState = await this.#eraseSession(state.sessionId)
    if (!deletedState.ok) return deletedState

    await this.#dependencies.telemetry.record('candidate-session-expired')
    this.#notify(deletedState)
    return deletedState
  }

  async #eraseSession(
    sessionId: CandidateSessionId,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const deletedState = await this.#dependencies.candidateSessionPersistence.erase({ sessionId })
    if (!deletedState.ok) return unavailableResult

    this.#cancelExpiration()
    this.#cancelExpiration = ignoreResult
    return { ok: true, value: deletedState.value }
  }

  #scheduleExpirationIfReady(state: ResumeTailoringState) {
    if (state.status === 'ready') this.#scheduleExpiration(state)
    else this.#cancelExpiration()
  }

  #scheduleExpiration(state: ReadyResumeTailoringState) {
    this.#cancelExpiration()
    this.#cancelExpiration = this.#dependencies.candidateSessionClock.scheduleExpiration({
      expiresAt: state.expiresAt,
      onExpire: () => this.#enqueue(() => this.#expireSessionIfCurrent(state.sessionId)),
    })
  }

  async #expireSessionIfCurrent(sessionId: CandidateSessionId): Promise<void> {
    const persistedState = await this.#dependencies.candidateSessionPersistence.read()
    if (!persistedState.ok || persistedState.value.status !== 'ready') return
    if (persistedState.value.sessionId !== sessionId) return
    if (persistedState.value.expiresAt > this.#dependencies.candidateSessionClock.now()) return

    await this.#expireSession(persistedState.value)
  }

  async #notifyCurrentState(): Promise<void> {
    this.#notify(await this.#readActiveState())
  }

  #notify(result: ResumeTailoringResult<ResumeTailoringView>) {
    this.#listeners.forEach((listener) => {
      listener(result)
    })
  }
}

function ignoreResult(): undefined {
  return undefined
}

const workflowAlreadyOpenResult = {
  ok: false,
  error: { type: 'workflow-already-open' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const unavailableResult = {
  ok: false,
  error: { type: 'candidate-session-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>
