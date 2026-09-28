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
import { useEffect, useRef, useState } from 'react'
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
  completedOperation: CompletedOperation | null
  failureMessageKey: CandidateSessionFailureMessageKey | null
  isHydrated: boolean
  isOperationTakingLong: boolean
  pendingOperation: PendingOperation | null
  retryCommand: ResumeTailoringCommand | null
  view: ResumeTailoringView
}>

export type PendingOperation =
  | 'analyze-match'
  | 'extract-job-requirements'
  | 'extract-source-profile'
  | 'generate-resume-claims'
  | 'import-source-document'
  | 'reformulate-resume-claim'

type CompletedOperation = Readonly<{
  sequence: number
  type: ResumeTailoringCommand['type']
}>

export type CandidateSessionFailureMessageKey =
  | 'session.deleteFailure'
  | 'session.loadFailure'
  | 'session.openFailure'
  | 'sourceProfile.extractionFailure'
  | 'sourceProfile.failure'
  | 'sourceProfile.browserCompatibilityFailure'
  | 'sourceProfile.unreadableFailure'
  | 'sourceProfile.unsupportedFailure'
  | 'jobPosting.extractionFailure'
  | 'jobPosting.failure'
  | 'jobPosting.transportFailure'
  | 'matchAnalysis.failure'
  | 'matchAnalysis.transportFailure'
  | 'resumeClaims.failure'

export function isSourceDocumentIntakeFailureMessage(
  messageKey: CandidateSessionFailureMessageKey | null,
) {
  return messageKey === 'sourceProfile.failure'
    || messageKey === 'sourceProfile.browserCompatibilityFailure'
    || messageKey === 'sourceProfile.unreadableFailure'
    || messageKey === 'sourceProfile.unsupportedFailure'
}

type CandidateSessionStateSetter = Dispatch<SetStateAction<CandidateSessionState>>
type CandidateSessionActionDependencies = Readonly<{
  operationGeneration: OperationGeneration
  operationTracker: OperationTracker
  setState: CandidateSessionStateSetter
  workflow: ResumeTailoringWorkflow
}>
type OperationTracker = { current: PendingOperation | null }
type OperationGeneration = { current: number }
type FactIdentifier = Readonly<{ factId: SourceProfileFactId }>
type FactIdentifiers = Readonly<{ factIds: readonly SourceProfileFactId[] }>
type FactCorrection = FactIdentifier & Readonly<{ correctedValue: string }>
type ConflictResolution = Readonly<{ selectedFactId: SourceProfileFactId }>
type SourceDocumentImport = CandidateSessionActionDependencies & Readonly<{ file: File }>

export function useCandidateSession() {
  const [workflow] = useState(createBrowserResumeTailoringWorkflow)
  const [state, setState] = useState<CandidateSessionState>(initialCandidateSessionState)
  const operationGeneration = useRef(0)
  const operationTracker = useRef<PendingOperation | null>(null)
  useEffect(() => connectCandidateSession({
    operationGeneration, operationTracker, workflow, setState,
  }), [workflow])
  const dependencies = { operationGeneration, operationTracker, workflow, setState }
  return {
    ...state,
    ...createCandidateSessionActions(dependencies),
    ...createSourceDocumentActions(dependencies),
    ...createSourceProfileFactActions(dependencies),
    ...createJobPostingActions(dependencies),
    ...createMatchAnalysisActions(dependencies),
    ...createResumeClaimActions(dependencies),
    ...createMvpOutcomeActions(dependencies),
    retryLastOperation: () => state.retryCommand === null
      ? Promise.resolve(null)
      : executeCommand({ ...dependencies, command: state.retryCommand }),
  }
}

function createCandidateSessionActions(dependencies: CandidateSessionActionDependencies) {
  return {
    start: () => executeCommand({ ...dependencies, command: { type: 'open-workflow' } }),
    delete: () => executeCommand({ ...dependencies, command: { type: 'delete-session' } }),
  }
}

