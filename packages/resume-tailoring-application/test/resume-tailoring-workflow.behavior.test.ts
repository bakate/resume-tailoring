import { describe, expect, it } from 'vitest'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import type { CandidateSessionPersistence } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

const sessionStartedAt = Date.UTC(2026, 8, 26, 12)
const sessionExpiresAt = Date.UTC(2026, 8, 27, 12)
const sessionIdentifier = 'candidate-session-00000000-0000-4000-8000-000000000007' as const

describe('Resume Tailoring workflow', () => {
  it('starts an expiring private Candidate session', async () => {
    const system = createSystemUnderTest({ initialStatus: 'not-started' })

    // Given
    await system.expectResumeTailoringToBeNotStarted()

    // Action
    await system.startResumeTailoringSession()

    // Then
    system.expectResumeTailoringSessionToBeReady()
    system.expectWorkflowOpeningToBeRecorded()
  })

  it('restores an unexpired Candidate session', async () => {
    const system = createSystemUnderTest({ initialStatus: 'ready' })

    // Given
    system.givenResumeTailoringIsReloaded()

    // Action
    await system.restoreResumeTailoringSession()

    // Then
    system.expectRestoredResumeTailoringSessionToBeReady()
  })

  it('expires the Candidate session at its absolute expiration timestamp', async () => {
    const system = createSystemUnderTest({ initialStatus: 'ready' })

    // Given
    system.givenSessionExpirationIsDue()

    // Action
    await system.expireResumeTailoringSession()

    // Then
    system.expectResumeTailoringSessionToBeDeleted()
    system.expectSessionExpirationToBeRecorded()
  })

  it('cleans up an expired Candidate session during startup', async () => {
    const system = createSystemUnderTest({ initialStatus: 'ready' })

    // Given
    system.givenResumeTailoringIsReloadedAfterExpiration()

    // Action
    await system.restoreResumeTailoringSession()

    // Then
    system.expectResumeTailoringSessionToBeDeleted()
  })

  it('deletes the Candidate session immediately', async () => {
    const system = createSystemUnderTest({ initialStatus: 'ready' })

    // Given
    await system.expectStoredResumeTailoringSessionToBeReady()

    // Action
    await system.deleteResumeTailoringSession()

    // Then
    system.expectResumeTailoringSessionToBeDeleted()
    system.expectSessionDeletionToBeRecorded()
  })

  it('rejects starting a Candidate session that is already active', async () => {
    const system = createSystemUnderTest({ initialStatus: 'ready' })

    // Given
    await system.expectStoredResumeTailoringSessionToBeReady()

    // Action
    await system.startResumeTailoringSession()

    // Then
    system.expectResumeTailoringSessionOpeningToBeRejected()
  })

  it('starts the Candidate session only once when requests overlap', async () => {
    const system = createSystemUnderTest({ initialStatus: 'not-started' })

    // Given
    await system.expectResumeTailoringToBeNotStarted()

    // Action
    await system.startResumeTailoringSessionConcurrently()

    // Then
    system.expectOneResumeTailoringSessionToStart()
    system.expectOneResumeTailoringSessionOpeningToBeRejected()
    system.expectWorkflowOpeningToBeRecorded()
  })
})

function createSystemUnderTest({
  initialStatus,
}: Readonly<{ initialStatus: ResumeTailoringView['status'] }>) {
  return new ResumeTailoringWorkflowTestSystem(initialStatus)
}

class ResumeTailoringWorkflowTestSystem {
  readonly #candidateSessionClock
  readonly #candidateSessionPersistence: CandidateSessionPersistence
  readonly #telemetry = createTelemetrySpy()
  #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #concurrentResults: readonly ResumeTailoringResult<ResumeTailoringView>[] | undefined

