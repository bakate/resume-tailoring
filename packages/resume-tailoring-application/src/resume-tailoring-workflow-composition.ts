import {
  hasCandidateSessionExpired,
  openResumeTailoringWorkflow,
} from '@resume-tailoring/domain/resume-tailoring-state'
import type {
  CandidateSessionId,
  JobPostingReview,
  JobRequirement,
  ResumeTailoringState,
  SourceProfileFact,
  SourceProfileFactContent,
  SourceProfileFactId,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  ResumeTailoringCommand,
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from './resume-tailoring-workflow'
import { sourceProfileProcessingNoticeVersion } from './resume-tailoring-workflow'
import { jobPostingProcessingNoticeVersion } from './resume-tailoring-workflow'
import { jobPostingProcessingPolicy } from './resume-tailoring-workflow'
import { hasCurrentJobPostingProcessingConsent } from './resume-tailoring-workflow'
import type {
  CandidateSessionClock,
  CandidateSessionIdentity,
  CandidateSessionPersistence,
  PrivacySafeTelemetry,
  SourceDocumentReader,
  SourceProfileFactIdentity,
  SourceProfileExtractor,
  JobRequirementExtractor,
  JobRequirementGroupIdentity,
  JobRequirementIdentity,
} from './resume-tailoring-workflow-ports'
import {
  createReviewingJobPosting,
  identifyJobRequirements,
  updateJobPosting,
} from './job-requirement'
import {
  correctSourceProfileFact,
  createReviewingSourceProfile,
  decideSourceProfileFacts,
  resolveSourceProfileFactConflict,
} from './source-profile'

type ResumeTailoringDependencies = Readonly<{
  candidateSessionClock: CandidateSessionClock
  candidateSessionIdentity: CandidateSessionIdentity
  candidateSessionPersistence: CandidateSessionPersistence
  jobRequirementExtractor?: JobRequirementExtractor
  jobRequirementGroupIdentity?: JobRequirementGroupIdentity
  jobRequirementIdentity?: JobRequirementIdentity
  sourceDocumentReader?: SourceDocumentReader
  sourceProfileFactIdentity?: SourceProfileFactIdentity
  sourceProfileExtractor?: SourceProfileExtractor
  telemetry: PrivacySafeTelemetry
}>

type ReadyResumeTailoringState = Extract<
  ResumeTailoringState,
  { readonly status: 'ready' }
>
type SourceProfileFactCommand = Exclude<ResumeTailoringCommand,
  | { readonly type: 'open-workflow' }
  | { readonly type: 'delete-session' }
  | { readonly type: 'import-source-document' }
  | { readonly type: 'update-source-content' }
  | { readonly type: 'confirm-processing-notice' }
  | { readonly type: 'extract-source-profile' }
  | { readonly type: 'review-job-posting' }
  | { readonly type: 'update-job-posting-content' }
  | { readonly type: 'confirm-job-posting-processing-notice' }
  | { readonly type: 'extract-job-requirements' }
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
    if (command.type === 'open-workflow') return this.#openWorkflow()
    if (command.type === 'delete-session') return this.#deleteSession()
    if (command.type === 'import-source-document') return this.#importSourceDocument(command)
    if (command.type === 'update-source-content') {
      return this.#updateSourceContent(command)
    }
    if (command.type === 'confirm-processing-notice') return this.#confirmProcessingNotice()
    if (command.type === 'extract-source-profile') return this.#extractSourceProfile()
    if (command.type === 'review-job-posting') return this.#reviewJobPosting(command)
    if (command.type === 'update-job-posting-content') {
      return this.#updateJobPostingContent(command)
    }
    if (command.type === 'confirm-job-posting-processing-notice') {
      return this.#confirmJobPostingProcessingNotice()
    }
    if (command.type === 'extract-job-requirements') return this.#extractJobRequirements()
    return this.#executeSourceProfileFactCommand(command)
  }

  async #reviewJobPosting(
    { content }: Extract<ResumeTailoringCommand, { readonly type: 'review-job-posting' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReadyState(currentState) || currentState.value.jobPosting !== undefined) {
      return unavailableResult
    }
    return this.#persistJobPosting({
      currentState: currentState.value,
      jobPosting: createReviewingJobPosting({ content }),
    })
  }

  async #updateJobPostingContent(
    { outgoingContent }: Extract<ResumeTailoringCommand, {
      readonly type: 'update-job-posting-content'
    }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasJobPosting(currentState)) return unavailableResult
    return this.#persistJobPosting({
      currentState: currentState.value,
      jobPosting: updateJobPosting({
        jobPosting: currentState.value.jobPosting,
        outgoingContent,
      }),
    })
  }

  async #confirmJobPostingProcessingNotice(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingJobPosting(currentState)) return unavailableResult
    return this.#persistJobPosting({
      currentState: currentState.value,
      jobPosting: {
        ...currentState.value.jobPosting,
        processingNotice: {
          ...jobPostingProcessingPolicy,
          version: jobPostingProcessingNoticeVersion,
          confirmedAt: this.#dependencies.candidateSessionClock.now(),
        },
      },
    })
  }

  async #extractJobRequirements(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingJobPosting(currentState)) return unavailableResult
    if (!hasCurrentJobPostingProcessingConsent({ jobPosting: currentState.value.jobPosting })) {
      return processingNoticeRequiredResult
    }
    const extraction = await this.#requestJobRequirementExtraction({
      jobPosting: currentState.value.jobPosting,
    })
    if (!extraction.ok) return extraction
    return this.#persistExtractedJobRequirements({
      currentState: currentState.value,
      requirements: extraction.value,
    })
  }

  async #requestJobRequirementExtraction({ jobPosting }: Readonly<{
    jobPosting: JobPostingReview
  }>) {
    const extractor = this.#dependencies.jobRequirementExtractor
    const groupIdentity = this.#dependencies.jobRequirementGroupIdentity
    const requirementIdentity = this.#dependencies.jobRequirementIdentity
    if (extractor === undefined || groupIdentity === undefined || requirementIdentity === undefined) {
      return jobRequirementExtractionUnavailableResult
    }
    const extraction = await extractor.extract({ jobPostingContent: jobPosting.outgoingContent })
    if (!extraction.ok) return extraction
    const requirements = identifyJobRequirements({
      contents: extraction.value, groupIdentity, requirementIdentity,
    })
    return requirements === null
      ? jobRequirementExtractionUnavailableResult
      : { ok: true, value: requirements } as const
  }

  #persistExtractedJobRequirements({ currentState, requirements }: Readonly<{
    currentState: ReadyResumeTailoringState & { readonly jobPosting: JobPostingReview }
    requirements: readonly JobRequirement[]
  }>) {
    return this.#persistJobPosting({
      currentState,
      jobPosting: { ...currentState.jobPosting, status: 'reviewing-requirements', requirements },
    })
  }

  #executeSourceProfileFactCommand(command: SourceProfileFactCommand) {
    if (command.type === 'confirm-source-fact') {
      return this.#decideSourceProfileFacts({ factIds: [command.factId], status: 'verified' })
    }
    if (command.type === 'confirm-source-facts') {
      return this.#decideSourceProfileFacts({ factIds: command.factIds, status: 'verified' })
    }
    if (command.type === 'correct-source-fact') return this.#correctSourceProfileFact(command)
    if (command.type === 'resolve-source-fact-conflict') {
      return this.#resolveSourceProfileFactConflict(command)
    }
    return this.#decideSourceProfileFacts({ factIds: [command.factId], status: 'rejected' })
  }

  async #resolveSourceProfileFactConflict({
    selectedFactId,
  }: Extract<ResumeTailoringCommand, {
    readonly type: 'resolve-source-fact-conflict'
  }>): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingFacts(currentState)) return sourceProfileFactUnavailableResult
    const transition = resolveSourceProfileFactConflict({
      facts: currentState.value.sourceProfile.facts,
      selectedFactId,
    })
    return this.#persistFactTransition({ currentState: currentState.value, transition })
  }

  async #correctSourceProfileFact(
    command: Extract<ResumeTailoringCommand, { readonly type: 'correct-source-fact' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingFacts(currentState)) return sourceProfileFactUnavailableResult
    const identity = this.#dependencies.sourceProfileFactIdentity?.create()
    if (identity === undefined || !identity.ok) return sourceProfileFactUnavailableResult
    const transition = correctSourceProfileFact({
      correctedValue: command.correctedValue,
      factId: command.factId,
      facts: currentState.value.sourceProfile.facts,
      newFactId: identity.value,
    })
    return this.#persistFactTransition({ currentState: currentState.value, transition })
  }

  async #decideSourceProfileFacts({
    factIds,
    status,
  }: Readonly<{
    factIds: readonly SourceProfileFactId[]
    status: 'verified' | 'rejected'
  }>): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingFacts(currentState)) return sourceProfileFactUnavailableResult
    const transition = decideSourceProfileFacts({
      facts: currentState.value.sourceProfile.facts,
      factIds,
      status,
    })
    return this.#persistFactTransition({ currentState: currentState.value, transition })
  }

  #persistFactTransition({
    currentState,
    transition,
  }: Readonly<{
    currentState: ReadyResumeTailoringState & { readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']> }
    transition: ReturnType<typeof decideSourceProfileFacts>
  }>) {
    if (!transition.ok) {
      return Promise.resolve(transition.error === 'conflict'
        ? sourceProfileFactConflictResult
        : sourceProfileFactUnavailableResult)
    }
    return this.#persistSourceProfile({
      currentState,
      sourceProfile: { ...currentState.sourceProfile, facts: transition.value },
    })
  }

  async #extractSourceProfile(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingSourceProfile(currentState)) return unavailableResult
    if (currentState.value.sourceProfile.processingNotice?.version
      !== sourceProfileProcessingNoticeVersion) return processingNoticeRequiredResult
    const extractor = this.#dependencies.sourceProfileExtractor
    const sourceProfileFactIdentity = this.#dependencies.sourceProfileFactIdentity
    if (extractor === undefined || sourceProfileFactIdentity === undefined) return unavailableResult

    const extractedFacts = await extractor.extract({ professionalContent:
      currentState.value.sourceProfile.outgoingContent })
    if (!extractedFacts.ok) return extractedFacts
    const facts = identifySourceProfileFacts({ factContents: extractedFacts.value,
      sourceProfileFactIdentity })
    if (facts === null) return unavailableResult
    return this.#persistExtractedFacts({ currentState: currentState.value, facts })
  }

  #persistExtractedFacts({ currentState, facts }: Readonly<{
    currentState: ReadyResumeTailoringState & { readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']> }
    facts: readonly SourceProfileFact[]
  }>) {
    return this.#persistSourceProfile({
      currentState,
      sourceProfile: {
        ...currentState.sourceProfile,
        status: 'reviewing-facts',
        facts,
      },
    })
  }

  async #confirmProcessingNotice(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingSourceProfile(currentState)) return unavailableResult
    return this.#persistSourceProfile({
      currentState: currentState.value,
      sourceProfile: {
        ...currentState.value.sourceProfile,
        processingNotice: {
          version: sourceProfileProcessingNoticeVersion,
          confirmedAt: this.#dependencies.candidateSessionClock.now(),
        },
      },
    })
  }

  async #updateSourceContent(
    { outgoingContent }: Extract<ResumeTailoringCommand, { readonly type: 'update-source-content' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingSourceProfile(currentState)) return unavailableResult
    return this.#persistSourceProfile({
      currentState: currentState.value,
      sourceProfile: {
        ...currentState.value.sourceProfile,
        outgoingContent,
        processingNotice: null,
      },
    })
  }

  async #importSourceDocument(
    { document }: Extract<ResumeTailoringCommand, { readonly type: 'import-source-document' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!currentState.ok || currentState.value.status !== 'ready') return unavailableResult
    if (currentState.value.sourceProfile !== undefined) return unavailableResult
    const reader = this.#dependencies.sourceDocumentReader
    if (reader === undefined) return unavailableResult

    const documentText = await reader.read(document)
    if (!documentText.ok) return documentText
    return this.#persistImportedSourceDocument({ currentState: currentState.value, document, documentText: documentText.value })
  }

  async #persistImportedSourceDocument({ currentState, document, documentText }: Readonly<{
    currentState: ReadyResumeTailoringState
    document: Extract<ResumeTailoringCommand, { readonly type: 'import-source-document' }>['document']
    documentText: string
  }>) {
    const sourceProfile = createReviewingSourceProfile({
      documentName: document.name,
      documentText,
    })
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.sessionId,
      state: { ...currentState, sourceProfile },
    })
    return persistedState.ok ? persistedState : unavailableResult
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

  async #persistSourceProfile({
    currentState,
    sourceProfile,
  }: Readonly<{
    currentState: ReadyResumeTailoringState
    sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }>) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.sessionId,
      state: { ...currentState, sourceProfile },
    })
    return persistedState.ok ? persistedState : unavailableResult
  }

  async #persistJobPosting({ currentState, jobPosting }: Readonly<{
    currentState: ReadyResumeTailoringState
    jobPosting: JobPostingReview
  }>) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.sessionId,
      state: { ...currentState, jobPosting },
    })
    return persistedState.ok ? persistedState : unavailableResult
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

