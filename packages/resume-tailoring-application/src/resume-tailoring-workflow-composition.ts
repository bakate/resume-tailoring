import {
  hasCandidateSessionExpired,
  openResumeTailoringWorkflow,
} from '@resume-tailoring/domain/resume-tailoring-state'
import type {
  CandidateSessionId,
  JobPostingHistoryItem,
  JobPostingReview,
  JobRequirement,
  MatchAnalysis,
  ResumeClaim,
  ResumeTailoringState,
  SourceProfileFact,
  SourceProfileFactId,
  TailoredResume,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  ResumeTailoringCommand,
  ResumeTailoringFailure,
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from './resume-tailoring-workflow'
import { isExactTargetRoleTitle } from './job-posting-target-role'
import { sourceProfileProcessingNoticeVersion } from './resume-tailoring-workflow'
import { hasSourceProfileFactConflict } from './resume-tailoring-workflow'
import { jobPostingProcessingNoticeVersion } from './resume-tailoring-workflow'
import { jobPostingProcessingPolicy } from './resume-tailoring-workflow'
import { hasCurrentJobPostingProcessingConsent } from './resume-tailoring-workflow'
import type {
  CandidateSessionClock,
  CandidateSessionIdentity,
  CandidateSessionPersistence,
  PrivacySafeTelemetry,
  journeyPhases,
  SourceDocumentReader,
  SourceProfileFactIdentity,
  SourceProfileExtractor,
  SourceProfileExtractedFact,
  JobRequirementExtractor,
  JobRequirementGroupIdentity,
  JobRequirementIdentity,
  MatchEvidenceMatcher,
  MatchScoreBand,
  PrivacySafeTelemetryEvent,
  ResumeClaimIdentity,
  ResumeClaimSemanticValidator,
  ResumeClaimWriter,
} from './resume-tailoring-workflow-ports'
import { createResumeClaimGeneration } from './resume-claim-generation'
import type { ResumeClaimSource } from './resume-claim-generation'
import { validateProposedResumeClaim } from './resume-claims'
import { createMatchAnalysis } from './match-analysis'
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
  matchEvidenceMatcher?: MatchEvidenceMatcher
  resumeClaimIdentity?: ResumeClaimIdentity
  resumeClaimSemanticValidator?: ResumeClaimSemanticValidator
  resumeClaimWriter?: ResumeClaimWriter
  sourceDocumentReader?: SourceDocumentReader
  sourceProfileFactIdentity?: SourceProfileFactIdentity
  sourceProfileExtractor?: SourceProfileExtractor
  telemetry: PrivacySafeTelemetry
}>

type ReadyResumeTailoringState = Extract<
  ResumeTailoringState,
  { readonly status: 'ready' }
>
type OutcomeReadyState = ReadyResumeTailoringState & {
  readonly matchAnalysis: MatchAnalysis
  readonly tailoredResume: TailoredResume
}
type OutcomeEventWithoutMatchScore =
  | Readonly<{
      name: 'resume-usefulness-rated'
      comment?: string
      useful: boolean
    }>
  | Readonly<{ name: 'resume-downloaded' }>
type CorrectionKind = Extract<
  PrivacySafeTelemetryEvent,
  { readonly name: 'resume-correction-recorded' }