  constructor(initialStatus: ResumeTailoringView['status']) {
    this.#candidateSessionClock = createControllableCandidateSessionClock({
      now: sessionStartedAt,
    })
    this.#candidateSessionPersistence = createInMemoryCandidateSessionPersistence({
      initialState: createInitialState(initialStatus),
    })
    this.#workflow = this.#createWorkflow()
  }

  givenResumeTailoringIsReloaded() {
    this.#workflow = this.#createWorkflow()
  }

  givenSessionExpirationIsDue() {
    this.#candidateSessionClock.advanceTo({ timestamp: sessionExpiresAt })
  }

  givenResumeTailoringIsReloadedAfterExpiration() {
    this.#candidateSessionClock.advanceTo({ timestamp: sessionExpiresAt })
    this.#workflow = this.#createWorkflow()
  }

  async startResumeTailoringSession() {
    this.#actionResult = await this.#workflow.execute({ type: 'open-workflow' })
  }

  async restoreResumeTailoringSession() {
    this.#actionResult = await this.#workflow.readView()
  }

  async expireResumeTailoringSession() {
    await this.#candidateSessionClock.runDueExpirations()
    this.#actionResult = await this.#workflow.readView()
  }

  async deleteResumeTailoringSession() {
    this.#actionResult = await this.#workflow.execute({ type: 'delete-session' })
  }

  async startResumeTailoringSessionConcurrently() {
    this.#concurrentResults = await Promise.all([
      this.#workflow.execute({ type: 'open-workflow' }),
      this.#workflow.execute({ type: 'open-workflow' }),
    ])
  }

  async expectResumeTailoringToBeNotStarted() {
    expect(await this.#workflow.readView()).toEqual(notStartedResult)
  }

  async expectStoredResumeTailoringSessionToBeReady() {
    expect(await this.#workflow.readView()).toEqual(readyResult)
  }

  expectResumeTailoringSessionToBeReady() {
    expect(this.#readActionResult()).toEqual(readyResult)
  }

  expectRestoredResumeTailoringSessionToBeReady() {
    expect(this.#readActionResult()).toEqual(readyResult)
  }

  expectResumeTailoringSessionToBeDeleted() {
    expect(this.#readActionResult()).toEqual(notStartedResult)
  }

  expectResumeTailoringSessionOpeningToBeRejected() {
    expect(this.#readActionResult()).toEqual(workflowAlreadyOpenResult)
  }

  expectOneResumeTailoringSessionToStart() {
    expect(this.#readConcurrentResults()).toContainEqual(readyResult)
  }

  expectOneResumeTailoringSessionOpeningToBeRejected() {
    expect(this.#readConcurrentResults()).toContainEqual(workflowAlreadyOpenResult)
  }

  expectWorkflowOpeningToBeRecorded() {
    expect(this.#telemetry.recordedEvents()).toEqual([{ name: 'resume-tailoring-opened' }])
  }

  expectSessionExpirationToBeRecorded() {
    expect(this.#telemetry.recordedEvents()).toEqual([{ name: 'candidate-session-expired' }])
  }

  expectSessionDeletionToBeRecorded() {
    expect(this.#telemetry.recordedEvents()).toEqual([{ name: 'candidate-session-deleted' }])
  }

  #createWorkflow() {
    return createResumeTailoringWorkflow({
      candidateSessionClock: this.#candidateSessionClock,
      candidateSessionIdentity: {
        create: () => ({ ok: true, value: sessionIdentifier }),
      },
      candidateSessionPersistence: this.#candidateSessionPersistence,
      telemetry: this.#telemetry,
    })
  }

  #readActionResult() {
    if (this.#actionResult === undefined) {
      throw new Error('Complete a Resume Tailoring session action before reading its outcome')
    }
    return this.#actionResult
  }

  #readConcurrentResults() {
    if (this.#concurrentResults === undefined) {
      throw new Error('Start the Candidate session concurrently before reading its outcomes')
    }
    return this.#concurrentResults
  }
}

function createInitialState(initialStatus: ResumeTailoringView['status']) {
  return initialStatus === 'ready'
    ? { status: 'ready', sessionId: sessionIdentifier, expiresAt: sessionExpiresAt } as const
    : { status: 'not-started' } as const
}

const readyResult = {
  ok: true,
  value: { status: 'ready', sessionId: sessionIdentifier, expiresAt: sessionExpiresAt },
} as const

const notStartedResult = {
  ok: true,
  value: { status: 'not-started' },
} as const

const workflowAlreadyOpenResult = {
  ok: false,
  error: { type: 'workflow-already-open' },
} as const