function createSourceDocumentActions(dependencies: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ ...dependencies, command })
  return {
    importSourceDocument: ({ file }: Readonly<{ file: File }>) => importSourceDocument({
      ...dependencies, file,
    }),
    updateSourceContent: ({ outgoingContent }: Readonly<{ outgoingContent: string }>) => execute({
      type: 'update-source-content', outgoingContent,
    }),
    confirmProcessingNotice: () => execute({ type: 'confirm-processing-notice' }),
    extractSourceProfile: () => execute({ type: 'extract-source-profile' }),
  }
}

function createSourceProfileFactActions(dependencies: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ ...dependencies, command })
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

function createJobPostingActions(dependencies: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ ...dependencies, command })
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

function createMatchAnalysisActions(dependencies: CandidateSessionActionDependencies) {
  return {
    analyzeMatch: () => executeCommand({
      ...dependencies,
      command: { type: 'analyze-match' },
    }),
  }
}

function createResumeClaimActions(dependencies: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ ...dependencies, command })
  return {
    generateResumeClaims: () => execute({ type: 'generate-resume-claims' }),
    removeResumeClaim: ({ claimId }: Readonly<{ claimId: ResumeClaimId }>) => execute({
      type: 'remove-resume-claim', claimId,
    }),
    moveResumeClaim: ({ claimId, direction }: Readonly<{
      claimId: ResumeClaimId
      direction: 'up' | 'down'
    }>) => execute({
      type: 'move-resume-claim', claimId, direction,
    }),
    reformulateResumeClaim: ({ claimId, request }: Readonly<{
      claimId: ResumeClaimId
      request: string
    }>) => execute({ type: 'reformulate-resume-claim', claimId, request }),
  }
}

