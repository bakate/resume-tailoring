import type { PrivacySafeTelemetry } from './resume-tailoring-workflow-ports'
import type { ResumeCorrectionKind } from './resume-editing'
import { assessResumeLayout, proposeResumeCondensation, acceptResumeCondensation, rejectResumeCondensation } from './resume-condensation'
import type { ResumeProposalDecision } from './structured-resume-contract'
import { hideResumeEntry, restoreResumeEntry, attestResumeField, hideResumeContent, restoreResumeContent, moveResumeContent, reorderResumeSections, restoreSourceFact } from './resume-content-recovery'
import type { ResumeSectionName } from './tailored-resume'
import { applyValidatedSectionChange, changedResumeSession, editResumeField, emptyResumeReview,
  readResumeEditing, readResumeReview, unavailableResumeResult } from './resume-editing'
import type { ResumeEditingAccess, ResumeReview, ResumeReviewState } from './resume-editing'
import type { ResumeDocumentPorts, ResumeSectionChange } from './structured-resume-contract'
import { assign, createActor, fromPromise, setup } from 'xstate'
import type { AnyActorRef, SnapshotFrom } from 'xstate'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
} from '@resume-tailoring/domain/candidate-session'
import type {
  CandidateSession,
  CandidateJourneyPhase,
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
import { createTailoredResume } from './tailored-resume'
import type { TailoredResume, TailoredResumeLocale } from './tailored-resume'
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
  telemetry?: PrivacySafeTelemetry
  resumeDocumentPorts?: Partial<ResumeDocumentPorts>
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
  dependencies: CandidateJourneyDependencies
  resumeReview: ResumeReviewState
  jobMatchFailure: CandidateJourneyJobMatchFailure | null
  notice: CandidateSessionNotice
  profileEnrichmentFailure: ProfileEnrichmentFailure | null
  sourceIntakeFailure: CandidateJourneySourceIntakeFailure | null
  session: CandidateSession | null
}>

type ResumeContacts = Pick<TailoredResume, 'identity' | 'contactDetails'>

type CandidateJourneyEvent =
  | Readonly<{ type: 'SAVE_RESUME'; session: CandidateSession; baseRevision: string; correctionKind?: ResumeCorrectionKind }>
  | Readonly<{ type: 'REPORT_RESUME'; review: ResumeReviewState; baseRevision: string }>
  | Readonly<{ type: 'UPDATE_RESUME_CONTACTS'; contacts: ResumeContacts }>
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
  | Readonly<{ type: 'START_TAILORED_RESUME_PREPARATION'; locale?: TailoredResumeLocale }>
  | Readonly<{ type: 'SUBMIT_JOB_POSTING'; document: JobPostingDocument }>

type RestoredCandidateSession = Readonly<{
  notice: CandidateSessionNotice
  session: CandidateSession | null
}>

type CandidateJourneyOperation = 'preparing-tailored-resume' | 'processing-job-posting'
  | 'processing-profile-enrichment' | 'processing-source-document'
  | 'resolving-critical-ambiguity' | null

export type CandidateJourneyView =
  | Readonly<{ status: 'preparing-session' }>
  | Readonly<{ status: 'candidate-session-absent'; notice: CandidateSessionNotice }>
  | Readonly<{
      status: 'candidate-session-open'
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
  hideResumeEntry: (request: Readonly<{ experienceId: string }>) => void
  restoreResumeEntry: (request: Readonly<{ experienceId: string }>) => void
  assessResumeLayout: () => Promise<void>
  proposeResumeCondensation: () => Promise<void>
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
  confirmProfileEnrichment: (request: Readonly<{
    kind: ProfileEnrichmentFactKind
    requirementId: JobRequirementId
    value: string
  }>) => void
  deleteCandidateSession: () => void
  grantProcessingConsent: () => void
  readView: () => CandidateJourneyView
  resolveCriticalAmbiguity: (request: Readonly<{
    ambiguityId: `critical-ambiguity-${string}`
    answer: string
  }>) => void
  start: () => void
  startCandidateSession: () => void
  startTailoredResumePreparation: (request?: Readonly<{ locale?: TailoredResumeLocale }>) => void
  submitJobPosting: (request: Readonly<{ document: JobPostingDocument }>) => void
  submitSourceDocument: (document: SourceDocument) => void
  subscribe: (listener: () => void) => () => void
}>