function identifySourceProfileFacts({
  factContents,
  sourceProfileFactIdentity,
}: Readonly<{
  factContents: readonly SourceProfileFactContent[]
  sourceProfileFactIdentity: SourceProfileFactIdentity
}>): readonly SourceProfileFact[] | null {
  const facts = factContents.map((factContent) => {
    const identity = sourceProfileFactIdentity.create()
    return identity.ok
      ? { ...factContent, id: identity.value, status: 'extracted' as const }
      : null
  })
  return facts.includes(null) ? null : facts.filter((fact) => fact !== null)
}

function hasReviewingSourceProfile(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ReadyResumeTailoringState & {
    readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }
}> {
  return result.ok
    && result.value.status === 'ready'
    && result.value.sourceProfile?.status === 'reviewing-document'
}

function hasReviewingFacts(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ReadyResumeTailoringState & {
    readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }
}> {
  return result.ok
    && result.value.status === 'ready'
    && result.value.sourceProfile?.status === 'reviewing-facts'
}

function hasReadyState(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{ ok: true; value: ReadyResumeTailoringState }> {
  return result.ok && result.value.status === 'ready'
}

function hasReviewingJobPosting(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ReadyResumeTailoringState & { readonly jobPosting: JobPostingReview }
}> {
  return hasReadyState(result) && result.value.jobPosting?.status === 'reviewing-posting'
}

function hasJobPosting(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ReadyResumeTailoringState & { readonly jobPosting: JobPostingReview }
}> {
  return hasReadyState(result) && result.value.jobPosting !== undefined
}

const workflowAlreadyOpenResult = {
  ok: false,
  error: { type: 'workflow-already-open' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const unavailableResult = {
  ok: false,
  error: { type: 'candidate-session-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const processingNoticeRequiredResult = {
  ok: false,
  error: { type: 'processing-notice-required' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const sourceProfileFactUnavailableResult = {
  ok: false,
  error: { type: 'source-fact-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const sourceProfileFactConflictResult = {
  ok: false,
  error: { type: 'source-fact-conflict' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const jobRequirementExtractionUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-extraction-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>
