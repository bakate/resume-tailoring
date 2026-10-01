import type { CandidateSession, ResumePreparation, StoredIntakeDocument, ResumePreparationFailure } from '@resume-tailoring/domain/candidate-session'
import { hasProcessingConsentForPolicy } from '@resume-tailoring/domain/processing-policy'
import type { CandidateJourneyDependencies } from './candidate-journey'
import { createJobMatch, maximumJobPostingBytes } from './job-match'
import type { JobPostingDocument } from './job-match'
import { createSourceIntake, resolveCriticalAmbiguity, maximumSourceDocumentBytes } from './source-intake'
import type { CandidateFact, SourceDocument, SourceIntake } from './source-intake'
import { inferTailoredResumeLocale, readLocalResumeContacts } from './tailored-resume'
import type { TailoredResumeLocale } from './tailored-resume'
import type { ResumeOperationFailure, ResumePreparationOutcome } from './structured-resume-contract'
import type { ResumeSectionsRequest } from './resume-sections'

export type CombinedIntakeRequest = Readonly<{
  grantProcessingConsent?: true
  sourceDocument?: SourceDocument
  jobPosting?: JobPostingDocument
  locale?: TailoredResumeLocale | null
  purpose?: 'tailored' | 'normalized'
  correction?: Readonly<{ ambiguityId: `critical-ambiguity-${string}`; answer: string }>
}>
/** Progress before the Resume Sections are written; the sections snapshot reports the rest (ADR-0016). */
export type PreparationPhase = 'extracting-source' | 'extracting-posting' | 'matching'
export type CombinedIntakeOutcome =
  | Readonly<{ status: 'prepared'; session: CandidateSession; revision: string }>
  | Readonly<{ status: 'no-relevant-evidence'; alternative: 'normalized'; revision: string; session: CandidateSession }>
  | Readonly<{ status: 'awaiting-correction'; session: CandidateSession }>
  | (ResumeOperationFailure & Readonly<{ session?: CandidateSession; detail?: string }>)

/** Source Intake and Job Match are ready; the Resume Sections are written next by the preparation machine. */
export type PreparedResumeInputs = Readonly<{
  status: 'inputs-prepared'; session: CandidateSession; preparation: ResumePreparation; request: ResumeSectionsRequest
}>

type PreparationContext = Readonly<{
  dependencies: CandidateJourneyDependencies
  session: CandidateSession
  preparation: ResumePreparation
  signal?: AbortSignal
  onProgress: (phase: PreparationPhase, session: CandidateSession) => void
}>

export async function prepareCombinedIntake(input: Omit<PreparationContext, 'preparation'> & Readonly<{
  request: CombinedIntakeRequest
}>): Promise<CombinedIntakeOutcome | PreparedResumeInputs> {
  const oversized = input.request.sourceDocument !== undefined && input.request.sourceDocument.bytes.byteLength > maximumSourceDocumentBytes
    ? 'oversized-document' : input.request.jobPosting !== undefined && input.request.jobPosting.bytes.byteLength > maximumJobPostingBytes
      ? 'oversized-job-posting' : null
  const context = { ...input, session: invalidateChangedInputs(input),
    preparation: createPreparation(oversized === null ? input : { ...input, request: {} }) }
  if (oversized !== null) return failPreparation({ context, detail: oversized })
  if (!hasProcessingConsentForPolicy({ consent: input.session.processingConsent,
    policy: input.dependencies.languageModelGateway.processingPolicy })) return failPreparation({ context, detail: 'processing-consent-required' })
  if (!savePreparation(context)) return failPreparation({ context, detail: 'candidate-session-storage-unavailable' })
  try { return await prepareSource(context) } catch { return failPreparation({ context, detail: 'unavailable' }) }
}

function invalidateChangedInputs({ request, session }: Readonly<{ request: CombinedIntakeRequest; session: CandidateSession }>): CandidateSession {
  if (session.tailoredResume === null || (request.sourceDocument === undefined
    && request.jobPosting === undefined && request.locale === undefined)) return session
  return { ...session, preparedResumeStatus: 'outdated' }
}

function createPreparation({ dependencies, request, session }: Readonly<{
  dependencies: CandidateJourneyDependencies; request: CombinedIntakeRequest; session: CandidateSession
}>): ResumePreparation {
  const previous = session.preparation
  const locale = request.locale === undefined ? previous?.locale ?? null : request.locale
  const purpose = request.purpose ?? (request.sourceDocument === undefined && request.jobPosting === undefined ? previous?.purpose : undefined) ?? 'tailored'
  const reusesInputs = request.sourceDocument === undefined && request.jobPosting === undefined && request.correction === undefined
  const sourceIntake = request.sourceDocument === undefined
    ? previous?.revision === session.preparedResumeRevision ? session.sourceIntake : previous?.sourceIntake ?? session.sourceIntake : null
  return {
    revision: `${session.sessionId}:${dependencies.createSessionId()}`, status: 'pending', failure: null,
    sourceDocument: request.sourceDocument === undefined ? previous?.sourceDocument ?? null : storeDocument(request.sourceDocument),
    jobPosting: request.jobPosting === undefined ? previous?.jobPosting ?? null : storeDocument(request.jobPosting),
    locale, purpose, sourceIntake: correctSource({ sourceIntake, correction: request.correction }),
    jobMatch: reusesInputs ? previous?.jobMatch ?? session.jobMatch : null,
    ...(reusesInputs && previous !== undefined && canResumeSections({ previous, locale, purpose })
      ? { sections: previous.sections } : {}),
  }
}

