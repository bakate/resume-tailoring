import { z } from 'zod'

import {
  candidateJourneyPhases,
  candidateSessionStorageVersion,
  hasValidCandidateSessionLifetime,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { structuredSourceProfileSchema } from './structured-source-profile-schema'

const processingPolicySchema = z.strictObject({
  provider: z.string().min(1),
  purposes: z.array(z.string().min(1)).readonly(),
  retentionPolicy: z.string().min(1),
  storageBehavior: z.string().min(1),
  transmittedDataCategories: z.array(z.string().min(1)).readonly(),
  version: z.string().min(1),
})

const candidateSessionIdPattern = /^candidate-session-[0-9a-f-]+$/u
const candidateFactIdSchema = z.templateLiteral(['source-fact-', z.string().min(1)])

const sourceIntakeSchema = z.strictObject({
  candidateFacts: z.array(z.strictObject({
    id: candidateFactIdSchema,
    path: z.string().min(1),
    status: z.enum(['attested', 'excluded-critical-ambiguity']),
    value: z.string(),
  })),
  contactDetails: z.array(z.strictObject({
    kind: z.enum(['address', 'date-of-birth', 'email', 'personal-information', 'phone', 'url']),
    value: z.string().min(1),
  })),
  criticalAmbiguities: z.array(z.strictObject({
    candidateFactId: candidateFactIdSchema,
    id: z.templateLiteral(['critical-ambiguity-', z.string().min(1)]),
    path: z.string().min(1),
    question: z.string().min(1),
  })),
  originalContent: z.string().min(1),
  sourceDocument: z.strictObject({
    kind: z.enum(['docx', 'pasted-text', 'pdf']),
    name: z.string().min(1),
  }),
  sourceProfile: structuredSourceProfileSchema,
})

export const candidateSessionSchema = z.strictObject({
  expiresAt: z.number().int().positive(),
  phase: z.enum(candidateJourneyPhases),
  processingConsent: z.strictObject({
    grantedAt: z.number().int().nonnegative(),
    policy: processingPolicySchema,
  }).nullable(),
  sessionId: z.custom<CandidateSession['sessionId']>(
    (value) => typeof value === 'string' && candidateSessionIdPattern.test(value),
  ),
  sourceIntake: sourceIntakeSchema.nullable(),
  startedAt: z.number().int().nonnegative(),
  version: z.literal(candidateSessionStorageVersion),
}).refine(
  (session) => hasValidCandidateSessionLifetime({ session }),
  { message: 'Candidate Session lifetime must be exactly 24 hours' },
)
