import type { ProcessingConsent } from './processing-policy'
import type { CandidateFactId, SourceIntake } from './source-intake'
import type { JobMatch } from './job-match'
import type { TailoredResume, ResumeEditingState, ResumeFieldLocation, ResumeSectionContent, ResumeSectionKind } from './tailored-resume'

export const candidateJourneyPhases = [
  'source-intake',
  'job-match',
  'tailored-resume-preparation',
] as const

export type CandidateJourneyPhase = typeof candidateJourneyPhases[number]
export type CandidateSessionId = `candidate-session-${string}`

export const candidateSessionStorageVersion = 7
export const candidateSessionDurationMilliseconds = 24 * 60 * 60 * 1_000

export type CandidateSession = Readonly<{
  preparedResumeStatus?: 'current' | 'outdated'
  preparedResumeRevision?: string
  preparation?: ResumePreparation
  expiresAt: number
  jobMatch: JobMatch | null
  phase: CandidateJourneyPhase
  processingConsent: ProcessingConsent | null
  sessionId: CandidateSessionId
  sourceIntake: SourceIntake | null
  tailoredResume: TailoredResume | null
  resumeEditing?: ResumeEditingState
  resumeFactLocations?: readonly Readonly<{ factId: CandidateFactId; location: ResumeFieldLocation }>[]
  /** The optional photo shown in the Tailored Resume; browser-local and deleted with the session. */
  resumePhoto?: ResumePhoto
  startedAt: number
  version: typeof candidateSessionStorageVersion
}>

export type ResumePhoto = Readonly<{ dataUrl: string; name: string }>

export function hasValidCandidateSessionLifetime({ session }: Readonly<{
  session: Pick<CandidateSession, 'expiresAt' | 'startedAt'>
}>) {
  return session.expiresAt === session.startedAt + candidateSessionDurationMilliseconds
}

/** A Candidate Session ends at its expiry instant: from then on it can no longer be reused. */
export function isCandidateSessionExpired({ session, now }: Readonly<{
  session: Pick<CandidateSession, 'expiresAt'>
  now: number
}>) {
  return session.expiresAt <= now
}

/**
 * The preparation that produced the published Tailored Resume keeps no copy of the Source Intake and Job Match the
 * session publishes, nor the Resume Section drafts the published resume superseded.
 */
export function settlePublishedPreparation({ session }: Readonly<{ session: CandidateSession }>): CandidateSession {
  const preparation = session.preparation
  if (preparation === undefined || preparation.revision !== session.preparedResumeRevision) return session
  const { revision, status, sourceDocument, jobPosting, locale, purpose } = preparation
  return { ...session, preparation: { revision, status, sourceDocument, jobPosting, locale, purpose,
    sourceIntake: null, jobMatch: null, failure: null } }
}

export type StoredIntakeDocument = Readonly<{ data: string; mediaType: string; name: string }>

export type ResumePreparation = Readonly<{
  revision: string
  status: 'outdated' | 'pending' | 'interrupted' | 'awaiting-correction' | 'no-relevant-evidence' | 'failed' | 'prepared'
  sourceDocument: StoredIntakeDocument | null
  jobPosting: StoredIntakeDocument | null
  locale: 'en' | 'fr' | null
  purpose: 'tailored' | 'normalized'
  /** Null once prepared: the Candidate Session's own Source Intake and Job Match are then the published ones. */
  sourceIntake: SourceIntake | null
  jobMatch: JobMatch | null
  failure: ResumePreparationFailure | null
  /** Why a model-backed step failed; absent when the failure has no Failure Cause, such as an unreadable document. */
  failureCause?: FailureCause
  /** Kept only to resume an unfinished preparation; dropped once the Tailored Resume is published. */
  sections?: readonly ResumeSectionSnapshot[]
}>

/**
 * One Resume Section as the preparation machine last reported it; text exists only once validated. A validated
 * experience copied from its Candidate Facts keeps `origin: 'copied-from-source'` on its experience.
 */
export type ResumeSectionSnapshot = Readonly<{ key: string; kind: ResumeSectionKind; attempt: number }> & (
  | Readonly<{ status: 'planned' | 'writing' | 'validating' | 'failed' }>
  | Readonly<{ status: 'validated'; content: ResumeSectionContent }>)

export const resumePreparationFailures = [
  'encrypted-document', 'empty-document', 'invalid-document', 'oversized-document',
  'scanned-document', 'unsupported-document', 'unreadable-document',
  'source-profile-extraction-unavailable', 'processing-consent-required',
  'empty-job-posting', 'invalid-job-posting', 'oversized-job-posting', 'scanned-job-posting',
  'unsupported-job-posting', 'unreadable-job-posting', 'job-posting-extraction-unavailable',
  'match-evidence-unavailable', 'candidate-session-storage-unavailable', 'unavailable',
  'unsupported-content', 'incoherent-content', 'stale-result',
] as const
export type ResumePreparationFailure = typeof resumePreparationFailures[number]

/** The provider-neutral reasons a model-backed operation fails, from which the application derives the Recovery. */
export const failureCauseTypes = [
  'access-required', 'rate-limited', 'timeout', 'input-too-large', 'service-unavailable', 'network', 'unexpected',
] as const
export type FailureCause =
  | Readonly<{ type: 'rate-limited'; retryAfterSeconds: number }>
  | Readonly<{ type: Exclude<typeof failureCauseTypes[number], 'rate-limited'> }>
