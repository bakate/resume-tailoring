import {
  jobRequirementClassifications,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type {
  JobRequirementContent,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import { sensitiveContentSchema } from './source-profile-schemas'

export const atomicJobRequirementPattern = /^(?!.*(?:[;,/|•]|\s(?:and|or|et|ou)\s|\s&\s))[^\n]+$/iu
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
})

export const extractedJobRequirementsSchema = z.object({
  requirements: z.array(jobRequirementContentSchema),
})

export const jobRequirementExtractionSuccessSchema = z.object({
  ok: z.literal(true),
  value: z.array(jobRequirementContentSchema),
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
  })),
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
}: Readonly<{
  jobPostingContent: string
  requirements: readonly JobRequirementContent[]
}>) {
  return requirements.every(({ sourceExcerpt }) => jobPostingContent.includes(sourceExcerpt))
}

function isAtomicValue({ value }: Readonly<{ value: string }>) {
  return value.trim() === value
    && atomicJobRequirementPattern.test(value)
}
