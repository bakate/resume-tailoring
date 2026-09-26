import type {
  ResumeTailoringCommand,
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import {
  createBrowserCandidateSessionClock,
  createBrowserCandidateSessionIdentity,
  createBrowserCandidateSessionPersistence,
  createPrivacySafeBrowserTelemetry,
} from './browser-adapters'

type CandidateSessionState = Readonly<{
  failureMessageKey: CandidateSessionFailureMessageKey | null
  isHydrated: boolean
  view: ResumeTailoringView
}>

export type CandidateSessionFailureMessageKey =
  | 'session.deleteFailure'
  | 'session.loadFailure'
  | 'session.openFailure'

type CandidateSessionStateSetter = Dispatch<SetStateAction<CandidateSessionState>>

export function useCandidateSession() {
  const [workflow] = useState(createBrowserResumeTailoringWorkflow)
  const [state, setState] = useState<CandidateSessionState>(initialCandidateSessionState)
  useEffect(() => connectCandidateSession({ workflow, setState }), [workflow])
  return {
    ...state,
    start: () => executeCommand({ workflow, setState, command: { type: 'open-workflow' } }),
    delete: () => executeCommand({ workflow, setState, command: { type: 'delete-session' } }),
  }
}

function createBrowserResumeTailoringWorkflow() {
  return createResumeTailoringWorkflow({
    candidateSessionClock: createBrowserCandidateSessionClock(),
    candidateSessionIdentity: createBrowserCandidateSessionIdentity(),
    candidateSessionPersistence: createBrowserCandidateSessionPersistence(),
    telemetry: createPrivacySafeBrowserTelemetry(),
  })
}

function connectCandidateSession({
  workflow,
  setState,
}: Readonly<{ workflow: ResumeTailoringWorkflow; setState: CandidateSessionStateSetter }>) {
  setState((state) => ({ ...state, isHydrated: true }))
  const updateState = (result: ResumeTailoringResult<ResumeTailoringView>) => {
    applyResult({ result, setState, failureMessageKey: 'session.loadFailure' })
  }
  const unsubscribe = workflow.subscribe(updateState)
  void workflow.readView().then(updateState)
  return unsubscribe
}

async function executeCommand({
  workflow,
  setState,
  command,
}: Readonly<{
  workflow: ResumeTailoringWorkflow
  setState: CandidateSessionStateSetter
  command: ResumeTailoringCommand
}>) {
  const failureMessageKey = command.type === 'open-workflow'
    ? 'session.openFailure'
    : 'session.deleteFailure'
  applyResult({ result: await workflow.execute(command), setState, failureMessageKey })
}

function applyResult({
  result,
  setState,
  failureMessageKey,
}: Readonly<{
  result: ResumeTailoringResult<ResumeTailoringView>
  setState: CandidateSessionStateSetter
  failureMessageKey: CandidateSessionFailureMessageKey
}>) {
  if (!result.ok) {
    setState((state) => ({ ...state, failureMessageKey }))
    return
  }
  setState((state) => ({ ...state, failureMessageKey: null, view: result.value }))
}

const initialCandidateSessionState = {
  failureMessageKey: null,
  isHydrated: false,
  view: { status: 'not-started' },
} as const satisfies CandidateSessionState
