export { resumePreparationFailures } from '@resume-tailoring/domain/candidate-session'
export { readProfessionalResumeFields, resumeCoherenceIssueKinds, resumeSectionKinds } from './resume-sections'
export type { ResumeCoherenceInput, ResumeCoherenceIssue, ResumeCoherenceIssueKind, ResumeDocumentCoherence,
  ResumeFieldRejection, ResumeFieldValidation, ResumeFieldValidationInput, ResumeModelUsage, ResumeRejectedField,
  ResumeSectionContent, ResumeSectionKind, ResumeSectionModelFailure, ResumeSectionModelResult,
  ResumeSectionModels, ResumeSectionPlanEntry, ResumeSectionWritingInput } from './resume-sections'
import type { ResumeSectionModels } from './resume-sections'
import { resumePreparationMachine } from './resume-preparation-machines'
import { prepareCombinedIntake, publishResumePreparation, unavailable } from './combined-intake'
import type { CombinedIntakeOutcome, CombinedIntakeRequest, PreparationPhase, PreparedResumeInputs } from './combined-intake'

import type { MatchScoreBand, PrivacySafeTelemetry, PrivacySafeTelemetryEvent } from './privacy-safe-telemetry'
import type { ResumeCorrectionKind } from './resume-editing'
import { assessResumeLayout, proposeResumeCondensation, acceptResumeCondensation, rejectResumeCondensation } from './resume-condensation'
import type { ResumeProposalDecision } from './structured-resume-contract'
import { hideResumeEntry, restoreResumeEntry, attestResumeField, hideResumeContent, restoreResumeContent, moveResumeContent, reorderResumeSections, restoreSourceFact } from './resume-content-recovery'
import type { ResumeSectionName } from './tailored-resume'
import { applyValidatedSectionChange, changedResumeSession, editResumeField, emptyResumeReview,
  readResumeEditing, readResumeReview, unavailableResumeResult } from './resume-editing'
import type { ResumeEditingAccess, ResumeReview, ResumeReviewState } from './resume-editing'
import type { ResumeDocumentPorts, ResumeSectionChange } from './structured-resume-contract'
import { assign, createActor, fromPromise, setup, waitFor } from 'xstate'
import type { AnyActorRef, SnapshotFrom } from 'xstate'
import { prepareResumeRendering, staleResumeRendering, validateResumeRendering } from './resume-rendering-state'
import type { ResumeRenderingState } from './resume-rendering-state'

import { unavailableResumeRender } from './resume-export'
import type { ResumeDocumentRenderer, ResumeRenderInput, ResumeRenderRequest, ResumeRenderResult } from './resume-export'

export { assessResumeExport, unavailableResumeRender } from './resume-export'
export type { ResumeDocumentRenderer, ResumeRenderInput, ResumeRenderRequest, ResumeRenderResult } from './resume-export'


import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
} from '@resume-tailoring/domain/candidate-session'
import type {
  CandidateSession,
  CandidateJourneyPhase,
  ResumePhoto,
  ResumeSectionSnapshot,
} from '@resume-tailoring/domain/candidate-session'
import { hasProcessingConsentForPolicy } from '@resume-tailoring/domain/processing-policy'
import type { ProcessingPolicy } from '@resume-tailoring/domain/processing-policy'
import {
  createSourceIntake,
  resolveCriticalAmbiguity,
} from './source-intake'
import { createJobMatch, refreshJobMatch } from './job-match'
import type {
  JobMatchFailure,
  JobPostingDocument,
  JobPostingDocumentReader,
  JobPostingExtractor,
  MatchEvidenceMatcher,
  ProfileEnrichmentFactKind,
} from './job-match'
import type { JobMatch, JobRequirementId } from '@resume-tailoring/domain/job-match'
import type { CandidateFact, SourceIntake } from '@resume-tailoring/domain/source-intake'
import { createProfileEnrichment } from './profile-enrichment'
import type { ProfileEnrichmentValidationFailure } from './profile-enrichment'
import type { TailoredResume } from './tailored-resume'
import type {
  SourceDocument,
  SourceDocumentReader,
  SourceIntakeFailure,
  StructuredSourceProfileExtractor,
} from './source-intake'

export {
  candidateJourneyPhases,
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  hasValidCandidateSessionLifetime,
} from '@resume-tailoring/domain/candidate-session'
export type { CandidateJourneyPhase, CandidateSession }
export type { StoredIntakeDocument, ResumePhoto, ResumePreparationFailure, ResumeSectionSnapshot } from '@resume-tailoring/domain/candidate-session'

export type CandidateSessionNotice =
  | 'deleted'
  | 'expired-session-discarded'
  | 'incompatible-session-discarded'
  | null

export type CandidateSessionStorageFailure = 'candidate-session-storage-unavailable'

export type CandidateSessionStorageResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; error: CandidateSessionStorageFailure }>

export type CandidateSessionPersistence = Readonly<{
  delete: () => CandidateSessionStorageResult<null>
  restore: (request: Readonly<{ now: number }>) => CandidateSessionStorageResult<Readonly<{
    notice: CandidateSessionNotice
    session: CandidateSession | null
  }>>
  save: (request: Readonly<{ session: CandidateSession }>) =>
    CandidateSessionStorageResult<CandidateSession>
}>

export type CandidateJourneyDependencies = Readonly<{
  resumeDocumentRenderer?: ResumeDocumentRenderer
  telemetry?: PrivacySafeTelemetry
  resumeDocumentPorts?: Partial<ResumeDocumentPorts>
  resumeSectionModels?: ResumeSectionModels
  createSessionId: () => string
  jobPostingDocumentReader: JobPostingDocumentReader
  jobPostingExtractor: JobPostingExtractor
  languageModelGateway: Readonly<{ processingPolicy: ProcessingPolicy }>
  matchEvidenceMatcher: MatchEvidenceMatcher
  now: () => number
  persistence: CandidateSessionPersistence
  sourceDocumentReader: SourceDocumentReader
  sourceProfileExtractor: StructuredSourceProfileExtractor
}>

type CandidateJourneySourceIntakeFailure =
  | SourceIntakeFailure
  | 'ambiguity-unavailable'
  | 'candidate-session-storage-unavailable'

type CandidateJourneyJobMatchFailure =
  | JobMatchFailure
  | 'candidate-session-storage-unavailable'

type ProfileEnrichmentFailure =
  | ProfileEnrichmentValidationFailure
  | 'candidate-session-storage-unavailable'
  | 'match-evidence-unavailable'

type CandidateJourneyContext = Readonly<{
  resumeRendering: ResumeRenderingState | null
  resumeRenderSequence: number
  dependencies: CandidateJourneyDependencies
  preparationOutcome: CombinedIntakeOutcome | null
  preparationPhase: PreparationPhase | null
  preparedInputs: PreparedResumeInputs | null
  resumeReview: ResumeReviewState
  jobMatchFailure: CandidateJourneyJobMatchFailure | null
  notice: CandidateSessionNotice
  profileEnrichmentFailure: ProfileEnrichmentFailure | null
  sourceIntakeFailure: CandidateJourneySourceIntakeFailure | null
  session: CandidateSession | null
}>

type ResumeContacts = Pick<TailoredResume, 'identity' | 'contactDetails'>