function createMvpOutcomeActions(dependencies: CandidateSessionActionDependencies) {
  const execute = (command: ResumeTailoringCommand) => executeCommand({ ...dependencies, command })
  return {
    rateTailoredResumeFidelity: ({ assessment }: Readonly<{
      assessment: 'faithful' | 'needs-correction'
    }>) => execute({ type: 'rate-tailored-resume-fidelity', assessment }),
    rateTailoredResumeRelevance: ({ assessment }: Readonly<{
      assessment: 'relevant' | 'needs-improvement'
    }>) => execute({ type: 'rate-tailored-resume-relevance', assessment }),
    recordTailoredResumeDownload: () => execute({ type: 'record-tailored-resume-download' }),
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

async function importSourceDocument({ file, ...dependencies }: SourceDocumentImport) {
  if (dependencies.operationTracker.current !== null) return
  const executionGeneration = dependencies.operationGeneration.current
  const pendingOperation = 'import-source-document'
  const operationTimeout = beginPendingOperation({
    ...dependencies, pendingOperation,
  })
  await waitForPendingPresentation()
  try {
    const command = await createSourceDocumentImportCommand({ file })
    if (executionGeneration !== dependencies.operationGeneration.current) return
    await executePreparedCommand({
      ...dependencies, command, executionGeneration, operationTimeout, pendingOperation,
    })
  } catch {
    applySourceDocumentImportFailure({ ...dependencies, executionGeneration, operationTimeout })
  }
}

async function createSourceDocumentImportCommand({ file }: Readonly<{ file: File }>) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return {
    type: 'import-source-document',
    document: { bytes, mediaType: file.type, name: file.name },
  } as const
}

function applySourceDocumentImportFailure({ executionGeneration, operationTimeout, ...dependencies }:
CandidateSessionActionDependencies & Readonly<{
  executionGeneration: number
  operationTimeout: ReturnType<typeof setTimeout>
}>) {
  if (executionGeneration !== dependencies.operationGeneration.current) return
  clearPendingOperation({ ...dependencies, operationTimeout })
  dependencies.setState((state) => ({
    ...state, failureMessageKey: 'sourceProfile.failure', pendingOperation: null,
  }))
}

function connectCandidateSession({
  operationGeneration,
  operationTracker,
  workflow,
  setState,
}: CandidateSessionActionDependencies) {
  setState((state) => ({ ...state, isHydrated: true }))
  const updateState = (result: ResumeTailoringResult<ResumeTailoringView>) => {
    synchronizeCandidateSession({ operationGeneration, operationTracker, result, setState })
  }
  const unsubscribe = workflow.subscribe(updateState)
  void workflow.readView().then(updateState)
  return unsubscribe
}

function synchronizeCandidateSession({ operationGeneration, operationTracker, result, setState }:
Readonly<{
  operationGeneration: OperationGeneration
  operationTracker: OperationTracker
  result: ResumeTailoringResult<ResumeTailoringView>
  setState: CandidateSessionStateSetter
}>) {
  if (!result.ok) {
    applyResult({ result, setState, failureMessageKey: 'session.loadFailure' })
    return
  }
  operationGeneration.current += 1
  operationTracker.current = null
  setState((state) => ({
    ...state, failureMessageKey: null, isOperationTakingLong: false,
    pendingOperation: null, retryCommand: null, view: result.value,
  }))
}

async function executeCommand({ command, operationGeneration, operationTracker, setState, workflow }:
CandidateSessionActionDependencies & Readonly<{ command: ResumeTailoringCommand }>) {
  if (operationTracker.current !== null && !concurrentSafeCommands.has(command.type)) {
    return duplicateOperationResult
  }
  const execution = prepareCommandExecution({
    command, operationGeneration, operationTracker, setState,
  })
  const { executionGeneration, operationTimeout, pendingOperation } = execution
  if (pendingOperation !== null) await waitForPendingPresentation()
  return executePreparedCommand({
    command, executionGeneration, operationGeneration, operationTimeout, operationTracker,
    pendingOperation, setState, workflow,
  })
}

function prepareCommandExecution({ command, operationGeneration, operationTracker, setState }:
Readonly<{
  command: ResumeTailoringCommand
  operationGeneration: OperationGeneration
  operationTracker: OperationTracker
  setState: CandidateSessionStateSetter
}>) {
  if (command.type === 'delete-session') operationGeneration.current += 1
  const pendingOperation = readPendingOperation({ command })
  const operationTimeout = pendingOperation === null
    ? null
    : beginPendingOperation({ operationGeneration, operationTracker, pendingOperation, setState })
  return { executionGeneration: operationGeneration.current, operationTimeout, pendingOperation }
}

async function executePreparedCommand({
  command, executionGeneration, operationGeneration, operationTimeout, operationTracker,
  pendingOperation, setState, workflow,
}: CandidateSessionActionDependencies & Readonly<{
  command: ResumeTailoringCommand
  executionGeneration: number
  operationTimeout: ReturnType<typeof setTimeout> | null
  pendingOperation: PendingOperation | null
}>) {
  const failureMessageKey = readFailureMessageKey(command)
  const result = await workflow.execute(command)
  if (executionGeneration !== operationGeneration.current) return result
  clearPendingOperation({
    operationGeneration, operationTimeout, operationTracker, setState, workflow,
  })
  applyCommandResult({ command, result, setState, failureMessageKey, pendingOperation })
  return result
}

function beginPendingOperation({ operationGeneration, operationTracker, pendingOperation, setState }:
Readonly<{
  operationGeneration: OperationGeneration
  operationTracker: OperationTracker
  pendingOperation: PendingOperation
  setState: CandidateSessionStateSetter
}>) {
  const executionGeneration = operationGeneration.current
  operationTracker.current = pendingOperation
  setState((state) => ({
    ...state,
    failureMessageKey: null,
    isOperationTakingLong: false,
    pendingOperation,
    retryCommand: null,
  }))
  return schedulePendingReassurance({ executionGeneration, operationGeneration, setState })
}

function schedulePendingReassurance({ executionGeneration, operationGeneration, setState }:
Readonly<{
  executionGeneration: number
  operationGeneration: OperationGeneration
  setState: CandidateSessionStateSetter
}>) {
  return setTimeout(() => {
    if (executionGeneration !== operationGeneration.current) return
    setState((state) => ({ ...state, isOperationTakingLong: true }))
  }, pendingOperationReassuranceDelay)
}

function clearPendingOperation({ operationTimeout, operationTracker }: CandidateSessionActionDependencies
  & Readonly<{ operationTimeout: ReturnType<typeof setTimeout> | null }>) {
  if (operationTimeout !== null) clearTimeout(operationTimeout)
  operationTracker.current = null
}

function waitForPendingPresentation() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => { resolve() })
  })
}

