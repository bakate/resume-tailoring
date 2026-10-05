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

export type StoredIntakeDocument = Readonly<{ data: string; mediaType: string; name: string }>

export type ResumePreparation = Readonly<{
  revision: string
  status: 'outdated' | 'pending' | 'interrupted' | 'awaiting-correction' | 'no-relevant-evidence' | 'failed' | 'prepared'
  sourceDocument: StoredIntakeDocument | null
  jobPosting: StoredIntakeDocument | null
  locale: 'en' | 'fr' | null
  purpose: 'tailored' | 'normalized'
  sourceIntake: SourceIntake | null
  jobMatch: JobMatch | null
  failure: ResumePreparationFailure | null
  sections?: readonly ResumeSectionSnapshot[]
}>

/** One Resume Section as the preparation machine last reported it; text exists only once validated. */
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