type CandidateJourneyEvent =
  | Readonly<{ type: 'RENDER_RESUME_DOCUMENT'; input: ResumeRenderInput }>
  | Readonly<{ type: 'INVALIDATE_RESUME_INPUTS' }>
  | Readonly<{ type: 'PREPARATION_PROGRESS'; phase: PreparationPhase; session: CandidateSession }>
  | Readonly<{ type: 'RESUME_SECTIONS_PROGRESSED'; sections: readonly ResumeSectionSnapshot[] }>
  | Readonly<{ type: 'SAVE_RESUME'; session: CandidateSession; baseRevision: string; correctionKind?: ResumeCorrectionKind }>
  | Readonly<{ type: 'REPORT_RESUME'; review: ResumeReviewState; baseRevision: string }>
  | Readonly<{ type: 'UPDATE_RESUME_CONTACTS'; contacts: ResumeContacts }>
  | Readonly<{ type: 'UPDATE_RESUME_PHOTO'; photo: ResumePhoto | null }>
  | Readonly<{ type: 'CHANGE_JOB_POSTING' }>
  | Readonly<{ type: 'DELETE_CANDIDATE_SESSION' }>
  | Readonly<{ type: 'GRANT_PROCESSING_CONSENT' }>
  | Readonly<{
      type: 'CONFIRM_PROFILE_ENRICHMENT'
      kind: ProfileEnrichmentFactKind
      requirementId: JobRequirementId
      value: string
    }>
  | Readonly<{ type: 'RESOLVE_CRITICAL_AMBIGUITY'; ambiguityId: `critical-ambiguity-${string}`; answer: string }>
  | Readonly<{ type: 'SUBMIT_SOURCE_DOCUMENT'; document: SourceDocument }>
  | Readonly<{ type: 'START_CANDIDATE_SESSION' }>
  | (Readonly<{ type: 'START_TAILORED_RESUME_PREPARATION' }> & CombinedIntakeRequest)
  | Readonly<{ type: 'SUBMIT_JOB_POSTING'; document: JobPostingDocument }>

type RestoredCandidateSession = Readonly<{
  notice: CandidateSessionNotice
  session: CandidateSession | null
}>

type CandidateJourneyOperation = 'rendering-resume-document' | 'preparing-tailored-resume' | 'processing-job-posting'
  | 'processing-profile-enrichment' | 'processing-source-document'
  | 'resolving-critical-ambiguity' | null

export type CandidateJourneyView =
  | Readonly<{ status: 'preparing-session' }>
  | Readonly<{ status: 'candidate-session-absent'; notice: CandidateSessionNotice }>
  | Readonly<{
      status: 'candidate-session-open'
      preparationOutcome: CombinedIntakeOutcome | null
      preparationPhase: PreparationPhase | null
      resumeReview: ResumeReview | null
      processingConsentStatus: 'granted' | 'required'
      processingPolicy: ProcessingPolicy
      jobMatchFailure: CandidateJourneyJobMatchFailure | null
      operation: CandidateJourneyOperation
      profileEnrichmentFailure: ProfileEnrichmentFailure | null
      session: CandidateSession
      sourceIntakeFailure: CandidateJourneySourceIntakeFailure | null
    }>
  | Readonly<{ status: 'candidate-session-unavailable' }>

export type CandidateJourney = Readonly<{
  renderResumeDocument: (request: ResumeRenderInput) => Promise<ResumeRenderResult>
  invalidateResumeInputs: () => void
  hideResumeEntry: (request: Readonly<{ experienceId: string }>) => void
  restoreResumeEntry: (request: Readonly<{ experienceId: string }>) => void
  assessResumeLayout: (request?: Readonly<{ photoDataUrl?: string }>) => Promise<void>
  proposeResumeCondensation: (request?: Readonly<{ photoDataUrl?: string }>) => Promise<void>
  acceptResumeCondensation: (decision: ResumeProposalDecision) => void
  rejectResumeCondensation: (decision: ResumeProposalDecision) => void
  attestResumeField: (request: Readonly<{ fieldId: string }>) => void
  hideResumeField: (request: Readonly<{ fieldId: string }>) => void
  restoreResumeField: (request: Readonly<{ fieldId: string }>) => void
  restoreSourceFact: (request: Readonly<{ factId: CandidateFact['id'] }>) => void
  moveResumeField: (request: Readonly<{ fieldId: string; direction: 'up' | 'down' }>) => void
  reorderResumeSections: (request: Readonly<{ sectionOrder: readonly ResumeSectionName[] }>) => void
  applyValidatedSectionChange: (change: ResumeSectionChange) => Promise<void>
  editResumeField: (request: Readonly<{ fieldId: string; text: string }>) => Promise<void>
  updateResumeContacts: (contacts: ResumeContacts) => void
  updateResumePhoto: (photo: ResumePhoto | null) => void
  /** Forgets the Job Posting to restore in the intake; the Source Profile and the current result stay. */
  changeJobPosting: () => void
  confirmProfileEnrichment: (request: Readonly<{
    kind: ProfileEnrichmentFactKind
    requirementId: JobRequirementId
    value: string
  }>) => void
  deleteCandidateSession: () => void
  grantProcessingConsent: () => void
  rateResumeUsefulness: (request: Readonly<{ useful: boolean }>) => void
  recordResumeDownload: () => void
  readView: () => CandidateJourneyView
  resolveCriticalAmbiguity: (request: Readonly<{
    ambiguityId: `critical-ambiguity-${string}`
    answer: string
  }>) => void
  start: () => void
  startCandidateSession: () => void
  startTailoredResumePreparation: (request?: CombinedIntakeRequest) => void
  submitJobPosting: (request: Readonly<{ document: JobPostingDocument }>) => void
  submitSourceDocument: (document: SourceDocument) => void
  subscribe: (listener: () => void) => () => void
}>

const generateApplicationResume = fromPromise<CombinedIntakeOutcome | PreparedResumeInputs, Readonly<{
  dependencies: CandidateJourneyDependencies; request: CombinedIntakeRequest;
  session: CandidateSession | null; onProgress: (phase: PreparationPhase, session: CandidateSession) => void
}>>(async ({ input, signal }) => {
  if (input.session === null) return unavailable
  return prepareCombinedIntake({ ...input, session: input.session, signal })
})

const restoreCandidateSession = fromPromise<
  CandidateSessionStorageResult<RestoredCandidateSession>,
  CandidateJourneyDependencies
>(({ input }) => Promise.resolve(restoreRecoverableSession(input)))

function restoreRecoverableSession(dependencies: CandidateJourneyDependencies) {
  const result = dependencies.persistence.restore({ now: dependencies.now() })
  if (!result.ok || result.value.session?.preparation?.status !== 'pending') return result
  const session = result.value.session
  const preparation = session.preparation
  if (preparation === undefined) return result
  return { ok: true, value: { ...result.value,
    session: { ...session, preparation: { ...preparation, status: 'interrupted' as const } } } } as const
}

const startCandidateSession = fromPromise<
  CandidateSessionStorageResult<CandidateSession>,
  CandidateJourneyDependencies
>(({ input }) => {
  const startedAt = input.now()
  const session = {
    expiresAt: startedAt + candidateSessionDurationMilliseconds,
    jobMatch: null,
    phase: 'source-intake',
    processingConsent: null,
    sessionId: `candidate-session-${input.createSessionId()}`,
    sourceIntake: null,
    tailoredResume: null,
    startedAt,
    version: candidateSessionStorageVersion,
  } as const satisfies CandidateSession
  return Promise.resolve(input.persistence.save({ session }))
})

