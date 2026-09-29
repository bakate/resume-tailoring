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
  createSessionId: () => string
  languageModelGateway: Readonly<{ processingPolicy: ProcessingPolicy }>
  now: () => number
  persistence: CandidateSessionPersistence
  sourceDocumentReader: SourceDocumentReader
  sourceProfileExtractor: StructuredSourceProfileExtractor
}>

type CandidateJourneySourceIntakeFailure =
  | SourceIntakeFailure
  | 'ambiguity-unavailable'
  | 'candidate-session-storage-unavailable'

type CandidateJourneyContext = Readonly<{
  dependencies: CandidateJourneyDependencies
  notice: CandidateSessionNotice
  sourceIntakeFailure: CandidateJourneySourceIntakeFailure | null
  session: CandidateSession | null
}>

type CandidateJourneyEvent =
  | Readonly<{ type: 'DELETE_CANDIDATE_SESSION' }>
  | Readonly<{ type: 'GRANT_PROCESSING_CONSENT' }>
  | Readonly<{ type: 'RESOLVE_CRITICAL_AMBIGUITY'; ambiguityId: `critical-ambiguity-${string}`; answer: string }>
  | Readonly<{ type: 'SUBMIT_SOURCE_DOCUMENT'; document: SourceDocument }>
  | Readonly<{ type: 'START_CANDIDATE_SESSION' }>

type RestoredCandidateSession = Readonly<{
  notice: CandidateSessionNotice
  session: CandidateSession | null
}>

export type CandidateJourneyView =
  | Readonly<{ status: 'preparing-session' }>
  | Readonly<{ status: 'candidate-session-absent'; notice: CandidateSessionNotice }>
  | Readonly<{
      status: 'candidate-session-open'
      processingConsentStatus: 'granted' | 'required'
      processingPolicy: ProcessingPolicy
      operation: 'processing-source-document' | 'resolving-critical-ambiguity' | null
      session: CandidateSession
      sourceIntakeFailure: CandidateJourneySourceIntakeFailure | null
    }>
  | Readonly<{ status: 'candidate-session-unavailable' }>

export type CandidateJourney = Readonly<{
  deleteCandidateSession: () => void
  grantProcessingConsent: () => void
  readView: () => CandidateJourneyView
  resolveCriticalAmbiguity: (request: Readonly<{
    ambiguityId: `critical-ambiguity-${string}`
    answer: string
  }>) => void
  start: () => void
  startCandidateSession: () => void
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
    phase: 'source-intake',
    processingConsent: null,
    sessionId: `candidate-session-${input.createSessionId()}`,
    sourceIntake: null,
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
    ...input.session,
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
    phase: resolution.value.criticalAmbiguities.length === 0
      ? 'job-match' as const
      : 'source-intake' as const,
    sourceIntake: resolution.value,
  }
  return Promise.resolve(input.dependencies.persistence.save({ session: nextSession }))
})

const candidateJourneyMachine = setup({
  actors: {
    deleteCandidateSession,
    grantProcessingConsent,
    persistCriticalAmbiguityResolution,
    restoreCandidateSession,
    startCandidateSession,
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
    notice: null,
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
  return {
    deleteCandidateSession: () => { actor.send({ type: 'DELETE_CANDIDATE_SESSION' }) },
    grantProcessingConsent: () => { actor.send({ type: 'GRANT_PROCESSING_CONSENT' }) },
    readView: () => view,
    resolveCriticalAmbiguity: ({ ambiguityId, answer }) => {
      actor.send({ type: 'RESOLVE_CRITICAL_AMBIGUITY', ambiguityId, answer })
    },
    start: () => { actor.start() },
    startCandidateSession: () => { actor.send({ type: 'START_CANDIDATE_SESSION' }) },
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
  if (snapshot.context.session !== null && (
    snapshot.matches('candidateSessionAvailable')
    || snapshot.matches('processingSourceDocument')
    || snapshot.matches('resolvingCriticalAmbiguity')
    || snapshot.matches('persistingProcessingConsent')
  )) {
    const processingPolicy = snapshot.context.dependencies.languageModelGateway.processingPolicy
    return {
      processingConsentStatus: hasProcessingConsentForPolicy({
        consent: snapshot.context.session.processingConsent,
        policy: processingPolicy,
      }) ? 'granted' : 'required',
      processingPolicy,
      operation: snapshot.matches('processingSourceDocument')
        ? 'processing-source-document'
        : snapshot.matches('resolvingCriticalAmbiguity')
          ? 'resolving-critical-ambiguity'
          : null,
      session: snapshot.context.session,
      sourceIntakeFailure: snapshot.context.sourceIntakeFailure,
      status: 'candidate-session-open',
    }
  }
  return { status: 'preparing-session' }
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
const emptySourceDocument = { bytes: new Uint8Array(), mediaType: '', name: '' } as const

function readSourceIntakeFailure({ result }: Readonly<{
  result: SourceIntakeActorResult | ResolveAmbiguityActorResult
}>): CandidateJourneySourceIntakeFailure | null {
  return result.ok ? null : result.error
}