const resumableStatuses: ReadonlySet<ResumePreparation['status']> = new Set(['pending', 'interrupted', 'failed'])

/** Only an unfinished preparation of the same inputs is resumed; changed inputs write every section again. */
function canResumeSections({ previous, locale, purpose }: Readonly<{
  previous: ResumePreparation; locale: ResumePreparation['locale']; purpose: ResumePreparation['purpose']
}>) {
  return previous.sections !== undefined && resumableStatuses.has(previous.status)
    && previous.locale === locale && previous.purpose === purpose
}

function correctSource({ sourceIntake, correction }: Readonly<{
  sourceIntake: SourceIntake | null; correction: CombinedIntakeRequest['correction']
}>) {
  if (sourceIntake === null || correction === undefined) return sourceIntake
  const result = resolveCriticalAmbiguity({ sourceIntake, answer: correction.answer,
    criticalAmbiguityId: correction.ambiguityId })
  return result.ok ? result.value : sourceIntake
}

async function prepareSource(context: PreparationContext): Promise<CombinedIntakeOutcome | PreparedResumeInputs> {
  if (context.preparation.sourceIntake !== null) return preparePosting(context)
  const document = context.preparation.sourceDocument
  if (document === null) return failPreparation({ context, detail: 'empty-document' })
  reportProgress({ context, phase: 'extracting-source' })
  const result = await createSourceIntake({ ...context.dependencies, document: restoreDocument(document) })
  if (!result.ok) return failPreparation({ context, detail: result.error })
  const next = { ...context, preparation: { ...context.preparation, sourceIntake: result.value, sourceDocument: null } }
  if (!savePreparation(next)) return failPreparation({ context: next, detail: 'candidate-session-storage-unavailable' })
  return preparePosting(next)
}

async function preparePosting(context: PreparationContext): Promise<CombinedIntakeOutcome | PreparedResumeInputs> {
  const source = context.preparation.sourceIntake
  if (source === null) return failPreparation({ context, detail: 'empty-document' })
  if (!hasUsableEvidence(source)) return source.criticalAmbiguities.length > 0
    ? awaitCorrection(context) : failPreparation({ context, detail: 'empty-document' })
  if (context.preparation.jobMatch !== null) return prepareDocument(context)
  const document = context.preparation.jobPosting
    ?? (context.session.jobMatch === null ? null : storeTextPosting(context.session.jobMatch.jobPosting.originalContent))
  if (document === null) return failPreparation({ context, detail: 'empty-job-posting' })
  reportProgress({ context, phase: 'extracting-posting' })
  const result = await createJobMatch({ ...context.dependencies, candidateFacts: safeCandidateFacts(source),
    document: restoreDocument(document), matchEvidenceMatcher: { match: (request) => {
      reportProgress({ context, phase: 'matching' })
      return context.dependencies.matchEvidenceMatcher.match(request)
    } } })
  if (!result.ok) return failPreparation({ context, detail: result.error })
  const next = { ...context, preparation: { ...context.preparation, jobMatch: result.value } }
  if (!savePreparation(next)) return failPreparation({ context: next, detail: 'candidate-session-storage-unavailable' })
  return prepareDocument(next)
}

function prepareDocument(context: PreparationContext): CombinedIntakeOutcome | PreparedResumeInputs {
  const { sourceIntake, jobMatch, purpose } = context.preparation
  if (sourceIntake === null || jobMatch === null) return failPreparation({ context, detail: 'unavailable' })
  if (purpose === 'tailored' && jobMatch.analysis.generationEligibility === 'denied') return noCorrespondence(context)
  if (context.dependencies.resumeSectionModels === undefined) return failPreparation({ context, detail: 'unavailable' })
  if (context.signal?.aborted === true) return unavailable
  return { status: 'inputs-prepared', session: context.session, preparation: context.preparation, request: {
    candidateFacts: safeCandidateFacts(sourceIntake), jobMatch, purpose,
    locale: context.preparation.locale ?? inferTailoredResumeLocale({ content: jobMatch.jobPosting.originalContent }),
  } }
}

/** Publishes the outcome of the resume preparation machine as the prepared Tailored Resume. */
export function publishResumePreparation({ inputs, dependencies, outcome }: Readonly<{
  inputs: PreparedResumeInputs; dependencies: CandidateJourneyDependencies; outcome: ResumePreparationOutcome | undefined
}>): CombinedIntakeOutcome {
  return publishDocument({ context: { dependencies, session: inputs.session, preparation: inputs.preparation,
    onProgress: () => undefined }, outcome })
}

