import type {
  ResumeTailoringCommand,
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import type {
  ResumeClaimId,
  SourceProfileFactId,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import {
  createBrowserCandidateSessionClock,
  createBrowserCandidateSessionIdentity,
  createBrowserCandidateSessionPersistence,
  createBrowserJobRequirementExtractor,
  createBrowserJobRequirementGroupIdentity,
  createBrowserJobRequirementIdentity,
  createBrowserMatchEvidenceMatcher,
  createBrowserResumeClaimIdentity,
  createBrowserResumeClaimSemanticValidator,
  createBrowserResumeClaimWriter,
  createBrowserSourceDocumentReader,
  createBrowserSourceProfileFactIdentity,
  createBrowserSourceProfileExtractor,
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
  | 'sourceProfile.extractionFailure'
  | 'sourceProfile.failure'
  | 'sourceProfile.unreadableFailure'
  | 'sourceProfile.unsupportedFailure'
  | 'jobPosting.extractionFailure'
  | 'jobPosting.failure'
  | 'jobPosting.transportFailure'
  | 'matchAnalysis.failure'
  | 'matchAnalysis.transportFailure'
  | 'resumeClaims.failure'

type CandidateSessionStateSetter = Dispatch<SetStateAction<CandidateSessionState>>
type CandidateSessionActionDependencies = Readonly<{
  setState: CandidateSessionStateSetter
  workflow: ResumeTailoringWorkflow
}>
type FactIdentifier = Readonly<{ factId: SourceProfileFactId }>
type FactIdentifiers = Readonly<{ factIds: readonly SourceProfileFactId[] }>
type FactCorrection = FactIdentifier & Readonly<{ correctedValue: string }>
type ConflictResolution = Readonly<{ selectedFactId: SourceProfileFactId }>
type SourceDocumentImport = CandidateSessionActionDependencies & Readonly<{ file: File }>

export function useCandidateSession() {
  const [workflow] = useState(createBrowserResumeTailoringWorkflow)
  const [state, setState] = useState<CandidateSessionState>(initialCandidateSessionState)
  useEffect(() => connectCandidateSession({ workflow, setState }), [workflow])
  return {
    ...state,
    ...createCandidateSessionActions({ workflow, setState }),
    ...createSourceDocumentActions({ workflow, setState }),
    ...createSourceProfileFactActions({ workflow, setState }),
    ...createJobPostingActions({ workflow, setState }),
    ...createMatchAnalysisActions({ workflow, setState }),
    ...createResumeClaimActions({ workflow, setState }),
  }
}

function createCandidateSessionActions({ workflow, setState }: CandidateSessionActionDependencies) {
  return {
    start: () => executeCommand({ workflow, setState, command: { type: 'open-workflow' } }),
    delete: () => executeCommand({ workflow, setState, command: { type: 'delete-session' } }),
  }
}

function createSourceDocumentActions({ workflow, setState }: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ workflow, setState, command })
  return {
    importSourceDocument: ({ file }: Readonly<{ file: File }>) => importSourceDocument({
      file, workflow, setState,
    }),
    updateSourceContent: ({ outgoingContent }: Readonly<{ outgoingContent: string }>) => execute({
      type: 'update-source-content', outgoingContent,
    }),
    confirmProcessingNotice: () => execute({ type: 'confirm-processing-notice' }),
    extractSourceProfile: () => execute({ type: 'extract-source-profile' }),
  }
}

function createSourceProfileFactActions({ workflow, setState }: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ workflow, setState, command })
  return {
    confirmSourceProfileFact: ({ factId }: FactIdentifier) => execute({
      type: 'confirm-source-fact', factId,
    }),
    confirmSourceProfileFacts: ({ factIds }: FactIdentifiers) => execute({
      type: 'confirm-source-facts', factIds,
    }),
    rejectSourceProfileFact: ({ factId }: FactIdentifier) => execute({ type: 'reject-source-fact', factId }),
    correctSourceProfileFact: ({ factId, correctedValue }: FactCorrection) => execute({
      type: 'correct-source-fact', factId, correctedValue,
    }),
    resolveSourceProfileFactConflict: ({ selectedFactId }: ConflictResolution) => execute({
      type: 'resolve-source-fact-conflict', selectedFactId,
    }),
  }
}

function createJobPostingActions({ workflow, setState }: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ workflow, setState, command })
  return {
    reviewJobPosting: ({ content }: Readonly<{ content: string }>) => execute({
      type: 'review-job-posting', content,
    }),
    updateJobPostingContent: ({ outgoingContent }: Readonly<{ outgoingContent: string }>) => execute({
      type: 'update-job-posting-content', outgoingContent,
    }),
    confirmJobPostingProcessingNotice: () => execute({
      type: 'confirm-job-posting-processing-notice',
    }),
    extractJobRequirements: () => execute({ type: 'extract-job-requirements' }),
  }
}

function createMatchAnalysisActions({ workflow, setState }: CandidateSessionActionDependencies) {
  return {
    analyzeMatch: () => executeCommand({
      workflow,
      setState,
      command: { type: 'analyze-match' },
    }),
  }
}