const deleteCandidateSession = fromPromise<
  CandidateSessionStorageResult<null>,
  CandidateJourneyDependencies
>(({ input }) => Promise.resolve(input.persistence.delete()))

const grantProcessingConsent = fromPromise<
  CandidateSessionStorageResult<CandidateSession>,
  Readonly<{ dependencies: CandidateJourneyDependencies; session: CandidateSession | null }>
>(({ input }) => Promise.resolve(input.session === null
  ? { ok: false, error: 'candidate-session-storage-unavailable' }
  : input.dependencies.persistence.save({ session: input.session })))

type SourceIntakeActorInput = Readonly<{
  dependencies: CandidateJourneyDependencies
  document: SourceDocument
  session: CandidateSession | null
}>
type SourceIntakeActorResult = CandidateSessionStorageResult<CandidateSession>
  | Readonly<{ ok: false; error: SourceIntakeFailure }>

const submitSourceDocument = fromPromise<SourceIntakeActorResult, SourceIntakeActorInput>(async ({ input }: Readonly<{
  input: SourceIntakeActorInput
}>) => {
  if (input.session === null) return storageUnavailableResult
  if (!hasProcessingConsentForPolicy({
    consent: input.session.processingConsent,
    policy: input.dependencies.languageModelGateway.processingPolicy,
  })) return processingConsentRequiredResult
  const sourceIntakeResult = await createSourceIntake({
    document: input.document,
    sourceDocumentReader: input.dependencies.sourceDocumentReader,
    sourceProfileExtractor: input.dependencies.sourceProfileExtractor,
  })
  if (!sourceIntakeResult.ok) return sourceIntakeResult
  const nextSession = {
    ...invalidatePreparation(input.session),
    jobMatch: null,
    phase: sourceIntakeResult.value.criticalAmbiguities.length === 0
      ? 'job-match' as const
      : 'source-intake' as const,
    sourceIntake: sourceIntakeResult.value,
  }
  return input.dependencies.persistence.save({ session: nextSession })
})

type ResolveAmbiguityActorInput = Readonly<{
  ambiguityId: `critical-ambiguity-${string}`
  answer: string
  dependencies: CandidateJourneyDependencies
  session: CandidateSession | null
}>
type ResolveAmbiguityActorResult = CandidateSessionStorageResult<CandidateSession>
  | Readonly<{ ok: false; error: 'ambiguity-unavailable' }>

const persistCriticalAmbiguityResolution = fromPromise<
  ResolveAmbiguityActorResult,
  ResolveAmbiguityActorInput
>(({ input }: Readonly<{
  input: ResolveAmbiguityActorInput
}>) => {
  const sourceIntake = input.session?.preparation?.sourceIntake ?? input.session?.sourceIntake
  if (sourceIntake === null || sourceIntake === undefined || input.session === null) return Promise.resolve(ambiguityUnavailableResult)
  const resolution = resolveCriticalAmbiguity({
    answer: input.answer,
    criticalAmbiguityId: input.ambiguityId,
    sourceIntake,
  })
  if (!resolution.ok) return Promise.resolve(resolution)
  const nextSession = applySourceCorrection({ session: input.session, sourceIntake: resolution.value })
  return Promise.resolve(input.dependencies.persistence.save({ session: nextSession }))
})

function applySourceCorrection({ session, sourceIntake }: Readonly<{ session: CandidateSession; sourceIntake: SourceIntake }>): CandidateSession {
  if (session.preparation !== undefined) return { ...invalidateEditingRevision(session), preparedResumeStatus: 'outdated',
    preparation: { ...session.preparation, status: 'outdated', sourceIntake, jobMatch: null },
  }
  return { ...invalidatePreparation(session), sourceIntake, jobMatch: null,
    phase: sourceIntake.criticalAmbiguities.length === 0 ? 'job-match' : 'source-intake',
  }
}

type JobMatchActorInput = Readonly<{
  dependencies: CandidateJourneyDependencies
  document: JobPostingDocument
  session: CandidateSession | null
}>
type JobMatchActorResult = CandidateSessionStorageResult<CandidateSession>
  | Readonly<{ ok: false; error: JobMatchFailure }>

const submitJobPosting = fromPromise<JobMatchActorResult, JobMatchActorInput>(async ({ input }) => {
  const session = input.session
  if (!canSubmitJobPosting({ session }) || session === null || session.sourceIntake === null) {
    return storageUnavailableResult
  }
  if (!hasJobMatchConsent({ input, session })) return processingConsentRequiredResult
  const jobMatchResult = await createJobMatch({
    candidateFacts: session.sourceIntake.candidateFacts,
    document: input.document,
    jobPostingDocumentReader: input.dependencies.jobPostingDocumentReader,
    jobPostingExtractor: input.dependencies.jobPostingExtractor,
    matchEvidenceMatcher: input.dependencies.matchEvidenceMatcher,
  })
  if (!jobMatchResult.ok) return jobMatchResult
  return input.dependencies.persistence.save({
    session: { ...invalidatePreparation(session), jobMatch: jobMatchResult.value },
  })
})

type ProfileEnrichmentActorInput = Readonly<{
  dependencies: CandidateJourneyDependencies
  kind: ProfileEnrichmentFactKind
  requirementId: JobRequirementId
  session: CandidateSession | null
  value: string
}>
type ProfileEnrichmentActorResult = CandidateSessionStorageResult<CandidateSession>
  | Readonly<{ ok: false; error: ProfileEnrichmentFailure }>

const confirmProfileEnrichment = fromPromise<
  ProfileEnrichmentActorResult,
  ProfileEnrichmentActorInput
>(processProfileEnrichment)

async function processProfileEnrichment({ input }: Readonly<{
  input: ProfileEnrichmentActorInput
}>): Promise<ProfileEnrichmentActorResult> {
  const session = input.session === null ? null : { ...input.session,
    sourceIntake: input.session.preparation?.sourceIntake ?? input.session.sourceIntake,
    jobMatch: input.session.preparation?.jobMatch ?? input.session.jobMatch,
  }
  if (session?.sourceIntake === null || session === null || session.jobMatch === null) {
    return profileEnrichmentUnavailableResult
  }
  const enrichmentResult = createProfileEnrichment({
    candidateFacts: session.sourceIntake.candidateFacts,
    jobMatch: session.jobMatch,
    kind: input.kind,
    requirementId: input.requirementId,
    value: input.value,
  })
  if (!enrichmentResult.ok) return enrichmentResult
  return persistProfileEnrichment({
    fact: enrichmentResult.value, input, jobMatch: session.jobMatch, session,
    sourceIntake: session.sourceIntake,
  })
}

async function persistProfileEnrichment({ fact, input, jobMatch, session, sourceIntake }: Readonly<{
  fact: CandidateFact
  input: ProfileEnrichmentActorInput
  jobMatch: JobMatch
  session: CandidateSession
  sourceIntake: SourceIntake
}>): Promise<ProfileEnrichmentActorResult> {
  const candidateFacts = [...sourceIntake.candidateFacts, fact]
  const jobMatchResult = await refreshJobMatch({
    candidateFacts, jobMatch,
    matchEvidenceMatcher: input.dependencies.matchEvidenceMatcher,
  })
  if (!jobMatchResult.ok) return {
    ok: false, error: 'match-evidence-unavailable',
  } as const
  return input.dependencies.persistence.save({ session: {
    ...invalidatePreparation(session),
    jobMatch: jobMatchResult.value,
    sourceIntake: { ...sourceIntake, candidateFacts },
  } })
}

