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
  failureMessage: string | null
  isHydrated: boolean
  view: ResumeTailoringView
}>

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
    applyResult({ result, setState, failureMessage: 'Your private session could not be loaded.' })
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
  const failureMessage = command.type === 'open-workflow'
    ? 'The workflow could not be opened. Try again.'
    : 'Your private session could not be deleted. Try again.'
  applyResult({ result: await workflow.execute(command), setState, failureMessage })
}

function applyResult({
  result,
  setState,
  failureMessage,
}: Readonly<{
  result: ResumeTailoringResult<ResumeTailoringView>
  setState: CandidateSessionStateSetter
  failureMessage: string
}>) {
  if (!result.ok) {
    setState((state) => ({ ...state, failureMessage }))
    return
  }
  setState((state) => ({ ...state, failureMessage: null, view: result.value }))
}

const initialCandidateSessionState = {
  failureMessage: null,
  isHydrated: false,
  view: { status: 'not-started' },
} as const satisfies CandidateSessionState