const restoreCandidateSession = fromPromise<
  CandidateSessionStorageResult<RestoredCandidateSession>,
  CandidateJourneyDependencies
>(({ input }) => Promise.resolve(input.persistence.restore({ now: input.now() })))

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

const startTailoredResumePreparation = fromPromise<
  CandidateSessionStorageResult<CandidateSession>,
  Readonly<{
    dependencies: CandidateJourneyDependencies
    locale?: TailoredResumeLocale
    session: CandidateSession | null
  }>
>(({ input }) => {
  const session = input.session
  if (session === null || session.sourceIntake === null || session.jobMatch === null
    || !canStartTailoredResumePreparation({ session })) {
    return Promise.resolve(storageUnavailableResult)
  }
  const tailoredResume = createTailoredResume({
    jobMatch: session.jobMatch, locale: input.locale, sourceIntake: session.sourceIntake,
  })
  return Promise.resolve(input.dependencies.persistence.save({
    session: { ...session, phase: 'tailored-resume-preparation', tailoredResume,
      resumeEditing: { revision: crypto.randomUUID(), hiddenFields: [], unsupportedFieldIds: [], manuallyEdited: false } },
  }))
})

function canStartTailoredResumePreparation({ session }: Readonly<{
  session: CandidateSession | null
}>) {
  return session?.jobMatch?.analysis.generationEligibility === 'eligible'
}

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
    ...input.session,
    jobMatch: null,
    tailoredResume: null, resumeEditing: undefined, resumeFactLocations: undefined,
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
  if (input.session?.sourceIntake === null || input.session === null) {
    return Promise.resolve(ambiguityUnavailableResult)
  }
  const resolution = resolveCriticalAmbiguity({
    answer: input.answer,
    criticalAmbiguityId: input.ambiguityId,
    sourceIntake: input.session.sourceIntake,
  })
  if (!resolution.ok) return Promise.resolve(resolution)
  const nextSession = {
    ...input.session,
    jobMatch: null,
    tailoredResume: null, resumeEditing: undefined, resumeFactLocations: undefined,
    phase: resolution.value.criticalAmbiguities.length === 0
      ? 'job-match' as const
      : 'source-intake' as const,
    sourceIntake: resolution.value,
  }
  return Promise.resolve(input.dependencies.persistence.save({ session: nextSession }))
})

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
    session: { ...session, jobMatch: jobMatchResult.value, tailoredResume: null, resumeEditing: undefined },
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
  const session = input.session
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
    ...session,
    jobMatch: jobMatchResult.value, tailoredResume: null, resumeEditing: undefined,
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

