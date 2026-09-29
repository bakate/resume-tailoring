import { z } from 'zod'

import {
  capabilityDimensions,
  requirementCoverages,
  requirementImportances,
} from '@resume-tailoring/application/job-match'

const requirementIdSchema = z.templateLiteral(['job-requirement-', z.string().min(1)])
const candidateFactIdSchema = z.templateLiteral(['source-fact-', z.string().min(1)])
const sourceExcerptSchema = z.string().min(1).max(2_000)
const requirementValueSchema = z.string().min(1).max(500)

const targetRoleSchema = z.strictObject({
  sourceExcerpt: sourceExcerptSchema,
  value: z.string().min(1).max(200),
})

const practicalConstraintSchema = z.strictObject({
  sourceExcerpt: sourceExcerptSchema,
  value: requirementValueSchema,
})

const extractedRequirementSchema = z.strictObject({
  capability: z.strictObject({
    dimension: z.enum(capabilityDimensions),
    name: z.string().min(1).max(200),
  }),
  importance: z.enum(requirementImportances),
  importanceRationale: z.string().min(1).max(300),
  sourceExcerpt: sourceExcerptSchema,
  substitutableGroup: z.string().min(1).max(200).nullable(),
  value: requirementValueSchema,
})

export const jobPostingExtractionSchema = z.strictObject({
  practicalConstraints: z.array(practicalConstraintSchema).max(100),
  requirements: z.array(extractedRequirementSchema).min(1).max(100),
  targetRole: targetRoleSchema.nullable(),
})

export const jobPostingExtractionSuccessSchema = z.strictObject({
  ok: z.literal(true),
  value: z.strictObject({
    practicalConstraints: z.array(practicalConstraintSchema).max(100),
    requirements: z.array(extractedRequirementSchema.extend({
      id: requirementIdSchema,
      substitutableGroup: z.string().min(1).max(200).optional(),
    })).min(1).max(100),
    targetRole: targetRoleSchema.nullable(),
  }),
})

export const jobPostingExtractionRequestSchema = z.strictObject({
  jobPostingContent: z.string().trim().min(1).max(100_000),
})

const candidateFactSchema = z.strictObject({
  id: candidateFactIdSchema,
  kind: z.enum(['certification', 'education', 'experience', 'language', 'project', 'skill']),
  value: z.string().min(1).max(1_000),
})

const matchingRequirementSchema = z.strictObject({
  capability: z.strictObject({
    dimension: z.enum(capabilityDimensions),
    name: z.string().min(1).max(200),
  }),
  id: requirementIdSchema,
  importance: z.enum(requirementImportances),
  importanceRationale: z.string().min(1).max(300),
  sourceExcerpt: sourceExcerptSchema,
  substitutableGroup: z.string().min(1).max(200).optional(),
  value: requirementValueSchema,
})

export const matchEvidenceRequestSchema = z.strictObject({
  candidateFacts: z.array(candidateFactSchema).max(500),
  requirements: z.array(matchingRequirementSchema).min(1).max(100),
})

const proposedFactMatchSchema = z.strictObject({
  factId: candidateFactIdSchema,
  factTerm: z.string().min(2).max(100),
  relationship: z.enum(['controlled', 'exact']),
  requirementTerm: z.string().min(2).max(100),
})

export const matchEvidenceProposalSchema = z.strictObject({
  evidence: z.array(z.strictObject({
    coverage: z.enum(requirementCoverages),
    factMatches: z.array(proposedFactMatchSchema).min(1).max(500),
    requirementId: requirementIdSchema,
  })).max(100),
  relevantFactIds: z.array(candidateFactIdSchema).max(500),
})

export const matchEvidenceSuccessSchema = z.strictObject({
  ok: z.literal(true),
  value: matchEvidenceProposalSchema,
})

export const jobPostingExtractionResponseFormat = createResponseFormat({
  name: 'explainable_job_posting',
  schema: jobPostingExtractionSchema,
})

export const matchEvidenceResponseFormat = createResponseFormat({
  name: 'explainable_match_evidence',
  schema: matchEvidenceProposalSchema,
})

function createResponseFormat({ name, schema }: Readonly<{
  name: string
  schema: z.ZodType
}>) {
  return {
    name,
    schema: z.toJSONSchema(schema, { target: 'draft-7' }),
    strict: true,
    type: 'json_schema',
  } as const
}