>['correctionKind']
type JourneyPhase = typeof journeyPhases[number]
type SourceProfileFactCommand = Exclude<ResumeTailoringCommand,
  | { readonly type: 'open-workflow' }
  | { readonly type: 'delete-session' }
  | { readonly type: 'import-source-document' }
  | { readonly type: 'update-source-content' }
  | { readonly type: 'confirm-processing-notice' }
  | { readonly type: 'confirm-processing-and-extract-source-profile' }
  | { readonly type: 'extract-source-profile' }
  | { readonly type: 'enrich-source-profile' }
  | { readonly type: 'review-job-posting' }
  | { readonly type: 'start-new-job-posting' }
  | { readonly type: 'update-job-posting-content' }
  | { readonly type: 'update-target-role' }
  | { readonly type: 'confirm-job-posting-processing-notice' }
  | { readonly type: 'extract-job-requirements' }
  | { readonly type: 'analyze-match' }
  | { readonly type: 'generate-resume-claims' }
  | { readonly type: 'remove-resume-claim' }
  | { readonly type: 'move-resume-claim' }
  | { readonly type: 'reformulate-resume-claim' }
  | { readonly type: 'edit-resume-claim' }
  | { readonly type: 'confirm-resume-claim-edit' }
  | { readonly type: 'rate-tailored-resume-usefulness' }
  | { readonly type: 'record-tailored-resume-download' }
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
      void this.#notifyCurrentState()
    })
  }

  execute(command: ResumeTailoringCommand) {
    if (command.type === 'delete-session') return this.#deleteSession()
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

  async #executeCommand(command: ResumeTailoringCommand) {
    const result = await this.#executeCommandOnce(command)
    if (!shouldRetryCommand({ command, result })) return result
    return this.#executeCommandOnce(command)
  }

  #executeCommandOnce(command: ResumeTailoringCommand) {
    if (command.type === 'open-workflow') return this.#openWorkflow()
    if (command.type === 'delete-session') return this.#deleteSession()
    if (command.type === 'import-source-document') return this.#importSourceDocument(command)
    if (command.type === 'update-source-content') {
      return this.#updateSourceContent(command)
    }
    if (command.type === 'confirm-processing-notice') return this.#confirmProcessingNotice()
    if (command.type === 'confirm-processing-and-extract-source-profile') {
      return this.#confirmProcessingAndExtractSourceProfile()
    }
    if (command.type === 'extract-source-profile') return this.#extractSourceProfile()
    if (command.type === 'enrich-source-profile') return this.#enrichSourceProfile(command)
    if (command.type === 'review-job-posting') return this.#reviewJobPosting(command)
    if (command.type === 'start-new-job-posting') return this.#startNewJobPosting()
    if (command.type === 'update-job-posting-content') {
      return this.#updateJobPostingContent(command)
    }
    if (command.type === 'update-target-role') return this.#updateTargetRole(command)
    if (command.type === 'confirm-job-posting-processing-notice') {
      return this.#confirmJobPostingProcessingNotice()
    }
    if (command.type === 'extract-job-requirements') return this.#extractJobRequirements()
    if (command.type === 'analyze-match') return this.#analyzeMatch()
    if (command.type === 'generate-resume-claims') return this.#generateResumeClaims(command)
    if (command.type === 'remove-resume-claim') return this.#removeResumeClaim(command)
    if (command.type === 'move-resume-claim') return this.#moveResumeClaim(command)
    if (command.type === 'reformulate-resume-claim') {
      return this.#reformulateResumeClaim(command)
    }
    if (command.type === 'edit-resume-claim') return this.#editResumeClaim(command)
    if (command.type === 'confirm-resume-claim-edit') {
      return this.#confirmResumeClaimEdit(command)
    }
    if (command.type === 'rate-tailored-resume-usefulness') {
      return this.#recordTailoredResumeOutcome({ ...command, name: 'resume-usefulness-rated' })
    }
    if (command.type === 'record-tailored-resume-download') {
      return this.#recordTailoredResumeOutcome({ name: 'resume-downloaded' })
    }
    return this.#executeSourceProfileFactCommand(command)
  }

  async #recordTailoredResumeOutcome(event: OutcomeEventWithoutMatchScore) {
    const currentState = await this.#readActiveState()
    if (!hasOutcomeInputs(currentState)) return resumeClaimUnavailableResult
    if (event.name === 'resume-downloaded') {
      await this.#recordOutcomeWithMatchScore({ event, state: currentState.value })
      return this.#persistCurrentJobPostingDownload(currentState.value)
    }
    if (currentState.value.currentJobPostingStatus !== 'pdf-downloaded') {
      return resumeClaimUnavailableResult
    }
    return this.#persistOutcomeFeedback({ event, state: currentState.value })
  }

  async #persistCurrentJobPostingDownload(state: OutcomeReadyState) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: state.sessionId,
      state: { ...state, currentJobPostingStatus: 'pdf-downloaded' },
    })
    return persistedState.ok ? persistedState : unavailableResult
  }

  async #startNewJobPosting(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasCompletedMatchAnalysis(currentState)) return matchAnalysisUnavailableResult
    const historyItem = createJobPostingHistoryItem({ state: currentState.value })
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.value.sessionId,
      state: {
        ...currentState.value,
        currentJobPostingStatus: undefined,
        jobPosting: undefined,
        jobPostingHistory: [...(currentState.value.jobPostingHistory ?? []), historyItem],
        matchAnalysis: undefined,
        tailoredResume: undefined,
      },
    })
    return persistedState.ok ? persistedState : unavailableResult
  }

  async #persistOutcomeFeedback({ event, state }: Readonly<{
    event: Exclude<OutcomeEventWithoutMatchScore, { readonly name: 'resume-downloaded' }>
    state: OutcomeReadyState
  }>) {
    const outcomeFeedback = addOutcomeFeedback({ event, state })
    if (outcomeFeedback === null) return { ok: true, value: state } as const
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: state.sessionId, state: { ...state, outcomeFeedback },
    })
    if (!persistedState.ok) return unavailableResult
    await this.#recordOutcomeWithMatchScore({ event, state })
    return persistedState
  }

  #recordOutcomeWithMatchScore({ event, state }: Readonly<{
    event: OutcomeEventWithoutMatchScore
    state: OutcomeReadyState
  }>) {
    if (event.name === 'resume-usefulness-rated') {
      return this.#dependencies.telemetry.record({
        name: event.name,
        hasComment: event.comment?.trim().length !== 0 && event.comment !== undefined,
        matchScoreBand: readMatchScoreBand(state.matchAnalysis.matchScore),
        useful: event.useful,
      })
    }
    return this.#dependencies.telemetry.record({
      ...event, matchScoreBand: readMatchScoreBand(state.matchAnalysis.matchScore),
    })
  }

  async #generateResumeClaims(
    { locale }: Extract<ResumeTailoringCommand, { readonly type: 'generate-resume-claims' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasResumeClaimInputs(currentState)) return resumeClaimUnavailableResult
    const generation = createResumeClaimGenerationFrom(this.#dependencies)
    if (generation === null) return resumeClaimUnavailableResult
    const result = await generation.generate(createResumeClaimSource({
      locale,
      state: currentState.value,
    }))
    if (!result.ok) return result
    return this.#persistTailoredResume({
      currentState: currentState.value,
      claims: result.value.claims,
      exclusions: result.value.exclusions,
      locale,
    })
  }

  async #removeResumeClaim(
    { claimId }: Extract<ResumeTailoringCommand, { readonly type: 'remove-resume-claim' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasTailoredResume(currentState)) return resumeClaimUnavailableResult
    const claims = currentState.value.tailoredResume.claims
      .filter((claim) => claim.id !== claimId)
    if (claims.length === currentState.value.tailoredResume.claims.length) {
      return resumeClaimUnavailableResult
    }
    const result = await this.#persistTailoredResume({
      currentState: currentState.value,
      claims,
      exclusions: currentState.value.tailoredResume.exclusions,
    })
    if (result.ok) {
      await this.#recordCorrection({
        correctionKind: 'resume-claim-removal',
        matchAnalysis: currentState.value.matchAnalysis,
      })
    }
    return result
  }

  async #moveResumeClaim(
    command: Extract<ResumeTailoringCommand, { readonly type: 'move-resume-claim' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasTailoredResume(currentState)) return resumeClaimUnavailableResult
    const claims = moveResumeClaim({
      claims: currentState.value.tailoredResume.claims,
      ...command,
    })
    if (claims === null) return resumeClaimUnavailableResult
    const result = await this.#persistTailoredResume({
      currentState: currentState.value,
      claims,
      exclusions: currentState.value.tailoredResume.exclusions,
    })
    if (result.ok) {
      await this.#recordCorrection({
        correctionKind: 'resume-claim-reorder',
        matchAnalysis: currentState.value.matchAnalysis,
      })
    }
    return result
  }

  async #reformulateResumeClaim(
    command: Extract<ResumeTailoringCommand, { readonly type: 'reformulate-resume-claim' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasTailoredResume(currentState) || command.request.trim().length === 0) {
      return resumeClaimUnavailableResult
    }
    const operation = prepareResumeClaimReformulation({
      command, dependencies: this.#dependencies, state: currentState.value,
    })
    if (operation === null) return resumeClaimUnavailableResult
    const validation = await operation.generation.reformulate({
      claim: operation.claim, source: operation.source, request: command.request,
    })
    if (!validation.ok) return validation
    if (validation.claim === null) return resumeClaimUnavailableResult
    const result = await this.#persistReformulatedResumeClaim({
      command, state: currentState.value, validation,
    })
    if (result.ok) {
      await this.#recordCorrection({
        correctionKind: 'resume-claim-reformulation',
        matchAnalysis: currentState.value.matchAnalysis,
      })
    }
    return result
  }

  async #editResumeClaim(
    command: Extract<ResumeTailoringCommand, { readonly type: 'edit-resume-claim' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasTailoredResume(currentState)) return resumeClaimUnavailableResult
    const edit = createSupportedClaimEdit({ command, state: currentState.value })
    const validator = this.#dependencies.resumeClaimSemanticValidator
    if (edit === null || validator === undefined) return resumeClaimUnavailableResult
    if (edit.status === 'confirmation-required') {
      return resumeClaimNewFactConfirmationRequiredResult
    }
    const validation = await validator.validate(edit.validationRequest)
    if (!validation.ok) return validation
    if (!validation.value.supported) return resumeClaimNewFactConfirmationRequiredResult
    return this.#persistEditedResumeClaim({ claim: edit.claim, state: currentState.value })
  }

  async #confirmResumeClaimEdit(
    command: Extract<ResumeTailoringCommand, { readonly type: 'confirm-resume-claim-edit' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasTailoredResume(currentState)) return resumeClaimUnavailableResult
    const preparedEdit = prepareConfirmedClaimEdit({
      command, dependencies: this.#dependencies, state: currentState.value,
    })
    if (!preparedEdit.ok) return preparedEdit.result
    const result = await this.#persistConfirmedClaimEdit({
      state: currentState.value,
      ...preparedEdit.value,
    })
    if (!result.ok) return result
    await this.#recordCorrection({
      correctionKind: 'resume-claim-edit',
      matchAnalysis: currentState.value.matchAnalysis,
    })
    return result
  }

  async #persistEditedResumeClaim({ claim, state }: Readonly<{
    claim: ResumeClaim
    state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
  }>) {
    const tailoredResume = replaceResumeClaim({
      claim,
      claimId: claim.id,
      tailoredResume: state.tailoredResume,
    })
    const result = await this.#persistTailoredResume({ currentState: state, ...tailoredResume })
    if (result.ok) {
      await this.#recordCorrection({
        correctionKind: 'resume-claim-edit',
        matchAnalysis: state.matchAnalysis,
      })
    }
    return result
  }

  async #persistConfirmedClaimEdit({ fact, matchAnalysis, state, tailoredResume }: Readonly<{
    fact: SourceProfileFact
    matchAnalysis: MatchAnalysis
    state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
    tailoredResume: TailoredResume
  }>) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: state.sessionId,
      state: {
        ...state,
        matchAnalysis,
        sourceProfile: { ...state.sourceProfile, facts: [...state.sourceProfile.facts, fact] },
        tailoredResume,
      },
    })
    return persistedState.ok ? persistedState : unavailableResult
  }

  #persistReformulatedResumeClaim({ command, state, validation }: Readonly<{
    command: Extract<ResumeTailoringCommand, { readonly type: 'reformulate-resume-claim' }>
    state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
    validation: Readonly<{ claim: ResumeClaim | null }>
  }>) {
    const tailoredResume = replaceResumeClaim({
      claim: validation.claim,
      claimId: command.claimId,
      tailoredResume: state.tailoredResume,
    })
    return this.#persistTailoredResume({ currentState: state, ...tailoredResume })
  }

  async #persistTailoredResume({
    claims,
    currentState,
    exclusions,
    locale,
  }: Readonly<{
    claims: readonly ResumeClaim[]
    currentState: ReadyResumeTailoringState
    exclusions: TailoredResume['exclusions']
    locale?: TailoredResume['locale']
  }>) {
    const tailoredResumeLocale = locale ?? currentState.tailoredResume?.locale ?? 'en'
    const latestState = await this.#readActiveState()
    const concurrentOutcome = readConcurrentOutcome({ currentState, latestState })
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.sessionId,
      state: {
        ...currentState,
        ...concurrentOutcome,
        currentJobPostingStatus: concurrentOutcome.currentJobPostingStatus === 'pdf-downloaded'
          ? 'pdf-downloaded' : 'draft-generated',
        tailoredResume: { claims, exclusions, locale: tailoredResumeLocale },
      },
    })
    if (!persistedState.ok) return unavailableResult
    if (currentState.tailoredResume === undefined) {
      await this.#recordJourneyPhase('tailored-resume-preparation')
    }
    return persistedState
  }

  async #analyzeMatch(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (requiresSourceProcessingConsent(currentState)) return processingNoticeRequiredResult
    if (!hasMatchInputs(currentState)) return matchAnalysisUnavailableResult
    if (!hasCurrentMatchProcessingConsent({ state: currentState.value })) {
      return processingNoticeRequiredResult
    }
    const matcher = this.#dependencies.matchEvidenceMatcher
    if (matcher === undefined) return matchAnalysisUnavailableResult
    const matchAnalysis = await requestMatchAnalysis({ matcher, state: currentState.value })
    if (!matchAnalysis.ok) return matchAnalysis
    return this.#persistMatchAnalysis({
      currentState: currentState.value, matchAnalysis: matchAnalysis.value,
    })
  }

  async #enrichSourceProfile(
    command: Extract<ResumeTailoringCommand, { readonly type: 'enrich-source-profile' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasMatchInputs(currentState)) return matchAnalysisUnavailableResult
    if (!hasCurrentMatchProcessingConsent({ state: currentState.value })) {
      return processingNoticeRequiredResult
    }
    const fact = createCandidateAuthoredFact({
      facts: currentState.value.sourceProfile.facts,
      identity: this.#dependencies.sourceProfileFactIdentity,
      kind: command.kind,
      value: command.value,
    })
    if (!fact.ok) return fact.result
    const matcher = this.#dependencies.matchEvidenceMatcher
    if (matcher === undefined) return matchAnalysisUnavailableResult
    const enrichedState = appendCandidateFact({ fact: fact.value, state: currentState.value })
    const matchAnalysis = await requestMatchAnalysis({ matcher, state: enrichedState })
    if (!matchAnalysis.ok) return matchAnalysis
    return this.#persistMatchAnalysis({ currentState: enrichedState, matchAnalysis: matchAnalysis.value })
  }

  async #persistMatchAnalysis({ currentState, matchAnalysis }: Readonly<{
    currentState: ReadyResumeTailoringState
    matchAnalysis: MatchAnalysis
  }>) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.sessionId,
      state: {
        ...currentState,
        currentJobPostingStatus: 'analyzed',
        matchAnalysis,
        tailoredResume: undefined,
      },
    })
    if (!persistedState.ok) return unavailableResult
    await this.#recordJourneyPhase('job-match')
    return persistedState
  }

  async #reviewJobPosting(
    { content }: Extract<ResumeTailoringCommand, { readonly type: 'review-job-posting' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReadyState(currentState) || currentState.value.jobPosting !== undefined) {
      return unavailableResult
    }
    const jobPosting = createReviewingJobPosting({ content })
    return this.#persistJobPosting({
      currentState: currentState.value,
      jobPosting: applyCandidateSessionConsent({
        confirmedAt: readCurrentProcessingConsentTimestamp({ state: currentState.value }),
        jobPosting,
      }),
    })
  }

  async #updateJobPostingContent(
    { outgoingContent }: Extract<ResumeTailoringCommand, {
      readonly type: 'update-job-posting-content'
    }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasJobPosting(currentState)) return unavailableResult
    const jobPosting = updateJobPosting({
      jobPosting: currentState.value.jobPosting,
      outgoingContent,
    })
    return this.#persistJobPosting({
      currentState: currentState.value,
      jobPosting: applyCandidateSessionConsent({
        confirmedAt: readCurrentProcessingConsentTimestamp({ state: currentState.value }),
        jobPosting,
      }),
    })
  }

  async #updateTargetRole(
    { value }: Extract<ResumeTailoringCommand, { readonly type: 'update-target-role' }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    const targetRoleValue = value.trim()
    if (!hasJobPosting(currentState)
      || currentState.value.jobPosting.status !== 'reviewing-requirements'
      || !isExactTargetRoleTitle({
        jobPostingContent: currentState.value.jobPosting.outgoingContent,
        value: targetRoleValue,
      })) {
      return unavailableResult
    }
    return this.#persistJobPosting({
      currentState: currentState.value,
      jobPosting: {
        ...currentState.value.jobPosting,
        targetRole: { sourceExcerpt: targetRoleValue, value: targetRoleValue },
      },
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
      practicalConstraints: extraction.value.practicalConstraints,
      requirements: extraction.value.requirements,
      targetRole: extraction.value.targetRole,
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
      contents: extraction.value.requirements, groupIdentity, requirementIdentity,
    })
    return requirements === null
      ? jobRequirementExtractionUnavailableResult
      : {
          ok: true,
          value: {
            practicalConstraints: extraction.value.practicalConstraints,
            requirements,
            targetRole: extraction.value.targetRole,
          },
        } as const
  }

  #persistExtractedJobRequirements({
    currentState,
    practicalConstraints,
    requirements,
    targetRole,
  }: Readonly<{
    currentState: ReadyResumeTailoringState & { readonly jobPosting: JobPostingReview }
    practicalConstraints: JobPostingReview['practicalConstraints']
    requirements: readonly JobRequirement[]
    targetRole: JobPostingReview['targetRole']
  }>) {
    return this.#persistJobPosting({
      currentState,
      jobPosting: {
        ...currentState.jobPosting,
        status: 'reviewing-requirements',
        practicalConstraints,
        requirements,
        targetRole,
      },
    })
  }

  #executeSourceProfileFactCommand(command: SourceProfileFactCommand) {
    if (command.type === 'correct-source-fact') return this.#correctSourceProfileFact(command)
    if (command.type === 'resolve-source-fact-conflict') {
      return this.#resolveSourceProfileFactConflict(command)
    }
    return this.#rejectSourceProfileFact({ factId: command.factId })
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
    const result = await this.#persistFactTransition({ currentState: currentState.value, transition })
    if (result.ok) {
      await this.#recordCorrection({
        correctionKind: 'source-profile-fact',
        matchAnalysis: currentState.value.matchAnalysis,
      })
    }
    return result
  }

  #recordCorrection({ correctionKind, matchAnalysis }: Readonly<{
    correctionKind: CorrectionKind
    matchAnalysis?: MatchAnalysis
  }>) {
    const matchScoreBand = matchAnalysis === undefined
      ? {} : { matchScoreBand: readMatchScoreBand(matchAnalysis.matchScore) }
    return this.#dependencies.telemetry.record({
      name: 'resume-correction-recorded', correctionKind, ...matchScoreBand,
    })
  }

  #recordJourneyPhase(phase: JourneyPhase) {
    return this.#dependencies.telemetry.record({
      name: 'candidate-journey-phase-reached', phase,
    })
  }

  async #rejectSourceProfileFact({ factId }: Readonly<{
    factId: SourceProfileFactId
  }>): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingFacts(currentState)) return sourceProfileFactUnavailableResult
    const transition = decideSourceProfileFacts({
      facts: currentState.value.sourceProfile.facts,
      factIds: [factId],
      status: 'rejected',
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
    const nextState = {
      ...currentState,
      currentJobPostingStatus: undefined,
      sourceProfile: { ...currentState.sourceProfile, facts: transition.value },
      tailoredResume: undefined,
    }
    const nextStateResult = { ok: true, value: nextState } as const
    if (!hasMatchInputs(nextStateResult) || currentState.matchAnalysis === undefined) {
      return this.#persistSourceProfile({
        currentState,
        sourceProfile: nextState.sourceProfile,
      })
    }
    return this.#recalculateMatchAnalysisAfterFactChange({ state: nextStateResult.value })
  }

  async #recalculateMatchAnalysisAfterFactChange({ state }: Readonly<{
    state: ReadyResumeTailoringState & {
      readonly jobPosting: JobPostingReview & { readonly status: 'reviewing-requirements' }
      readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
    }
  }>) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: state.sessionId,
      state,
    })
    if (!persistedState.ok) return unavailableResult
    const matcher = this.#dependencies.matchEvidenceMatcher
    if (matcher === undefined) return persistedState
    const matchAnalysis = await requestMatchAnalysis({ matcher, state })
    if (!matchAnalysis.ok) return matchAnalysis
    const recalculatedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: state.sessionId,
      state: { ...state, currentJobPostingStatus: 'analyzed', matchAnalysis: matchAnalysis.value },
    })
    return recalculatedState.ok ? recalculatedState : unavailableResult
  }

  async #extractSourceProfile(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!hasReviewingSourceProfile(currentState)) return unavailableResult
    if (currentState.value.sourceProfile.processingNotice?.version
      !== sourceProfileProcessingNoticeVersion) return processingNoticeRequiredResult
    return this.#extractSourceProfileFrom({
      currentState: currentState.value,
      sourceProfile: currentState.value.sourceProfile,
    })
  }

  async #confirmProcessingAndExtractSourceProfile(): Promise<
    ResumeTailoringResult<ResumeTailoringView>
  > {
    const currentState = await this.#readActiveState()
    if (!hasReviewingSourceProfile(currentState)) return unavailableResult
    const sourceProfile = currentState.value.sourceProfile.processingNotice?.version
      === sourceProfileProcessingNoticeVersion
      ? currentState.value.sourceProfile
      : {
          ...currentState.value.sourceProfile,
          processingNotice: {
            version: sourceProfileProcessingNoticeVersion,
            confirmedAt: this.#dependencies.candidateSessionClock.now(),
          },
        }
    return this.#extractSourceProfileFrom({ currentState: currentState.value, sourceProfile })
  }

  async #extractSourceProfileFrom({ currentState, sourceProfile }: Readonly<{
    currentState: ReadyResumeTailoringState
    sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }>): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const extractor = this.#dependencies.sourceProfileExtractor
    const sourceProfileFactIdentity = this.#dependencies.sourceProfileFactIdentity
    if (extractor === undefined || sourceProfileFactIdentity === undefined) return unavailableResult

    const extractedFacts = await extractor.extract({ professionalContent:
      sourceProfile.outgoingContent })
    if (!extractedFacts.ok) return extractedFacts
    const facts = identifySourceProfileFacts({ extractedFacts: extractedFacts.value,
      sourceProfileFactIdentity })
    if (facts === null) return unavailableResult
    return this.#persistExtractedFacts({ currentState, facts, sourceProfile })
  }

  #persistExtractedFacts({ currentState, facts, sourceProfile }: Readonly<{
    currentState: ReadyResumeTailoringState
    facts: readonly SourceProfileFact[]
    sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }>) {
    return this.#persistSourceProfile({
      currentState,
      sourceProfile: {
        ...sourceProfile,
        status: 'reviewing-facts',
        facts,
      },
    }).then(async (result) => {
      if (result.ok) await this.#recordJourneyPhase('source-intake')
      return result
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
      state: { ...currentState, sourceProfile, matchAnalysis: undefined },
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
    await this.#dependencies.telemetry.record({ name: 'resume-tailoring-opened' })
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
      state: {
        ...currentState,
        currentJobPostingStatus: undefined,
        sourceProfile,
        matchAnalysis: undefined,
        tailoredResume: undefined,
      },
    })
    return persistedState.ok ? persistedState : unavailableResult
  }

  async #persistJobPosting({ currentState, jobPosting }: Readonly<{
    currentState: ReadyResumeTailoringState
    jobPosting: JobPostingReview
  }>) {
    const persistedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: currentState.sessionId,
      state: {
        ...currentState,
        currentJobPostingStatus: undefined,
        jobPosting,
        matchAnalysis: undefined,
        tailoredResume: undefined,
      },
    })
    return persistedState.ok ? persistedState : unavailableResult
  }

  async #deleteSession(): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const currentState = await this.#readActiveState()
    if (!currentState.ok || currentState.value.status === 'not-started') return currentState

    const deletedState = await this.#eraseSession(currentState.value.sessionId)
    if (!deletedState.ok) return deletedState

    this.#executionQueue = Promise.resolve()
    void this.#dependencies.telemetry.record({ name: 'candidate-session-deleted' })
      .then(ignoreResult, ignoreResult)
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
      return this.#migrateCandidateSession(persistedState)
    }
    if (persistedState.value.status !== 'ready') return persistedState
    return this.#expireSession(persistedState.value)
  }

  async #migrateCandidateSession(
    persistedState: Readonly<{ ok: true; value: ResumeTailoringState }>,
  ): Promise<ResumeTailoringResult<ResumeTailoringView>> {
    const migration = migrateCandidateSession({ state: persistedState.value })
    if (migration === null) return persistedState
    const updatedState = await this.#dependencies.candidateSessionPersistence.update({
      sessionId: migration.sessionId,
      state: migration,
    })
    return updatedState.ok ? updatedState : unavailableResult
  }

  async #expireSession(state: ReadyResumeTailoringState) {
    const deletedState = await this.#eraseSession(state.sessionId)
    if (!deletedState.ok) return deletedState

    await this.#dependencies.telemetry.record({ name: 'candidate-session-expired' })
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