function hasJobMatchConsent({ input, session }: Readonly<{
  input: JobMatchActorInput
  session: CandidateSession
}>) {
  return hasProcessingConsentForPolicy({
    consent: session.processingConsent,
    policy: input.dependencies.languageModelGateway.processingPolicy,
  })
}

const renderResumeDocument = fromPromise<ResumeRenderResult | null, Readonly<{
  dependencies: CandidateJourneyDependencies; request: ResumeRenderRequest | null
}>>(async ({ input }) => {
  if (input.request === null) return null
  const result = await renderCandidateDocument({ dependencies: input.dependencies, request: input.request })
  return validateResumeRendering({ request: input.request, result })
})

function invalidateEditingRevision(session: CandidateSession): CandidateSession {
  if (session.tailoredResume === null) return session
  return { ...session, resumeEditing: { ...readResumeEditing({ session }), revision: crypto.randomUUID() } }
}

function invalidatePreparation(session: CandidateSession): CandidateSession {
  const { preparation, ...retained } = session
  return preparation === undefined && session.tailoredResume === null ? retained
    : { ...invalidateEditingRevision(retained), preparedResumeStatus: 'outdated' }
}

function withProcessingConsent({ session, dependencies }: CandidateJourneyContext) {
  return session === null ? null : {
    ...session,
    processingConsent: { grantedAt: dependencies.now(), policy: dependencies.languageModelGateway.processingPolicy },
  }
}

function readResumePreparationInput({ dependencies, preparedInputs }: CandidateJourneyContext) {
  return { request: preparedInputs?.request ?? emptySectionsRequest, revision: preparedInputs?.preparation.revision ?? 'unavailable',
    resumeFrom: preparedInputs?.preparation.sections ?? [],
    models: dependencies.resumeSectionModels ?? unavailableSectionModels, now: dependencies.now,
    recordTelemetry: (event: PrivacySafeTelemetryEvent) => { recordTelemetry({ dependencies, event }) } }
}

const unavailableModelResult = Promise.resolve({ ok: false, error: { type: 'permanent' } } as const)
const unavailableSectionModels: ResumeSectionModels = { writeSection: () => unavailableModelResult,
  validateFields: () => unavailableModelResult, checkCoherence: () => unavailableModelResult }
const emptySectionsRequest = { candidateFacts: [], locale: 'en', purpose: 'tailored', jobMatch: {
  analysis: { adjacentEvidence: [], criticalRequirementReserve: { requirementIds: [], status: 'clear' }, evidence: [],
    generationEligibility: 'denied', matchBand: 'ambitious', matchBandQualification: null, matchScore: 0,
    relevantFactIds: [], requirementGroups: [] },
  jobPosting: { kind: 'pasted-text', name: '', originalContent: '' }, practicalConstraints: [],
  priorityGapRequirementIds: [], strengthRequirementIds: [], requirements: [], targetRole: null,
} } as const satisfies PreparedResumeInputs['request']

function invalidateResumeInputs({ session, dependencies }: CandidateJourneyContext) {
  if (session === null || (session.preparedResumeStatus === 'outdated' && (session.preparation === undefined || session.preparation.status === 'outdated'))) return session
  const next: CandidateSession = { ...invalidateEditingRevision(session), preparedResumeStatus: 'outdated',
    ...(session.preparation === undefined ? {} : { preparation: { ...session.preparation, status: 'outdated' } }),
  }
  dependencies.persistence.save({ session: next })
  return next
}

function withResumePhoto({ session, photo }: Readonly<{ session: CandidateSession; photo: ResumePhoto | null }>): CandidateSession {
  if (photo !== null) return { ...session, resumePhoto: photo }
  const { resumePhoto, ...withoutPhoto } = session
  return resumePhoto === undefined ? session : withoutPhoto
}

/** Persists a change that leaves the Tailored Resume itself untouched, so the current review and rendering stay. */
function saveSessionChange({ context, change }: Readonly<{
  context: CandidateJourneyContext; change: (session: CandidateSession) => CandidateSession
}>): Partial<CandidateJourneyContext> {
  if (context.session === null) return {}
  const result = context.dependencies.persistence.save({ session: change(context.session) })
  return result.ok ? { session: result.value } : { resumeReview: { ...context.resumeReview, failure: unavailableResumeResult } }
}