const candidateJourneyMachine = setup({
  actors: {
    confirmProfileEnrichment,
    deleteCandidateSession,
    grantProcessingConsent,
    persistCriticalAmbiguityResolution,
    restoreCandidateSession,
    startCandidateSession,
    startTailoredResumePreparation,
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
      after: {
        candidateSessionExpiration: {
          actions: assign({ notice: 'expired-session-discarded' }),
          target: 'removingCandidateSession',
        },
      },
      on: {
        SAVE_RESUME: {
          guard: ({ context, event }) => context.session !== null
            && readResumeEditing({ session: context.session }).revision === event.baseRevision,
          actions: assign(({ context, event }) => {
            const result = context.dependencies.persistence.save({ session: event.session })
            if (result.ok && event.baseRevision !== readResumeEditing({ session: result.value }).revision) {
              recordResumeCorrection({ dependencies: context.dependencies, kind: event.correctionKind ?? 'resume-claim-edit' })
            }
            return result.ok ? { session: result.value, resumeReview: emptyResumeReview }
              : { resumeReview: { ...emptyResumeReview, failure: unavailableResumeResult } }
          }),
        },
        REPORT_RESUME: {
          guard: ({ context, event }) => context.session !== null
            && readResumeEditing({ session: context.session }).revision === event.baseRevision,
          actions: assign({ resumeReview: ({ event }) => event.review }),
        },
        UPDATE_RESUME_CONTACTS: {
          actions: assign(({ context, event }) => {
            const session = context.session
            if (session?.tailoredResume === null || session === null) return {}
            const result = context.dependencies.persistence.save({ session: changedResumeSession({ session,
              document: { ...session.tailoredResume, ...event.contacts },
            }) })
            return result.ok ? { session: result.value, resumeReview: emptyResumeReview }
              : { resumeReview: { ...emptyResumeReview, failure: unavailableResumeResult } }
          }),
        },
        CONFIRM_PROFILE_ENRICHMENT: {
          actions: assign({ profileEnrichmentFailure: null }),
          target: 'processingProfileEnrichment',
        },
        DELETE_CANDIDATE_SESSION: {
          actions: assign({ notice: 'deleted' }),
          target: 'removingCandidateSession',
        },
        GRANT_PROCESSING_CONSENT: {
          actions: assign({
            session: ({ context }) => context.session === null ? null : {
              ...context.session,
              processingConsent: {
                grantedAt: context.dependencies.now(),
                policy: context.dependencies.languageModelGateway.processingPolicy,
              },
            },
          }),
          target: 'persistingProcessingConsent',
        },
        RESOLVE_CRITICAL_AMBIGUITY: {
          target: 'resolvingCriticalAmbiguity',
        },
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
          guard: ({ context }) => canStartTailoredResumePreparation({ session: context.session }),
          target: 'startingTailoredResumePreparation',
        },
      },
    },
    processingJobPosting: {
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
            actions: assign({
              notice: null,
              session: ({ event }) => event.output.ok ? event.output.value : null,
            }),
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
    startingTailoredResumePreparation: {
      invoke: {
        input: ({ context, event }) => ({
          dependencies: context.dependencies,
          locale: event.type === 'START_TAILORED_RESUME_PREPARATION' ? event.locale : undefined,
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
        src: 'startTailoredResumePreparation',
      },
    },
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
    ports: dependencies.resumeDocumentPorts ?? {},
    readReview: () => view.status === 'candidate-session-open' ? view.resumeReview : null,
    readSession: () => actor.getSnapshot().matches('candidateSessionAvailable')
      && view.status === 'candidate-session-open' ? view.session : null,
    hasConsent: () => view.status === 'candidate-session-open' && view.processingConsentStatus === 'granted',
    save: (request) => { actor.send({ type: 'SAVE_RESUME', ...request }) },
    report: (request) => { actor.send({ type: 'REPORT_RESUME', ...request }) },
  }
  return {
    hideResumeEntry: (request) => { hideResumeEntry({ access: editingAccess, ...request }) },
    restoreResumeEntry: (request) => { restoreResumeEntry({ access: editingAccess, ...request }) },
    assessResumeLayout: () => assessResumeLayout({ access: editingAccess }),
    proposeResumeCondensation: () => proposeResumeCondensation({ access: editingAccess }),
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
    confirmProfileEnrichment: ({ kind, requirementId, value }) => {
      actor.send({ type: 'CONFIRM_PROFILE_ENRICHMENT', kind, requirementId, value })
    },
    deleteCandidateSession: () => { actor.send({ type: 'DELETE_CANDIDATE_SESSION' }) },
    grantProcessingConsent: () => { actor.send({ type: 'GRANT_PROCESSING_CONSENT' }) },
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
    || snapshot.matches('processingJobPosting')
    || snapshot.matches('processingProfileEnrichment')
    || snapshot.matches('processingSourceDocument')
    || snapshot.matches('resolvingCriticalAmbiguity')
    || snapshot.matches('startingTailoredResumePreparation')
    || snapshot.matches('persistingProcessingConsent')
}

function readOpenCandidateSessionView({ snapshot, session }: Readonly<{
  snapshot: CandidateJourneySnapshot
  session: CandidateSession
}>): CandidateJourneyView {
  const processingPolicy = snapshot.context.dependencies.languageModelGateway.processingPolicy
  return {
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
  if (snapshot.matches('processingJobPosting')) return 'processing-job-posting'
  if (snapshot.matches('startingTailoredResumePreparation')) return 'preparing-tailored-resume'
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
  ResumeLayoutAssessment, ResumeLayoutOutcome, ResumeOperationFailure, ResumePreparationOutcome, ResumePreparationRequest,
  ResumeProposalDecision, ResumeProposalDecisionOutcome, ResumeSectionChange, ResumeSectionChangeOutcome,
} from './structured-resume-contract'

function recordResumeCorrection({ dependencies, kind }: Readonly<{
  dependencies: CandidateJourneyDependencies; kind: ResumeCorrectionKind
}>) {
  void dependencies.telemetry?.record({ name: 'resume-correction-recorded', correctionKind: kind }).catch(() => undefined)
}
