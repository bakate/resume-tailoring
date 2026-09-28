import {
  jobRequirementClassifications,
  jobRequirementMaximumCount,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type {
  JobPostingTargetRole,
  JobRequirementContent,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import {
  hasSourceBackedTargetRole,
  jobPostingTargetRoleSchema,
} from './job-posting-target-role-schema'
import { sensitiveContentSchema } from './source-profile-schemas'

export const jobRequirementValueMaximumCharacters = 500
export const jobRequirementSourceExcerptMaximumCharacters = 2_000

const jobRequirementContentShape = {
  classification: z.enum(jobRequirementClassifications),
  sourceExcerpt: z.string().min(1).max(jobRequirementSourceExcerptMaximumCharacters),
  value: z.string().min(1).max(jobRequirementValueMaximumCharacters),
} as const

const jobRequirementContentSchema = z.object(jobRequirementContentShape).superRefine((requirement, context) => {
  if (!isAtomicValue({ value: requirement.value })) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'Expected one atomic requirement' })
  }
  if (!requirement.sourceExcerpt.includes(requirement.value)) {
    context.addIssue({
      code: 'custom', path: ['value'], message: 'Expected an exact Job Posting substring',
    })
  }
})
const jobRequirementContentsSchema = z.array(jobRequirementContentSchema).max(jobRequirementMaximumCount)

export const extractedJobRequirementsSchema = z.object({
  targetRole: jobPostingTargetRoleSchema.nullable(),
  requirements: jobRequirementContentsSchema,
})

export const jobRequirementExtractionSuccessSchema = z.object({
  ok: z.literal(true),
  value: extractedJobRequirementsSchema,
})

export const jobRequirementExtractionResultSchema = z.discriminatedUnion('ok', [
  jobRequirementExtractionSuccessSchema,
  z.object({
    ok: z.literal(false),
    error: z.object({ type: z.literal('job-requirement-extraction-unavailable') }),
  }),
])

export const jobPostingReviewSchema = z.object({
  status: z.enum(['reviewing-posting', 'reviewing-requirements']),
  detectedSensitiveContent: z.array(sensitiveContentSchema),
  outgoingContent: z.string(),
  processingNotice: z.object({
    version: z.string(),
    confirmedAt: z.number(),
    provider: z.string(),
    retentionPolicy: z.string(),
    transmittedDataCategories: z.array(z.string()),
  }).nullable(),
  targetRole: jobPostingTargetRoleSchema.nullable().optional(),
  requirements: z.array(z.object({
    classification: jobRequirementContentShape.classification,
    sourceExcerpt: jobRequirementContentShape.sourceExcerpt,
    value: jobRequirementContentShape.value,
    id: z.templateLiteral(['job-requirement-', z.string().min(1)]),
    groupId: z.templateLiteral(['job-requirement-group-', z.string().min(1)]),
  }).superRefine((requirement, context) => {
    if (!isAtomicValue({ value: requirement.value })) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'Expected one atomic requirement' })
    }
    if (!requirement.sourceExcerpt.includes(requirement.value)) {
      context.addIssue({
        code: 'custom', path: ['value'], message: 'Expected an exact Job Posting substring',
      })
    }
  })).max(jobRequirementMaximumCount),
}).superRefine((jobPosting, context) => {
  if (hasSourceBackedTargetRole({
    jobPostingContent: jobPosting.outgoingContent,
    targetRole: jobPosting.targetRole,
  })) return
  context.addIssue({
    code: 'custom', path: ['targetRole', 'sourceExcerpt'], message: 'Expected exact Job Posting source',
  })
})

export const jobRequirementExtractionMaximumCharacters = 100_000

export const jobRequirementExtractionRequestSchema = z.object({
  jobPostingContent: z.string()
    .max(jobRequirementExtractionMaximumCharacters)
    .refine((value) => value.trim().length > 0),
})

export function hasOnlyJobPostingSourceExcerpts({
  jobPostingContent,
  requirements,
  targetRole,
}: Readonly<{
  jobPostingContent: string
  requirements: readonly JobRequirementContent[]
  targetRole: JobPostingTargetRole | null
}>) {
  return hasSourceBackedTargetRole({ jobPostingContent, targetRole })
    && requirements.every(({ sourceExcerpt, value }) => (
      jobPostingContent.includes(sourceExcerpt) && sourceExcerpt.includes(value)
    ))
}

function isAtomicValue({ value }: Readonly<{ value: string }>) {
  return value.trim() === value
    && !value.includes('\n')
    && !value.includes(';')
}