function publishDocument({ context, outcome }: Readonly<{
  context: PreparationContext; outcome: ResumePreparationOutcome | undefined
}>): CombinedIntakeOutcome {
  if (outcome?.status !== 'prepared') return failPreparation({ context, detail: outcome?.status === 'failed' ? outcome.reason : 'unavailable' })
  if (outcome.revision !== context.preparation.revision) return failPreparation({ context, detail: 'stale-result' })
  const sourceIntake = context.preparation.sourceIntake
  if (sourceIntake === null) return failPreparation({ context, detail: 'unavailable' })
  const session: CandidateSession = { ...context.session, sourceIntake, jobMatch: context.preparation.jobMatch,
    phase: 'tailored-resume-preparation', preparedResumeStatus: 'current', preparedResumeRevision: outcome.revision, preparation: { ...context.preparation, status: 'prepared' },
    resumeEditing: { revision: outcome.revision, hiddenFields: [], unsupportedFieldIds: [], manuallyEdited: false },
    resumeFactLocations: context.session.resumeFactLocations?.filter(({ factId }) => sourceIntake.candidateFacts.some(({ id }) => id === factId)),
    tailoredResume: { ...outcome.document, ...localResumeContacts({ sourceIntake, session: context.session }) } }
  if (!canPublish(context)) return unavailable
  const saved = context.dependencies.persistence.save({ session })
  return saved.ok ? { status: 'prepared', revision: outcome.revision, session }
    : failPreparation({ context, detail: 'candidate-session-storage-unavailable' })
}

function localResumeContacts({ sourceIntake, session }: Readonly<{ sourceIntake: SourceIntake; session: CandidateSession }>) {
  if (sourceIntake === session.sourceIntake && session.tailoredResume !== null) {
    return { identity: session.tailoredResume.identity, contactDetails: session.tailoredResume.contactDetails }
  }
  return readLocalResumeContacts({ sourceIntake })
}

function noCorrespondence(context: PreparationContext): CombinedIntakeOutcome {
  const preparation = { ...context.preparation, status: 'no-relevant-evidence' as const }
  const session = { ...context.session, preparation }
  if (!savePreparation({ ...context, preparation })) return failPreparation({ context, detail: 'candidate-session-storage-unavailable' })
  return { status: 'no-relevant-evidence', alternative: 'normalized', revision: preparation.revision, session }
}

function awaitCorrection(context: PreparationContext): CombinedIntakeOutcome {
  const preparation = { ...context.preparation, status: 'awaiting-correction' as const }
  if (!savePreparation({ ...context, preparation })) return failPreparation({ context, detail: 'candidate-session-storage-unavailable' })
  return { status: 'awaiting-correction', session: { ...context.session, preparation } }
}

function failPreparation({ context, detail }: Readonly<{ context: PreparationContext; detail: ResumePreparationFailure }>): CombinedIntakeOutcome {
  const preparation = { ...context.preparation, status: 'failed' as const, failure: detail }
  savePreparation({ ...context, preparation })
  const reason = detail === 'processing-consent-required' ? detail
    : detail === 'unsupported-content' || detail === 'stale-result' ? detail : 'unavailable'
  return { status: 'failed', reason, detail, session: { ...context.session, preparation },
    recovery: reason === 'processing-consent-required' ? 'renew-consent'
      : reason === 'unsupported-content' ? 'correct-content' : 'retry' }
}

function savePreparation(context: PreparationContext) {
  if (!canPublish(context)) return false
  return context.dependencies.persistence.save({ session: { ...context.session, preparation: context.preparation } }).ok
}

function canPublish({ dependencies, session, signal }: PreparationContext) {
  return signal?.aborted !== true && session.expiresAt > dependencies.now()
}

function reportProgress({ context, phase }: Readonly<{ context: PreparationContext; phase: PreparationPhase }>) {
  if (canPublish(context)) context.onProgress(phase, { ...context.session, preparation: context.preparation })
}

function hasUsableEvidence(source: SourceIntake) {
  return safeCandidateFacts(source).some(({ path, value }) => value.trim().length > 0
    && !/\.(category|organization|startDate|endDate)\./u.test(path))
}

function safeCandidateFacts(source: SourceIntake): readonly CandidateFact[] {
  const unsafeEntries = source.criticalAmbiguities.filter(({ path }) => /^experiences\.\d+\.(role|organization)\./u.test(path))
    .map(({ path }) => path.split('.').slice(0, 2).join('.'))
  return source.candidateFacts.filter(({ status, path }) => status === 'attested'
    && !unsafeEntries.some((entry) => path.startsWith(`${entry}.`)))
}

function storeDocument(document: SourceDocument): StoredIntakeDocument {
  let binary = ''
  for (const byte of document.bytes) binary += String.fromCharCode(byte)
  return { data: btoa(binary), mediaType: document.mediaType, name: document.name }
}

function restoreDocument(document: StoredIntakeDocument): SourceDocument {
  return { bytes: Uint8Array.from(atob(document.data), (character) => character.charCodeAt(0)),
    mediaType: document.mediaType, name: document.name }
}

function storeTextPosting(text: string) {
  return storeDocument({ bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'job-posting.txt' })
}

export const unavailable = { status: 'failed', reason: 'unavailable', recovery: 'retry' } as const