function readConcurrentOutcome({ currentState, latestState }: Readonly<{
  currentState: ReadyResumeTailoringState
  latestState: ResumeTailoringResult<ResumeTailoringView>
}>): Pick<ReadyResumeTailoringState, 'currentJobPostingStatus' | 'outcomeFeedback'> {
  if (!latestState.ok || latestState.value.status !== 'ready'
    || latestState.value.sessionId !== currentState.sessionId) {
    return {
      currentJobPostingStatus: currentState.currentJobPostingStatus,
      outcomeFeedback: currentState.outcomeFeedback,
    }
  }
  return {
    currentJobPostingStatus: latestState.value.currentJobPostingStatus,
    outcomeFeedback: latestState.value.outcomeFeedback,
  }
}

function ignoreResult(): undefined {
  return undefined
}

function shouldRetryCommand({ command, result }: Readonly<{
  command: ResumeTailoringCommand
  result: ResumeTailoringResult<ResumeTailoringView>
}>) {
  return !result.ok
    && automaticRetryCommandTypes.has(command.type)
    && automaticRetryFailureTypes.has(result.error.type)
}

function readMatchScoreBand(matchScore: number): MatchScoreBand {
  if (matchScore < 25) return '0-24'
  if (matchScore < 50) return '25-49'
  if (matchScore < 75) return '50-74'
  return '75-100'
}