const candidateJourneyMachine = setup({
  actors: {
    generateApplicationResume,
    resumePreparationMachine,
    renderResumeDocument,
    confirmProfileEnrichment,
    deleteCandidateSession,
    grantProcessingConsent,
    persistCriticalAmbiguityResolution,
    restoreCandidateSession,
    startCandidateSession,
    submitJobPosting,
    submitSourceDocument,
  },
  delays: {
    candidateSessionExpiration: ({ context }) => context.session === null
      ? 0
      : Math.max(0, context.session.expiresAt - context.dependencies.now()),
  },
  types: {} as {
    context: CandidateJourneyContext
    events: CandidateJourneyEvent
    input: CandidateJourneyDependencies
  },
}).createMachine({
  context: ({ input }: Readonly<{ input: CandidateJourneyDependencies }>) => ({
    dependencies: input,
    resumeRendering: null, resumeRenderSequence: 0,
    preparationOutcome: null,
    preparationPhase: null,
    preparedInputs: null,
    resumeReview: emptyResumeReview,
    jobMatchFailure: null,
    notice: null,
    profileEnrichmentFailure: null,
    sourceIntakeFailure: null,
    session: null,
  }),
  id: 'candidate-journey',
  initial: 'readingStoredSession',
  states: {
    candidateSessionAvailable: {
      initial: 'idle',
      states: {
        idle: {},
        rendering: {
          invoke: {
            src: 'renderResumeDocument',
            input: ({ context }) => ({ dependencies: context.dependencies, request: context.resumeRendering?.request ?? null }),
            onDone: { target: 'idle', actions: assign({
              resumeReview: ({ context, event }) => renderedResumeReview({ context, result: event.output }),
              resumeRendering: ({ context, event }) =>
              context.resumeRendering === null ? null : { ...context.resumeRendering,
                result: event.output ?? unavailableResumeRender(context.resumeRendering.request) } }) },
            onError: { target: 'idle', actions: assign({ resumeRendering: ({ context }) =>
              context.resumeRendering === null ? null : { ...context.resumeRendering,
                result: unavailableResumeRender(context.resumeRendering.request) } }) },
          },
        },
      },
      after: {
        candidateSessionExpiration: {
          actions: [recordSessionExpiration, assign({ notice: 'expired-session-discarded' })],
          target: 'removingCandidateSession',
        },
      },
      on: {
        RENDER_RESUME_DOCUMENT: {
          guard: ({ context }) => context.session?.preparedResumeStatus !== 'outdated',
          target: '.rendering', reenter: true,
          actions: assign({
            resumeRendering: ({ context, event }) => prepareResumeRendering({
              input: event.input, previous: context.resumeRendering, sequence: context.resumeRenderSequence + 1,
              revision: `${context.session?.sessionId ?? 'absent'}:${context.dependencies.createSessionId()}:${String(context.resumeRenderSequence + 1)}`,
            }),
            resumeRenderSequence: ({ context }) => context.resumeRenderSequence + 1,
          }),
        },
        INVALIDATE_RESUME_INPUTS: { target: '.idle', actions: assign({ resumeRendering: null, session: ({ context }) => invalidateResumeInputs(context), resumeReview: emptyResumeReview }) },
        SAVE_RESUME: {
          target: '.idle',
          guard: ({ context, event }) => context.session !== null
            && readResumeEditing({ session: context.session }).revision === event.baseRevision,
          actions: assign(({ context, event }) => {
            const result = context.dependencies.persistence.save({ session: event.session })
            if (result.ok && event.baseRevision !== readResumeEditing({ session: result.value }).revision) {
              recordResumeCorrection({ dependencies: context.dependencies, kind: event.correctionKind ?? 'resume-claim-edit' })
            }
            return result.ok ? { session: result.value, resumeReview: emptyResumeReview, resumeRendering: null }
              : { resumeRendering: null, resumeReview: { ...emptyResumeReview, failure: unavailableResumeResult } }
          }),
        },
        REPORT_RESUME: {
          guard: ({ context, event }) => context.session !== null
            && readResumeEditing({ session: context.session }).revision === event.baseRevision,
          actions: assign({ resumeReview: ({ event }) => event.review }),
        },
        UPDATE_RESUME_CONTACTS: {
          target: '.idle',
          actions: assign(({ context, event }) => {
            const session = context.session
            if (session?.tailoredResume === null || session === null) return {}
            const result = context.dependencies.persistence.save({ session: changedResumeSession({ session,
              document: { ...session.tailoredResume, ...event.contacts },
            }) })
            return result.ok ? { session: result.value, resumeReview: emptyResumeReview, resumeRendering: null }
              : { resumeRendering: null, resumeReview: { ...emptyResumeReview, failure: unavailableResumeResult } }
          }),
        },
        UPDATE_RESUME_PHOTO: { actions: assign(({ context, event }) => saveSessionChange({ context,
          change: (session) => withResumePhoto({ session, photo: event.photo }) })) },
        CHANGE_JOB_POSTING: { actions: assign(({ context }) => saveSessionChange({ context, change: (session) =>
          session.preparation === undefined ? session : { ...session, preparation: { ...session.preparation, jobPosting: null } } })) },
        CONFIRM_PROFILE_ENRICHMENT: {
          actions: assign({ profileEnrichmentFailure: null }),
          target: 'processingProfileEnrichment',
        },
        DELETE_CANDIDATE_SESSION: {
          actions: [recordSessionDeletion, assign({ notice: 'deleted' })],
          target: 'removingCandidateSession',
        },
        GRANT_PROCESSING_CONSENT: {
          actions: assign({ session: ({ context }) => withProcessingConsent(context) }),
          target: 'persistingProcessingConsent',
        },
        RESOLVE_CRITICAL_AMBIGUITY: [{
          guard: ({ context }) => context.session?.preparation?.status === 'awaiting-correction',
          target: 'generatingApplicationResume',
        }, { target: 'resolvingCriticalAmbiguity' }],
        SUBMIT_SOURCE_DOCUMENT: {
          actions: assign({ sourceIntakeFailure: null }),
          target: 'processingSourceDocument',
        },
        SUBMIT_JOB_POSTING: {
          actions: assign({ jobMatchFailure: null }),
          guard: ({ context }) => canSubmitJobPosting({ session: context.session }),
          target: 'processingJobPosting',
        },
        START_TAILORED_RESUME_PREPARATION: {
          actions: assign({ session: ({ context, event }) => event.grantProcessingConsent === true
            ? withProcessingConsent(context) : context.session }),
          target: 'generatingApplicationResume',
        },
      },
    },
    generatingApplicationResume: {
      entry: assign({ resumeRendering: null, preparationOutcome: null, preparationPhase: null, preparedInputs: null, resumeReview: emptyResumeReview,
        session: ({ context }) => context.session === null ? null : invalidateEditingRevision(context.session),
      }),
      after: { candidateSessionExpiration: { target: 'removingCandidateSession', actions: [recordSessionExpiration, assign({ notice: 'expired-session-discarded' })] } },
      on: { INVALIDATE_RESUME_INPUTS: { target: 'candidateSessionAvailable', actions: assign({
        session: ({ context }) => invalidateResumeInputs(context), preparationPhase: null, preparationOutcome: null, preparedInputs: null, resumeReview: emptyResumeReview,
      }) }, PREPARATION_PROGRESS: { actions: [({ context, event }) => { recordJourneyPhase({ context, phase: event.phase }) },
        assign({ preparationPhase: ({ event }) => event.phase, session: ({ event }) => event.session })] },
        DELETE_CANDIDATE_SESSION: { target: 'removingCandidateSession', actions: [recordSessionDeletion, assign({ notice: 'deleted' })] },
      },
      initial: 'preparingInputs',
      states: {
        preparingInputs: {
          invoke: {
            src: 'generateApplicationResume',
            input: ({ context, event, self }) => ({ dependencies: context.dependencies, session: context.session,
              request: event.type === 'START_TAILORED_RESUME_PREPARATION' ? event : event.type === 'RESOLVE_CRITICAL_AMBIGUITY' ? { correction: event } : {},
              onProgress: (phase: PreparationPhase, session: CandidateSession) => { self.send({ type: 'PREPARATION_PROGRESS', phase, session }) },
            }),
            onDone: [{
              guard: ({ event }) => event.output.status === 'inputs-prepared',
              target: 'preparingResume',
              actions: assign(({ event }) => event.output.status === 'inputs-prepared'
                ? { preparedInputs: event.output, session: event.output.session } : {}),
            }, { target: '#candidate-journey.candidateSessionAvailable', actions: assign(({ context, event }) => ({
              preparationPhase: null,
              preparationOutcome: event.output.status === 'inputs-prepared' ? unavailable : event.output,
              session: event.output.session ?? context.session,
            })) }],
            onError: { target: '#candidate-journey.candidateSessionAvailable', actions: assign({ preparationPhase: null, preparationOutcome: unavailable }) },
          },
        },
        preparingResume: {
          entry: [({ context }) => { recordJourneyPhase({ context, phase: 'tailored-resume-preparation' }) },
            assign({ preparationPhase: null })],
          on: { RESUME_SECTIONS_PROGRESSED: { actions: assign(({ context, event }) =>
            saveResumeSectionsProgress({ context, sections: event.sections })) } },
          invoke: {
            src: 'resumePreparationMachine',
            input: ({ context }) => readResumePreparationInput(context),
            onDone: { target: '#candidate-journey.candidateSessionAvailable', actions: assign(({ context, event }) => {
              const outcome = context.preparedInputs === null ? unavailable : publishResumePreparation({
                inputs: context.preparedInputs, dependencies: context.dependencies, outcome: event.output })
              return { preparationPhase: null, preparationOutcome: outcome, preparedInputs: null,
                session: 'session' in outcome ? outcome.session ?? context.session : context.session }
            }) },
            onError: { target: '#candidate-journey.candidateSessionAvailable',
              actions: assign({ preparationPhase: null, preparationOutcome: unavailable, preparedInputs: null }) },
          },
        },
      },
    },
    processingJobPosting: {
      entry: assign({ resumeRendering: null }),
      invoke: {
        input: ({ context, event }) => ({
          dependencies: context.dependencies,
          document: event.type === 'SUBMIT_JOB_POSTING' ? event.document : emptyJobPostingDocument,
          session: context.session,
        }),
        onDone: [
          {
            actions: assign({
              jobMatchFailure: null,
              session: ({ event }) => event.output.ok ? event.output.value : null,
            }),
            guard: ({ event }) => event.output.ok,
            target: 'candidateSessionAvailable',
          },
          {
            actions: assign({
              jobMatchFailure: ({ event }) => readJobMatchFailure({ result: event.output }),
            }),
            target: 'candidateSessionAvailable',
          },
        ],
        onError: {
          actions: assign({ jobMatchFailure: 'match-evidence-unavailable' }),
          target: 'candidateSessionAvailable',
        },
        src: 'submitJobPosting',
      },
    },
    processingProfileEnrichment: {
      entry: assign({ resumeRendering: null }),
      invoke: {
        input: ({ context, event }) => ({
          dependencies: context.dependencies,
          kind: event.type === 'CONFIRM_PROFILE_ENRICHMENT' ? event.kind : 'experience',
          requirementId: event.type === 'CONFIRM_PROFILE_ENRICHMENT'
            ? event.requirementId : 'job-requirement-unavailable',
          session: context.session,
          value: event.type === 'CONFIRM_PROFILE_ENRICHMENT' ? event.value : '',
        }),
        onDone: [
          {
            actions: assign({
              profileEnrichmentFailure: null,
              session: ({ event }) => event.output.ok ? event.output.value : null,
            }),
            guard: ({ event }) => event.output.ok,
            target: 'candidateSessionAvailable',
          },
          {
            actions: assign({
              profileEnrichmentFailure: ({ event }) => event.output.ok ? null : event.output.error,
            }),
            target: 'candidateSessionAvailable',
          },
        ],
        onError: {
          actions: assign({ profileEnrichmentFailure: 'match-evidence-unavailable' }),
          target: 'candidateSessionAvailable',
        },
        src: 'confirmProfileEnrichment',
      },
    },
    processingSourceDocument: {
      entry: assign({ resumeRendering: null }),
      invoke: {
        input: ({ context, event }) => ({
          dependencies: context.dependencies,
          document: event.type === 'SUBMIT_SOURCE_DOCUMENT' ? event.document : emptySourceDocument,
          session: context.session,
        }),
        onDone: [
          {
            actions: assign({
              session: ({ event }) => event.output.ok ? event.output.value : null,
              sourceIntakeFailure: null,
            }),
            guard: ({ event }) => event.output.ok,
            target: 'candidateSessionAvailable',
          },
          {
            actions: assign({
              sourceIntakeFailure: ({ event }) => readSourceIntakeFailure({ result: event.output }),
            }),
            target: 'candidateSessionAvailable',
          },
        ],
        onError: {
          actions: assign({ sourceIntakeFailure: 'unreadable-document' }),
          target: 'candidateSessionAvailable',
        },
        src: 'submitSourceDocument',
      },
    },
    removingCandidateSession: {
      entry: assign({ resumeRendering: null }),
      invoke: {
        input: ({ context }) => context.dependencies,
        onDone: [
          {
            actions: assign({ session: null }),
            guard: ({ event }) => event.output.ok,
            target: 'awaitingCandidate',
          },
          { target: 'storageFailure' },
        ],
        onError: { target: 'storageFailure' },
        src: 'deleteCandidateSession',
      },
    },
    awaitingCandidate: {
      on: { START_CANDIDATE_SESSION: { target: 'persistingCandidateSession' } },
    },
    readingStoredSession: {
      invoke: {
        input: ({ context }) => context.dependencies,
        onDone: [
          {
            actions: assign({
              notice: ({ event }) => event.output.ok ? event.output.value.notice : null,
              session: ({ event }) => event.output.ok ? event.output.value.session : null,
            }),
            guard: ({ event }) => event.output.ok && event.output.value.session !== null,
            target: 'candidateSessionAvailable',
          },
          {
            actions: assign({
              notice: ({ event }) => event.output.ok ? event.output.value.notice : null,
            }),
            guard: ({ event }) => event.output.ok,
            target: 'awaitingCandidate',
          },
          { target: 'storageFailure' },
        ],
        onError: { target: 'storageFailure' },
        src: 'restoreCandidateSession',
      },
    },
    persistingCandidateSession: {
      invoke: {
        input: ({ context }) => context.dependencies,
        onDone: [
          {
            actions: [({ context }) => { recordTelemetry({ dependencies: context.dependencies, event: { name: 'resume-tailoring-opened' } }) },
              assign({
                notice: null,
                session: ({ event }) => event.output.ok ? event.output.value : null,
              })],
            guard: ({ event }) => event.output.ok,
            target: 'candidateSessionAvailable',
          },
          { target: 'storageFailure' },
        ],
        onError: { target: 'storageFailure' },
        src: 'startCandidateSession',
      },
    },
    persistingProcessingConsent: {
      entry: assign({ resumeRendering: null }),
      invoke: {
        input: ({ context }) => ({
          dependencies: context.dependencies,
          session: context.session,
        }),
        onDone: [
          {
            actions: assign({
              session: ({ event }) => event.output.ok ? event.output.value : null,
            }),
            guard: ({ event }) => event.output.ok,
            target: 'candidateSessionAvailable',
          },
          { target: 'storageFailure' },
        ],
        onError: { target: 'storageFailure' },
        src: 'grantProcessingConsent',
      },
    },
    resolvingCriticalAmbiguity: {
      entry: assign({ resumeRendering: null }),
      invoke: {
        input: ({ context, event }) => ({
          ambiguityId: event.type === 'RESOLVE_CRITICAL_AMBIGUITY'
            ? event.ambiguityId
            : 'critical-ambiguity-unavailable',
          answer: event.type === 'RESOLVE_CRITICAL_AMBIGUITY' ? event.answer : '',
          dependencies: context.dependencies,
          session: context.session,
        }),
        onDone: [
          {
            actions: assign({
              session: ({ event }) => event.output.ok ? event.output.value : null,
              sourceIntakeFailure: null,
            }),
            guard: ({ event }) => event.output.ok,
            target: 'candidateSessionAvailable',
          },
          {
            actions: assign({
              sourceIntakeFailure: ({ event }) => readSourceIntakeFailure({ result: event.output }),
            }),
            target: 'candidateSessionAvailable',
          },
        ],
        onError: {
          actions: assign({ sourceIntakeFailure: 'ambiguity-unavailable' }),
          target: 'candidateSessionAvailable',
        },
        src: 'persistCriticalAmbiguityResolution',
      },
    },
    storageFailure: {},

  },
})

