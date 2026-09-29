import { z } from 'zod'

import {
  candidateJourneyPhases,
  candidateSessionStorageVersion,
  hasValidCandidateSessionLifetime,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'

const candidateSessionIdPattern = /^candidate-session-[0-9a-f-]+$/u

export const candidateSessionSchema = z.strictObject({
  expiresAt: z.number().int().positive(),
  phase: z.enum(candidateJourneyPhases),
  sessionId: z.custom<CandidateSession['sessionId']>(
    (value) => typeof value === 'string' && candidateSessionIdPattern.test(value),
  ),
  startedAt: z.number().int().nonnegative(),
  version: z.literal(candidateSessionStorageVersion),
}).refine(
  (session) => hasValidCandidateSessionLifetime({ session }),
  { message: 'Candidate Session lifetime must be exactly 24 hours' },
)
