import type { ProcessingConsent } from './processing-policy'
import type { SourceIntake } from './source-intake'
import type { JobMatch } from './job-match'
import type { TailoredResume } from './tailored-resume'

export const candidateJourneyPhases = [
  'source-intake',
  'job-match',
  'tailored-resume-preparation',
] as const

export type CandidateJourneyPhase = typeof candidateJourneyPhases[number]
export type CandidateSessionId = `candidate-session-${string}`

export const candidateSessionStorageVersion = 5
export const candidateSessionDurationMilliseconds = 24 * 60 * 60 * 1_000

export type CandidateSession = Readonly<{
  expiresAt: number
  jobMatch: JobMatch | null
  phase: CandidateJourneyPhase
  processingConsent: ProcessingConsent | null
  sessionId: CandidateSessionId
  sourceIntake: SourceIntake | null
  tailoredResume: TailoredResume | null
  startedAt: number
  version: typeof candidateSessionStorageVersion
}>

export function hasValidCandidateSessionLifetime({ session }: Readonly<{
  session: Pick<CandidateSession, 'expiresAt' | 'startedAt'>
}>) {
  return session.expiresAt === session.startedAt + candidateSessionDurationMilliseconds
}