type CandidateJourneySnapshot = SnapshotFrom<typeof candidateJourneyMachine>

export function createCandidateJourney({ dependencies }: Readonly<{
  dependencies: CandidateJourneyDependencies
}>): CandidateJourney {
  const actor = createActor(candidateJourneyMachine, { input: dependencies })
  let view = readCandidateJourneyView({ snapshot: actor.getSnapshot() })
  actor.subscribe((snapshot) => {
    view = readCandidateJourneyView({ snapshot })
  })
  const editingAccess: ResumeEditingAccess = {
    get ports() { return { ...dependencies.resumeDocumentPorts,
      assessLayout: dependencies.resumeDocumentPorts?.assessLayout ?? (async (request) => {
        const result = await renderCandidateDocument({ dependencies, request })
        return validateResumeRendering({ request, result }).assessment
      }),
    } },
    readReview: () => view.status === 'candidate-session-open' ? view.resumeReview : null,
    readSession: () => actor.getSnapshot().matches('candidateSessionAvailable')
      && view.status === 'candidate-session-open' ? view.session : null,
    hasConsent: () => view.status === 'candidate-session-open' && view.processingConsentStatus === 'granted',
    save: (request) => { actor.send({ type: 'SAVE_RESUME', ...request }) },
    report: (request) => { actor.send({ type: 'REPORT_RESUME', ...request }) },
  }
  return {
    renderResumeDocument: (input) => requestResumeRendering({ actor, input }),
    invalidateResumeInputs: () => { actor.send({ type: 'INVALIDATE_RESUME_INPUTS' }) },
    hideResumeEntry: (request) => { hideResumeEntry({ access: editingAccess, ...request }) },
    restoreResumeEntry: (request) => { restoreResumeEntry({ access: editingAccess, ...request }) },
    assessResumeLayout: (request = {}) => assessResumeLayout({ access: editingAccess, ...request }),
    proposeResumeCondensation: (request = {}) => proposeResumeCondensation({ access: editingAccess, ...request }),
    acceptResumeCondensation: (decision) => { acceptResumeCondensation({ access: editingAccess, decision }) },
    rejectResumeCondensation: (decision) => { rejectResumeCondensation({ access: editingAccess, decision }) },
    attestResumeField: (request) => { attestResumeField({ access: editingAccess, ...request }) },
    hideResumeField: (request) => { hideResumeContent({ access: editingAccess, ...request }) },
    restoreResumeField: (request) => { restoreResumeContent({ access: editingAccess, ...request }) },
    restoreSourceFact: (request) => { restoreSourceFact({ access: editingAccess, ...request }) },
    moveResumeField: (request) => { moveResumeContent({ access: editingAccess, ...request }) },
    reorderResumeSections: (request) => { reorderResumeSections({ access: editingAccess, ...request }) },
    applyValidatedSectionChange: (change) => applyValidatedSectionChange({ access: editingAccess, change }),
    editResumeField: (request) => editResumeField({ access: editingAccess, ...request }),
    updateResumeContacts: (contacts) => { actor.send({ type: 'UPDATE_RESUME_CONTACTS', contacts }) },
    updateResumePhoto: (photo) => { actor.send({ type: 'UPDATE_RESUME_PHOTO', photo }) },
    changeJobPosting: () => { actor.send({ type: 'CHANGE_JOB_POSTING' }) },
    confirmProfileEnrichment: ({ kind, requirementId, value }) => {
      actor.send({ type: 'CONFIRM_PROFILE_ENRICHMENT', kind, requirementId, value })
    },
    deleteCandidateSession: () => { actor.send({ type: 'DELETE_CANDIDATE_SESSION' }) },
    grantProcessingConsent: () => { actor.send({ type: 'GRANT_PROCESSING_CONSENT' }) },
    rateResumeUsefulness: ({ useful }) => { recordResumeOutcome({ dependencies, view,
      event: (matchScoreBand) => ({ name: 'resume-usefulness-rated', hasComment: false, matchScoreBand, useful }) }) },
    recordResumeDownload: () => { recordResumeOutcome({ dependencies, view,
      event: (matchScoreBand) => ({ name: 'resume-downloaded', matchScoreBand }) }) },
    readView: () => view,
    resolveCriticalAmbiguity: ({ ambiguityId, answer }) => {
      actor.send({ type: 'RESOLVE_CRITICAL_AMBIGUITY', ambiguityId, answer })
    },
    start: () => { actor.start() },
    startCandidateSession: () => { actor.send({ type: 'START_CANDIDATE_SESSION' }) },
    startTailoredResumePreparation: (request = {}) => {
      actor.send({ type: 'START_TAILORED_RESUME_PREPARATION', ...request })
    },
    submitJobPosting: ({ document }) => {
      actor.send({ type: 'SUBMIT_JOB_POSTING', document })
    },
    submitSourceDocument: (document) => {
      actor.send({ type: 'SUBMIT_SOURCE_DOCUMENT', document })
    },
    subscribe: (listener) => subscribeToActor({ actor, listener }),
  }
}