function createResumeClaimActions({ workflow, setState }: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ workflow, setState, command })
  return {
    generateResumeClaims: () => execute({ type: 'generate-resume-claims' }),
    removeResumeClaim: ({ claimId }: Readonly<{ claimId: ResumeClaimId }>) => execute({
      type: 'remove-resume-claim', claimId,
    }),
    reorderResumeClaims: ({ claimIds }: Readonly<{ claimIds: readonly ResumeClaimId[] }>) => execute({
      type: 'reorder-resume-claims', claimIds,
    }),
    reformulateResumeClaim: ({ claimId, request }: Readonly<{
      claimId: ResumeClaimId
      request: string
    }>) => execute({ type: 'reformulate-resume-claim', claimId, request }),
  }
}

export type CandidateSessionController = ReturnType<typeof useCandidateSession>

function createBrowserResumeTailoringWorkflow() {
  return createResumeTailoringWorkflow({
    candidateSessionClock: createBrowserCandidateSessionClock(),
    candidateSessionIdentity: createBrowserCandidateSessionIdentity(),
    candidateSessionPersistence: createBrowserCandidateSessionPersistence(),
    jobRequirementExtractor: createBrowserJobRequirementExtractor(),
    jobRequirementGroupIdentity: createBrowserJobRequirementGroupIdentity(),
    jobRequirementIdentity: createBrowserJobRequirementIdentity(),
    matchEvidenceMatcher: createBrowserMatchEvidenceMatcher(),
    resumeClaimIdentity: createBrowserResumeClaimIdentity(),
    resumeClaimSemanticValidator: createBrowserResumeClaimSemanticValidator(),
    resumeClaimWriter: createBrowserResumeClaimWriter(),
    sourceDocumentReader: createBrowserSourceDocumentReader(),
    sourceProfileFactIdentity: createBrowserSourceProfileFactIdentity(),
    sourceProfileExtractor: createBrowserSourceProfileExtractor(),
    telemetry: createPrivacySafeBrowserTelemetry(),
  })
}

async function importSourceDocument({ file, workflow, setState }: SourceDocumentImport) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await executeCommand({
      workflow,
      setState,
      command: {
        type: 'import-source-document',
        document: { bytes, mediaType: file.type, name: file.name },
      },
    })
  } catch {
    setState((state) => ({ ...state, failureMessageKey: 'sourceProfile.failure' }))
  }
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
  const failureMessageKey = readFailureMessageKey(command)
  applyResult({ result: await workflow.execute(command), setState, failureMessageKey })
}

function readFailureMessageKey(command: ResumeTailoringCommand): CandidateSessionFailureMessageKey {
  if (command.type === 'open-workflow') return 'session.openFailure'
  if (command.type === 'delete-session') return 'session.deleteFailure'
  if (isJobPostingCommand(command)) return 'jobPosting.failure'
  if (command.type === 'analyze-match') return 'matchAnalysis.failure'
  if (isResumeClaimCommand(command)) return 'resumeClaims.failure'
  return 'sourceProfile.failure'
}

function isResumeClaimCommand(command: ResumeTailoringCommand) {
  return command.type === 'generate-resume-claims'
    || command.type === 'remove-resume-claim'
    || command.type === 'reorder-resume-claims'
    || command.type === 'reformulate-resume-claim'
}

function isJobPostingCommand(command: ResumeTailoringCommand) {
  return command.type === 'review-job-posting'
    || command.type === 'update-job-posting-content'
    || command.type === 'confirm-job-posting-processing-notice'
    || command.type === 'extract-job-requirements'
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
    setState((state) => ({
      ...state,
      failureMessageKey: readTypedFailureMessageKey({ result, fallback: failureMessageKey }),
    }))
    return
  }
  setState((state) => ({ ...state, failureMessageKey: null, view: result.value }))
}

function readTypedFailureMessageKey({
  fallback,
  result,
}: Readonly<{
  fallback: CandidateSessionFailureMessageKey
  result: Extract<ResumeTailoringResult<ResumeTailoringView>, { readonly ok: false }>
}>): CandidateSessionFailureMessageKey {
  if (result.error.type === 'unsupported-source-document') {
    return 'sourceProfile.unsupportedFailure'
  }
  if (result.error.type === 'unreadable-source-document') return 'sourceProfile.unreadableFailure'
  if (result.error.type === 'source-profile-extraction-unavailable') {
    return 'sourceProfile.extractionFailure'
  }
  if (result.error.type === 'job-requirement-extraction-unavailable') {
    return 'jobPosting.extractionFailure'
  }
  if (result.error.type === 'job-requirement-transport-unavailable') {
    return 'jobPosting.transportFailure'
  }
  if (result.error.type === 'match-analysis-transport-unavailable') {
    return 'matchAnalysis.transportFailure'
  }
  if (result.error.type === 'match-analysis-unavailable') return 'matchAnalysis.failure'
  return fallback
}

const initialCandidateSessionState = {
  failureMessageKey: null,
  isHydrated: false,
  view: { status: 'not-started' },
} as const satisfies CandidateSessionState
