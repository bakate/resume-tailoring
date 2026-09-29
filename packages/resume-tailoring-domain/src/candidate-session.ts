import type { ProcessingConsent } from './processing-policy'

export const candidateJourneyPhases = [
  'source-intake',
  'job-match',
  'tailored-resume-preparation',
] as const

export type CandidateJourneyPhase = typeof candidateJourneyPhases[number]
export type CandidateSessionId = `candidate-session-${string}`

export const candidateSessionStorageVersion = 2
export const candidateSessionDurationMilliseconds = 24 * 60 * 60 * 1_000

export type CandidateSession = Readonly<{
  expiresAt: number
  phase: CandidateJourneyPhase
  processingConsent: ProcessingConsent | null
  sessionId: CandidateSessionId
  startedAt: number
  version: typeof candidateSessionStorageVersion
}>

export function hasValidCandidateSessionLifetime({ session }: Readonly<{
  session: Pick<CandidateSession, 'expiresAt' | 'startedAt'>
}>) {
  return session.expiresAt === session.startedAt + candidateSessionDurationMilliseconds
}
