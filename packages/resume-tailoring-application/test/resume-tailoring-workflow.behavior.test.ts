import { describe, expect, it } from 'vitest'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import {
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

describe('Resume Tailoring workflow', () => {
  it('opens the initial workflow for a Candidate', async () => {
    const system = createSystemUnderTest({ initialStatus: 'not-started' })

    // Given
    await system.expectResumeTailoringToBeNotStarted()

    // Action
    await system.openResumeTailoring()

    // Then
    system.expectResumeTailoringToBeReady()
    system.expectWorkflowOpeningToBeRecorded()
  })

  it('rejects opening a workflow that is already open', async () => {
    const system = createSystemUnderTest({ initialStatus: 'ready' })

    // Given
    await system.expectStoredResumeTailoringToBeReady()

    // Action
    await system.openResumeTailoring()

    // Then
    system.expectResumeTailoringOpeningToBeRejected()
  })

  it('opens the workflow only once when requests overlap', async () => {
    const system = createSystemUnderTest({ initialStatus: 'not-started' })

    // Given
    await system.expectResumeTailoringToBeNotStarted()

    // Action
    await system.openResumeTailoringConcurrently()

    // Then
    system.expectOneResumeTailoringOpeningToSucceed()
    system.expectOneResumeTailoringOpeningToBeRejected()
    system.expectWorkflowOpeningToBeRecorded()
  })
})

function createSystemUnderTest({
  initialStatus,
}: Readonly<{ initialStatus: ResumeTailoringView['status'] }>) {
  const candidateSessionPersistence = createInMemoryCandidateSessionPersistence({
    initialState: { status: initialStatus },
  })
  const telemetry = createTelemetrySpy()
  const workflow = createResumeTailoringWorkflow({
    candidateSessionPersistence,
    telemetry,
  })
  let openingResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  let concurrentOpeningResults: readonly ResumeTailoringResult<ResumeTailoringView>[] | undefined

  return {
    async openResumeTailoring() {
      openingResult = await workflow.execute({ type: 'open-workflow' })
    },
    async openResumeTailoringConcurrently() {
      concurrentOpeningResults = await Promise.all([
        workflow.execute({ type: 'open-workflow' }),
        workflow.execute({ type: 'open-workflow' }),
      ])
    },
    async expectResumeTailoringToBeNotStarted() {
      const result = await workflow.readView()
      expect(result).toEqual({
        ok: true,
        value: { status: 'not-started' },
      })
    },
    expectResumeTailoringToBeReady() {
      expect(readOpeningResult()).toEqual({
        ok: true,
        value: { status: 'ready' },
      })
    },
    async expectStoredResumeTailoringToBeReady() {
      const result = await workflow.readView()
      expect(result).toEqual({
        ok: true,
        value: { status: 'ready' },
      })
    },
    expectResumeTailoringOpeningToBeRejected() {
      expect(readOpeningResult()).toEqual({
        ok: false,
        error: { type: 'workflow-already-open' },
      })
    },
    expectOneResumeTailoringOpeningToSucceed() {
      expect(readConcurrentOpeningResults()).toContainEqual({
        ok: true,
        value: { status: 'ready' },
      })
    },
    expectOneResumeTailoringOpeningToBeRejected() {
      expect(readConcurrentOpeningResults()).toContainEqual({
        ok: false,
        error: { type: 'workflow-already-open' },
      })
    },
    expectWorkflowOpeningToBeRecorded() {
      expect(telemetry.recordedEvents()).toEqual(['resume-tailoring-opened'])
    },
  }

  function readOpeningResult() {
    expect(openingResult, 'Open the Resume Tailoring workflow before reading its outcome').toBeDefined()

    if (openingResult === undefined) {
      throw new Error('Open the Resume Tailoring workflow before reading its outcome')
    }

    return openingResult
  }

  function readConcurrentOpeningResults() {
    if (concurrentOpeningResults === undefined) {
      throw new Error('Open the Resume Tailoring workflow concurrently before reading its outcomes')
    }

    return concurrentOpeningResults
  }
}