function addOutcomeFeedback({ event, state }: Readonly<{
  event: Exclude<OutcomeEventWithoutMatchScore, { readonly name: 'resume-downloaded' }>
  state: OutcomeReadyState
}>): NonNullable<ReadyResumeTailoringState['outcomeFeedback']> | null {
  if (state.outcomeFeedback !== undefined) return null
  const comment = event.comment?.trim()
  return {
    ...(comment === undefined || comment.length === 0 ? {} : { comment }),
    useful: event.useful,
  }
}

function identifySourceProfileFacts({
  extractedFacts,
  sourceProfileFactIdentity,
}: Readonly<{
  extractedFacts: readonly SourceProfileExtractedFact[]
  sourceProfileFactIdentity: SourceProfileFactIdentity
}>): readonly SourceProfileFact[] | null {
  const usableFacts = extractedFacts.filter((fact) => fact.assessment === 'usable')
  const identifiedFacts = usableFacts.map((extractedFact) => {
    const identity = sourceProfileFactIdentity.create()
    const factContent = {
      kind: extractedFact.kind,
      propositionKey: extractedFact.propositionKey,
      value: extractedFact.value,
    }
    return identity.ok
      ? { ...factContent, id: identity.value, status: 'verified' as const }
      : null
  })
  if (identifiedFacts.includes(null)) return null
  const facts = identifiedFacts.filter((fact) => fact !== null)
  return facts.map((fact) => ({
    ...fact,
    status: facts.some((candidateFact) => candidateFact.id !== fact.id
      && candidateFact.propositionKey === fact.propositionKey
      && candidateFact.value !== fact.value)
      ? 'extracted' as const
      : 'verified' as const,
  }))
}

