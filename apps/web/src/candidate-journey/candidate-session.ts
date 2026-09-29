import { z } from 'zod'

import {
  candidateJourneyPhases,
  candidateSessionStorageVersion,
  hasValidCandidateSessionLifetime,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { structuredSourceProfileSchema } from './structured-source-profile-schema'
import {
  capabilityDimensions,
  matchBands,
  requirementCoverages,
  requirementImportances,
} from '@resume-tailoring/application/job-match'

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
const requirementIdSchema = z.templateLiteral(['job-requirement-', z.string().min(1)])

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

const jobRequirementSchema = z.strictObject({
  capability: z.strictObject({
    dimension: z.enum(capabilityDimensions),
    name: z.string().min(1),
  }),
  id: requirementIdSchema,
  importance: z.enum(requirementImportances),
  importanceRationale: z.string().min(1),
  sourceExcerpt: z.string().min(1),
  substitutableGroup: z.string().min(1).optional(),
  value: z.string().min(1),
})

const jobMatchSchema = z.strictObject({
  analysis: z.strictObject({
    criticalRequirementReserve: z.strictObject({
      requirementIds: z.array(requirementIdSchema),
      status: z.enum(['clear', 'present']),
    }),
    evidence: z.array(z.strictObject({
      coverage: z.enum(requirementCoverages),
      factIds: z.array(candidateFactIdSchema),
      requirementId: requirementIdSchema,
    })),
    generationEligibility: z.enum(['denied', 'eligible']),
    matchBand: z.enum(matchBands),
    matchBandQualification: z.literal('critical-requirement-reserve').nullable(),
    matchScore: z.number().int().min(0).max(100),
    relevantFactIds: z.array(candidateFactIdSchema),
    requirementGroups: z.array(z.strictObject({
      capabilities: z.array(jobRequirementSchema.shape.capability),
      coverage: z.enum([...requirementCoverages, 'uncovered']),
      effectiveWeight: z.number().nonnegative(),
      importance: z.enum(requirementImportances),
      requirementIds: z.array(requirementIdSchema),
    })),
  }),
  jobPosting: z.strictObject({
    kind: z.enum(['pasted-text', 'pdf', 'txt']),
    name: z.string().min(1),
    originalContent: z.string().min(1),
  }),
  practicalConstraints: z.array(z.strictObject({
    sourceExcerpt: z.string().min(1),
    value: z.string().min(1),
  })),
  priorityGapRequirementIds: z.array(requirementIdSchema).max(3),
  requirements: z.array(jobRequirementSchema).min(1),
  strengthRequirementIds: z.array(requirementIdSchema).max(3),
  targetRole: z.strictObject({
    sourceExcerpt: z.string().min(1),
    value: z.string().min(1),
  }).nullable(),
})

export const candidateSessionSchema = z.strictObject({
  expiresAt: z.number().int().positive(),
  jobMatch: jobMatchSchema.nullable(),
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