function subscribeToActor({ actor, listener }: Readonly<{
  actor: AnyActorRef
  listener: () => void
}>) {
  const subscription = actor.subscribe(listener)
  return () => { subscription.unsubscribe() }
}

function readCandidateJourneyView({ snapshot }: Readonly<{
  snapshot: CandidateJourneySnapshot
}>): CandidateJourneyView {
  if (snapshot.matches('storageFailure')) return { status: 'candidate-session-unavailable' }
  if (snapshot.matches('awaitingCandidate')) {
    return { status: 'candidate-session-absent', notice: snapshot.context.notice }
  }
  if (snapshot.context.session !== null && hasOpenCandidateSession({ snapshot })) {
    return readOpenCandidateSessionView({ snapshot, session: snapshot.context.session })
  }
  return { status: 'preparing-session' }
}

function hasOpenCandidateSession({ snapshot }: Readonly<{ snapshot: CandidateJourneySnapshot }>) {
  return snapshot.matches('candidateSessionAvailable')
    || snapshot.matches('generatingApplicationResume')
    || snapshot.matches('processingJobPosting')
    || snapshot.matches('processingProfileEnrichment')
    || snapshot.matches('processingSourceDocument')
    || snapshot.matches('resolvingCriticalAmbiguity')
    || snapshot.matches('persistingProcessingConsent')
}

function readOpenCandidateSessionView({ snapshot, session }: Readonly<{
  snapshot: CandidateJourneySnapshot
  session: CandidateSession
}>): CandidateJourneyView {
  const processingPolicy = snapshot.context.dependencies.languageModelGateway.processingPolicy
  return {
    preparationOutcome: snapshot.context.preparationOutcome,
    preparationPhase: snapshot.context.preparationPhase,
    resumeReview: readResumeReview({ session, review: snapshot.context.resumeReview }),
    processingConsentStatus: hasProcessingConsentForPolicy({
      consent: session.processingConsent, policy: processingPolicy,
    }) ? 'granted' : 'required',
    processingPolicy,
    jobMatchFailure: snapshot.context.jobMatchFailure,
    operation: readCandidateJourneyOperation({ snapshot }),
    profileEnrichmentFailure: snapshot.context.profileEnrichmentFailure,
    session,
    sourceIntakeFailure: snapshot.context.sourceIntakeFailure,
    status: 'candidate-session-open',
  }
}

function readCandidateJourneyOperation({ snapshot }: Readonly<{
  snapshot: CandidateJourneySnapshot
}>): CandidateJourneyOperation {
  if (snapshot.matches({ candidateSessionAvailable: 'rendering' })) return 'rendering-resume-document'
  if (snapshot.matches('generatingApplicationResume')) return 'preparing-tailored-resume'
  if (snapshot.matches('processingJobPosting')) return 'processing-job-posting'
  if (snapshot.matches('processingProfileEnrichment')) return 'processing-profile-enrichment'
  if (snapshot.matches('processingSourceDocument')) return 'processing-source-document'
  if (snapshot.matches('resolvingCriticalAmbiguity')) return 'resolving-critical-ambiguity'
  return null
}