function migrateCandidateSession({ state }: Readonly<{
  state: ResumeTailoringState
}>): ReadyResumeTailoringState | null {
  if (state.status !== 'ready' || state.sourceProfile?.status !== 'reviewing-facts') return null
  const sourceProfile = state.sourceProfile
  if (sourceProfile.processingNotice?.version !== sourceProfileProcessingNoticeVersion) {
    return {
      ...state,
      sourceProfile: {
        ...sourceProfile,
        status: 'reviewing-document',
        processingNotice: null,
        facts: [],
      },
      matchAnalysis: undefined,
      tailoredResume: undefined,
    }
  }
  const facts = sourceProfile.facts.map((fact) => (
    fact.status === 'extracted'
      && !hasSourceProfileFactConflict({ fact, facts: sourceProfile.facts })
      ? { ...fact, status: 'verified' as const }
      : fact
  ))
  if (facts.every((fact, factIndex) => fact === sourceProfile.facts[factIndex])) return null
  return {
    ...state,
    sourceProfile: { ...sourceProfile, facts },
    matchAnalysis: undefined,
    tailoredResume: undefined,
  }
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

function hasMatchInputs(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ReadyResumeTailoringState & {
    readonly jobPosting: JobPostingReview & { readonly status: 'reviewing-requirements' }
    readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }
}> {
  return hasReadyState(result)
    && result.value.jobPosting?.status === 'reviewing-requirements'
    && result.value.sourceProfile?.status === 'reviewing-facts'
}

function hasCompletedMatchAnalysis(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ReadyResumeTailoringState & {
    readonly jobPosting: JobPostingReview & { readonly status: 'reviewing-requirements' }
    readonly matchAnalysis: MatchAnalysis
    readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }
}> {
  return hasMatchInputs(result) && result.value.matchAnalysis !== undefined
}

type ResumeClaimReadyState = ReadyResumeTailoringState & {
  readonly jobPosting: JobPostingReview & { readonly status: 'reviewing-requirements' }
  readonly matchAnalysis: MatchAnalysis
  readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
}

function hasResumeClaimInputs(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{ ok: true; value: ResumeClaimReadyState }> {
  if (!hasMatchInputs(result) || result.value.matchAnalysis === undefined) return false
  const evidenceFactIds = new Set(result.value.matchAnalysis.evidence
    .flatMap(({ factIds }) => factIds))
  const hasEvidenceBackedFact = result.value.sourceProfile.facts.some((fact) =>
    fact.status === 'verified' && evidenceFactIds.has(fact.id))
  return result.value.matchAnalysis.generationEligibility === 'eligible'
    && result.value.matchAnalysis.evidence.length > 0
    && hasEvidenceBackedFact
    && hasCurrentMatchProcessingConsent({ state: result.value })
}

function hasTailoredResume(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
}> {
  return hasResumeClaimInputs(result) && result.value.tailoredResume !== undefined
}

function hasOutcomeInputs(
  result: ResumeTailoringResult<ResumeTailoringView>,
): result is Readonly<{
  ok: true
  value: OutcomeReadyState
}> {
  return hasReadyState(result)
    && result.value.matchAnalysis !== undefined
    && result.value.tailoredResume !== undefined
}

function createResumeClaimSource({
  locale,
  state,
}: Readonly<{ locale: 'en' | 'fr'; state: ResumeClaimReadyState }>): ResumeClaimSource {
  return {
    locale,
    matchAnalysis: state.matchAnalysis,
    requirements: state.jobPosting.requirements,
    sourceFacts: state.sourceProfile.facts,
  }
}

function prepareResumeClaimReformulation({ command, dependencies, state }: Readonly<{
  command: Extract<ResumeTailoringCommand, { readonly type: 'reformulate-resume-claim' }>
  dependencies: ResumeTailoringDependencies
  state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
}>) {
  const claim = state.tailoredResume.claims.find(({ id }) => id === command.claimId)
  const generation = createResumeClaimGenerationFrom(dependencies)
  if (claim === undefined || generation === null) return null
  return {
    claim,
    generation,
    source: createResumeClaimSource({ locale: state.tailoredResume.locale, state }),
  }
}

function replaceResumeClaim({ claim, claimId, tailoredResume }: Readonly<{
  claim: ResumeClaim | null
  claimId: ResumeClaim['id']
  tailoredResume: TailoredResume
}>): TailoredResume {
  if (claim === null) return tailoredResume
  return {
    claims: tailoredResume.claims.map((existingClaim) =>
      existingClaim.id === claimId ? claim : existingClaim),
    exclusions: tailoredResume.exclusions,
    locale: tailoredResume.locale,
  }
}

function createSupportedClaimEdit({ command, state }: Readonly<{
  command: Extract<ResumeTailoringCommand, { readonly type: 'edit-resume-claim' }>
  state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
}>) {
  const currentClaim = state.tailoredResume.claims.find(({ id }) => id === command.claimId)
  if (currentClaim === undefined || command.texts.length !== currentClaim.segments.length) return null
  const proposal = { segments: currentClaim.segments.map((segment, segmentIndex) => ({
    factIds: segment.factIds,
    text: command.texts[segmentIndex] ?? '',
  })) }
  const verifiedFacts = state.sourceProfile.facts.filter(({ status }) => status === 'verified')
  const validation = validateProposedResumeClaim({
    claimId: currentClaim.id,
    proposal,
    verifiedFacts,
  })
  if (!validation.ok) return { status: 'confirmation-required' } as const
  const claim = validation.value
  return {
    claim,
    status: 'ready',
    validationRequest: { claim, verifiedFacts },
  } as const
}

function createConfirmedClaimEdit({ command, fact, state }: Readonly<{
  command: Extract<ResumeTailoringCommand, { readonly type: 'confirm-resume-claim-edit' }>
  fact: SourceProfileFact
  state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
}>) {
  const currentClaim = state.tailoredResume.claims.find(({ id }) => id === command.claimId)
  if (currentClaim === undefined) return null
  const claim = { id: currentClaim.id, segments: [{ factIds: [fact.id], text: fact.value }] }
  return {
    fact,
    matchAnalysis: {
      ...state.matchAnalysis,
      relevantFactIds: [...state.matchAnalysis.relevantFactIds, fact.id],
    },
    tailoredResume: replaceResumeClaim({
      claim,
      claimId: claim.id,
      tailoredResume: state.tailoredResume,
    }),
  }
}

function prepareConfirmedClaimEdit({ command, dependencies, state }: Readonly<{
  command: Extract<ResumeTailoringCommand, { readonly type: 'confirm-resume-claim-edit' }>
  dependencies: ResumeTailoringDependencies
  state: ResumeClaimReadyState & { readonly tailoredResume: TailoredResume }
}>) {
  const fact = createCandidateAuthoredFact({
    facts: state.sourceProfile.facts,
    identity: dependencies.sourceProfileFactIdentity,
    kind: command.kind,
    value: command.text,
  })
  if (!fact.ok) return fact
  const transition = createConfirmedClaimEdit({ command, fact: fact.value, state })
  return transition === null
    ? { ok: false, result: resumeClaimUnavailableResult } as const
    : { ok: true, value: transition } as const
}

function moveResumeClaim({ claimId, claims, direction }: Readonly<{
  claimId: ResumeClaim['id']
  claims: readonly ResumeClaim[]
  direction: 'up' | 'down'
}>) {
  const sourceIndex = claims.findIndex(({ id }) => id === claimId)
  const targetIndex = sourceIndex + (direction === 'up' ? -1 : 1)
  const sourceClaim = claims[sourceIndex]
  const targetClaim = claims[targetIndex]
  if (sourceClaim === undefined || targetClaim === undefined) return null
  return claims.map((claim, claimIndex) => {
    if (claimIndex === sourceIndex) return targetClaim
    return claimIndex === targetIndex ? sourceClaim : claim
  })
}

function createResumeClaimGenerationFrom(dependencies: ResumeTailoringDependencies) {
  const identity = dependencies.resumeClaimIdentity
  const semanticValidator = dependencies.resumeClaimSemanticValidator
  const writer = dependencies.resumeClaimWriter
  if (identity === undefined || semanticValidator === undefined || writer === undefined) return null
  return createResumeClaimGeneration({ identity, semanticValidator, writer })
}

function hasCurrentMatchProcessingConsent({ state }: Readonly<{
  state: ReadyResumeTailoringState & {
    readonly jobPosting: JobPostingReview & { readonly status: 'reviewing-requirements' }
    readonly sourceProfile: NonNullable<ReadyResumeTailoringState['sourceProfile']>
  }
}>) {
  return state.sourceProfile.processingNotice?.version === sourceProfileProcessingNoticeVersion
    && hasCurrentJobPostingProcessingConsent({ jobPosting: state.jobPosting })
}

function requiresSourceProcessingConsent(
  result: ResumeTailoringResult<ResumeTailoringView>,
) {
  return result.ok
    && result.value.status === 'ready'
    && result.value.sourceProfile !== undefined
    && result.value.sourceProfile.processingNotice?.version
      !== sourceProfileProcessingNoticeVersion
}

function readCurrentProcessingConsentTimestamp({ state }: Readonly<{
  state: ReadyResumeTailoringState
}>) {
  const notice = state.sourceProfile?.processingNotice
  return notice?.version === sourceProfileProcessingNoticeVersion
    ? notice.confirmedAt
    : null
}

function applyCandidateSessionConsent({ confirmedAt, jobPosting }: Readonly<{
  confirmedAt: number | null
  jobPosting: JobPostingReview
}>): JobPostingReview {
  if (confirmedAt === null) return jobPosting
  return {
    ...jobPosting,
    processingNotice: {
      ...jobPostingProcessingPolicy,
      version: jobPostingProcessingNoticeVersion,
      confirmedAt,
    },
  }
}

function createCandidateAuthoredFact({ facts, identity, kind, value: untrimmedValue }: Readonly<{
  facts: readonly SourceProfileFact[]
  identity?: SourceProfileFactIdentity
  kind: SourceProfileFact['kind']
  value: string
}>): Readonly<{ ok: true; value: SourceProfileFact }>
  | Readonly<{ ok: false; result: ResumeTailoringResult<ResumeTailoringView> }> {
  const value = untrimmedValue.trim()
  if (value.length === 0) return { ok: false, result: candidateFactInvalidResult }
  if (hasDuplicateCandidateFact({ facts, value })) {
    return { ok: false, result: candidateFactDuplicateResult }
  }
  const factIdentity = identity?.create()
  if (factIdentity === undefined || !factIdentity.ok) {
    return { ok: false, result: sourceProfileFactUnavailableResult }
  }
  return { ok: true, value: {
    authorship: 'candidate', id: factIdentity.value, kind,
    propositionKey: `proposition-${kind}-${factIdentity.value.replace('source-fact-', '')}`,
    status: 'verified', value,
  } }
}

function hasDuplicateCandidateFact({ facts, value }: Readonly<{
  facts: readonly SourceProfileFact[]
  value: string
}>) {
  const normalizedValue = normalizeCandidateFactValue(value)
  return facts.some((fact) => fact.status !== 'rejected' && fact.status !== 'superseded'
    && normalizeCandidateFactValue(fact.value) === normalizedValue)
}

function normalizeCandidateFactValue(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, ' ')
}

function appendCandidateFact({ fact, state }: Readonly<{
  fact: SourceProfileFact
  state: ReadyResumeTailoringState & Required<Pick<ReadyResumeTailoringState,
    'jobPosting' | 'sourceProfile'>>
}>) {
  return {
    ...state,
    sourceProfile: { ...state.sourceProfile, facts: [...state.sourceProfile.facts, fact] },
  }
}

async function requestMatchAnalysis({ matcher, state }: Readonly<{
  matcher: MatchEvidenceMatcher
  state: ReadyResumeTailoringState & Required<Pick<ReadyResumeTailoringState,
    'jobPosting' | 'sourceProfile'>>
}>): Promise<ResumeTailoringResult<MatchAnalysis>> {
  const verifiedFacts = state.sourceProfile.facts.filter((fact) => fact.status === 'verified')
  const matchResult = await matcher.match({
    requirements: state.jobPosting.requirements
      .map(({ classification, id, value }) => ({ classification, id, value })),
    verifiedFacts: verifiedFacts.map(({ id, kind, value }) => ({ id, kind, value })),
  })
  if (!matchResult.ok) return matchResult
  const matchAnalysis = createMatchAnalysis({
    improvementOpportunities: matchResult.value.improvementOpportunities,
    proposedEvidence: matchResult.value.evidence,
    relevantFactIds: matchResult.value.relevantFactIds,
    requirements: state.jobPosting.requirements,
    verifiedFacts,
  })
  return matchAnalysis === null ? matchAnalysisUnavailableResult : { ok: true, value: matchAnalysis }
}

function createJobPostingHistoryItem({ state }: Readonly<{
  state: ReadyResumeTailoringState & {
    readonly jobPosting: JobPostingReview
    readonly matchAnalysis: MatchAnalysis
  }
}>): JobPostingHistoryItem {
  const itemNumber = (state.jobPostingHistory?.length ?? 0) + 1
  return {
    id: `job-posting-${String(itemNumber)}`,
    matchScore: state.matchAnalysis.matchScore,
    status: state.currentJobPostingStatus ?? 'analyzed',
    ...(state.jobPosting.targetRole === null || state.jobPosting.targetRole === undefined
      ? {}
      : { targetRole: state.jobPosting.targetRole.value }),
  }
}

const workflowAlreadyOpenResult = {
  ok: false,
  error: { type: 'workflow-already-open' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const unavailableResult = {
  ok: false,
  error: { type: 'candidate-session-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const automaticRetryCommandTypes = new Set<ResumeTailoringCommand['type']>([
  'extract-source-profile',
  'confirm-processing-and-extract-source-profile',
  'extract-job-requirements',
  'analyze-match',
  'enrich-source-profile',
  'generate-resume-claims',
  'reformulate-resume-claim',
  'edit-resume-claim',
  'confirm-resume-claim-edit',
])

const automaticRetryFailureTypes = new Set<ResumeTailoringFailure['type']>([
  'source-profile-extraction-unavailable',
  'job-requirement-extraction-unavailable',
  'job-requirement-transport-unavailable',
  'match-analysis-unavailable',
  'match-analysis-transport-unavailable',
  'resume-claim-writing-unavailable',
  'resume-claim-validation-unavailable',
])

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

const candidateFactDuplicateResult = {
  ok: false,
  error: { type: 'candidate-fact-duplicate' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const candidateFactInvalidResult = {
  ok: false,
  error: { type: 'candidate-fact-invalid' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const jobRequirementExtractionUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-extraction-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const matchAnalysisUnavailableResult = {
  ok: false,
  error: { type: 'match-analysis-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const resumeClaimUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-unavailable' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>

const resumeClaimNewFactConfirmationRequiredResult = {
  ok: false,
  error: { type: 'resume-claim-new-fact-confirmation-required' },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>