function readPendingOperation({ command }: Readonly<{
  command: ResumeTailoringCommand
}>): PendingOperation | null {
  return pendingOperations.has(command.type) ? command.type as PendingOperation : null
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
    || command.type === 'move-resume-claim'
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

function applyCommandResult({
  command,
  failureMessageKey,
  pendingOperation,
  result,
  setState,
}: Readonly<{
  command: ResumeTailoringCommand
  failureMessageKey: CandidateSessionFailureMessageKey
  pendingOperation: PendingOperation | null
  result: ResumeTailoringResult<ResumeTailoringView>
  setState: CandidateSessionStateSetter
}>) {
  if (!result.ok) {
    applyCommandFailure({ command, failureMessageKey, pendingOperation, result, setState })
    return
  }
  applyCommandSuccess({ command, result, setState })
}

function applyCommandFailure({ command, failureMessageKey, pendingOperation, result, setState }:
Readonly<{
  command: ResumeTailoringCommand
  failureMessageKey: CandidateSessionFailureMessageKey
  pendingOperation: PendingOperation | null
  result: Extract<ResumeTailoringResult<ResumeTailoringView>, { readonly ok: false }>
  setState: CandidateSessionStateSetter
}>) {
  setState((state) => ({
    ...state,
    failureMessageKey: readTypedFailureMessageKey({ result, fallback: failureMessageKey }),
    isOperationTakingLong: false,
    pendingOperation: null,
    retryCommand: pendingOperation === null ? null : command,
  }))
}

function applyCommandSuccess({ command, result, setState }: Readonly<{
  command: ResumeTailoringCommand
  result: Extract<ResumeTailoringResult<ResumeTailoringView>, { readonly ok: true }>
  setState: CandidateSessionStateSetter
}>) {
  setState((state) => ({ ...state, completedOperation: {
    sequence: (state.completedOperation?.sequence ?? 0) + 1, type: command.type,
  }, failureMessageKey: null, isOperationTakingLong: false, pendingOperation: null,
  retryCommand: null, view: result.value }))
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
  if (result.error.type === 'incompatible-source-document-reader') {
    return 'sourceProfile.browserCompatibilityFailure'
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
  completedOperation: null,
  failureMessageKey: null,
  isHydrated: false,
  isOperationTakingLong: false,
  pendingOperation: null,
  retryCommand: null,
  view: { status: 'not-started' },
} as const satisfies CandidateSessionState

const pendingOperations = new Set<ResumeTailoringCommand['type']>([
  'analyze-match',
  'extract-job-requirements',
  'extract-source-profile',
  'generate-resume-claims',
  'import-source-document',
  'reformulate-resume-claim',
])
const concurrentSafeCommands = new Set<ResumeTailoringCommand['type']>([
  'delete-session',
  'rate-tailored-resume-fidelity',
  'rate-tailored-resume-relevance',
])
const pendingOperationReassuranceDelay = 10_000
const duplicateOperationResult = {
  ok: false,
  error: { type: 'candidate-session-unavailable' },
} as const satisfies ResumeTailoringResult<never>
