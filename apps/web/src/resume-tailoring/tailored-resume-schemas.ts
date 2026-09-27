import { z } from 'zod'

import {
  hasSourceBackedTargetRole,
  jobPostingTargetRoleSchema,
} from './job-posting-target-role-schema'
import { resumePdfFailureTypes } from './tailored-resume-contract'

const resumeClaimIdSchema = z.string().regex(/^resume-claim-[\w-]+$/u).max(200)
  .transform((claimId) => claimId as `resume-claim-${string}`)
const sourceProfileFactIdSchema = z.string().regex(/^source-fact-[\w-]+$/u).max(200)
  .transform((factId) => factId as `source-fact-${string}`)
const jobRequirementIdSchema = z.string().regex(/^job-requirement-[\w-]+$/u).max(200)
  .transform((requirementId) => requirementId as `job-requirement-${string}`)
const factIdsSchema = z.array(sourceProfileFactIdSchema).min(1).max(20)
const resumeClaimSchema = z.object({
  id: resumeClaimIdSchema,
  segments: z.array(z.object({
    factIds: factIdsSchema,
    text: z.string().trim().min(1).max(500),
  }).strict()).min(1).max(20),
}).strict()
const verifiedFactSchema = z.object({
  id: sourceProfileFactIdSchema,
  kind: z.enum(['experience', 'skill', 'education', 'language', 'project']),
  value: z.string().trim().min(1).max(500),
}).strict()
const evidenceSchema = z.object({
  factIds: factIdsSchema,
  requirementId: jobRequirementIdSchema,
}).strict()
const requirementSchema = z.object({
  classification: z.enum(['required', 'preferred']),
  id: jobRequirementIdSchema,
}).strict()
const contactItemSchema = z.object({
  kind: z.enum(['address', 'email', 'phone', 'url']),
  value: z.string().trim().min(1).max(500),
}).strict()
export const resumePdfRequestSchema = z.object({
  contactItems: z.array(contactItemSchema).max(20),
  jobPostingContent: z.string().max(100_000),
  locale: z.enum(['en', 'fr']),
  targetRole: jobPostingTargetRoleSchema.nullable(),
  photoDataUrl: z.string()
    .max(2_800_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/u)
    .optional(),
  source: z.object({
    claims: z.array(resumeClaimSchema).min(1).max(100),
    evidence: z.array(evidenceSchema).max(200),
    requirements: z.array(requirementSchema).max(200),
    verifiedFacts: z.array(verifiedFactSchema).min(1).max(500),
  }).strict(),
}).strict().superRefine((request, context) => {
  if (hasSourceBackedTargetRole({
    jobPostingContent: request.jobPostingContent,
    targetRole: request.targetRole,
  })) return
  context.addIssue({
    code: 'custom', path: ['targetRole', 'sourceExcerpt'], message: 'Expected exact Job Posting source',
  })
})

export const resumePdfFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    type: z.enum(resumePdfFailureTypes),
  }).strict(),
}).strict()