const storageUnavailableResult = {
  ok: false,
  error: 'candidate-session-storage-unavailable',
} as const
const processingConsentRequiredResult = {
  ok: false,
  error: 'processing-consent-required',
} as const
const ambiguityUnavailableResult = { ok: false, error: 'ambiguity-unavailable' } as const
const profileEnrichmentUnavailableResult = {
  ok: false, error: 'profile-enrichment-unavailable',
} as const
const emptySourceDocument = { bytes: new Uint8Array(), mediaType: '', name: '' } as const
const emptyJobPostingDocument = { bytes: new Uint8Array(), mediaType: '', name: '' } as const

function readSourceIntakeFailure({ result }: Readonly<{
  result: SourceIntakeActorResult | ResolveAmbiguityActorResult
}>): CandidateJourneySourceIntakeFailure | null {
  return result.ok ? null : result.error
}

function readJobMatchFailure({ result }: Readonly<{
  result: JobMatchActorResult
}>): CandidateJourneyJobMatchFailure | null {
  return result.ok ? null : result.error
}

function canSubmitJobPosting({ session }: Readonly<{
  session: CandidateSession | null
}>) {
  return session !== null && (session.phase === 'job-match' || session.phase === 'tailored-resume-preparation')
    && session.sourceIntake !== null
    && session.sourceIntake.criticalAmbiguities.length === 0
}

// Contract vocabulary consumed by BAK-57/58/59 through this existing public seam.
export type {
  ProfessionalResumeDocument, ResumeCondensationOutcome, ResumeCondensationProposal,
  ResumeDocumentPorts, ResumeDocumentReview, ResumeDraft, ResumeExportBlocker, ResumeExportEligibility,
  ResumeLayoutAssessment, ResumeLayoutOutcome, ResumeOperationFailure, ResumePreparationOutcome,
  ResumeProposalDecision, ResumeProposalDecisionOutcome, ResumeSectionChange, ResumeSectionChangeOutcome,
} from './structured-resume-contract'


async function renderCandidateDocument({ dependencies, request }: Readonly<{
  dependencies: CandidateJourneyDependencies; request: ResumeRenderRequest
}>) {
  try {
    return await dependencies.resumeDocumentRenderer?.render(request) ?? unavailableResumeRender(request)
  } catch {
    return unavailableResumeRender(request)
  }
}


async function requestResumeRendering({ actor, input }: Readonly<{
  actor: ReturnType<typeof createActor<typeof candidateJourneyMachine>>; input: ResumeRenderInput
}>): Promise<ResumeRenderResult> {
  actor.send({ type: 'RENDER_RESUME_DOCUMENT', input })
  const rendering = actor.getSnapshot().context.resumeRendering
  if (rendering === null) return unavailableResumeRender({ ...input, draft: { document: input.document, revision: 'unavailable' } })
  try {
    const snapshot = await waitFor(actor, (current) => current.context.resumeRendering?.sequence !== rendering.sequence
      || current.context.resumeRendering.result !== null, { timeout: 60_000 })
    const completed = snapshot.context.resumeRendering
    return completed?.sequence === rendering.sequence && completed.result !== null
      ? completed.result : staleResumeRendering({ request: rendering.request })
  } catch {
    return unavailableResumeRender(rendering.request)
  }
}

function recordResumeCorrection({ dependencies, kind }: Readonly<{
  dependencies: CandidateJourneyDependencies; kind: ResumeCorrectionKind
}>) {
  recordTelemetry({ dependencies, event: { name: 'resume-correction-recorded', correctionKind: kind } })
}

function recordTelemetry({ dependencies, event }: Readonly<{
  dependencies: CandidateJourneyDependencies; event: PrivacySafeTelemetryEvent
}>) {
  void dependencies.telemetry?.record(event).catch(() => undefined)
}

function recordSessionDeletion({ context }: Readonly<{ context: CandidateJourneyContext }>) {
  recordTelemetry({ dependencies: context.dependencies, event: { name: 'candidate-session-deleted' } })
}

function recordSessionExpiration({ context }: Readonly<{ context: CandidateJourneyContext }>) {
  recordTelemetry({ dependencies: context.dependencies, event: { name: 'candidate-session-expired' } })
}

function recordJourneyPhase({ context, phase }: Readonly<{
  context: CandidateJourneyContext; phase: PreparationPhase | 'tailored-resume-preparation'
}>) {
  const reached = readJourneyPhase(phase)
  if (context.preparationPhase !== null && readJourneyPhase(context.preparationPhase) === reached) return
  recordTelemetry({ dependencies: context.dependencies, event: { name: 'candidate-journey-phase-reached', phase: reached } })
}

function readJourneyPhase(phase: PreparationPhase | 'tailored-resume-preparation'): CandidateJourneyPhase {
  if (phase === 'extracting-source') return 'source-intake'
  return phase === 'extracting-posting' || phase === 'matching' ? 'job-match' : phase
}

/**
 * The Journey stays the only writer of the Candidate Session (ADR-0011): each snapshot reported by the
 * preparation machine is saved with the preparation, which also keeps validated sections after a failure.
 */
function saveResumeSectionsProgress({ context, sections }: Readonly<{
  context: CandidateJourneyContext; sections: readonly ResumeSectionSnapshot[]
}>): Partial<CandidateJourneyContext> {
  const { preparedInputs, session, dependencies } = context
  if (preparedInputs === null || session === null || session.expiresAt <= dependencies.now()) return {}
  const preparation = { ...preparedInputs.preparation, sections }
  const progressed = { ...session, preparation }
  dependencies.persistence.save({ session: progressed })
  return { preparedInputs: { ...preparedInputs, preparation }, session: progressed }
}

function recordResumeOutcome({ dependencies, event, view }: Readonly<{
  dependencies: CandidateJourneyDependencies; view: CandidateJourneyView
  event: (matchScoreBand: MatchScoreBand) => PrivacySafeTelemetryEvent
}>) {
  if (view.status !== 'candidate-session-open' || view.session.tailoredResume === null) return
  const jobMatch = view.session.jobMatch ?? view.session.preparation?.jobMatch ?? null
  if (jobMatch === null) return
  recordTelemetry({ dependencies, event: event(readMatchScoreBand(jobMatch.analysis.matchScore)) })
}

function readMatchScoreBand(matchScore: number): MatchScoreBand {
  if (matchScore < 25) return '0-24'
  if (matchScore < 50) return '25-49'
  return matchScore < 75 ? '50-74' : '75-100'
}

function renderedResumeReview({ context, result }: Readonly<{
  context: CandidateJourneyContext; result: ResumeRenderResult | null
}>): ResumeReviewState {
  const { session, resumeRendering, resumeReview } = context
  if (session === null || session.preparedResumeStatus === 'outdated' || resumeRendering === null || result === null) return resumeReview
  const review = readResumeReview({ session, review: resumeReview })
  if (review === null || JSON.stringify(review.draft.document) !== JSON.stringify(resumeRendering.request.draft.document)
    || JSON.stringify(review.unsupportedFieldIds) !== JSON.stringify(resumeRendering.request.unsupportedFieldIds)) return resumeReview
  return { ...resumeReview, assessment: {
    layout: { ...result.assessment.layout, revision: review.draft.revision },
    exportEligibility: { ...result.assessment.exportEligibility, revision: review.draft.revision },
  } }
}
