import type {
  ProposedResumeClaim,
  ResumeClaimWritingInputs,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  jobRequirementClassifications,
  sourceProfileFactKinds,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

const sourceProfileFactIdSchema = z.templateLiteral(['source-fact-', z.string().min(1)])
const jobRequirementIdSchema = z.templateLiteral(['job-requirement-', z.string().min(1)])
const resumeClaimIdSchema = z.templateLiteral(['resume-claim-', z.string().min(1)])
const resumeClaimMaximumCount = 100
const resumeClaimSegmentMaximumCount = 20
const sourceReferenceMaximumCount = 20

const resumeClaimSegmentSchema = z.object({
  text: z.string().min(1).max(500),
  factIds: z.array(sourceProfileFactIdSchema).min(1).max(sourceReferenceMaximumCount),
})

export const proposedResumeClaimSchema = z.object({
  segments: z.array(resumeClaimSegmentSchema).min(1).max(resumeClaimSegmentMaximumCount),
})

export const proposedResumeClaimsSchema = z.object({
  claims: z.array(proposedResumeClaimSchema).max(resumeClaimMaximumCount),
})

const resumeClaimWritingInputsSchema = z.object({
  evidence: z.array(z.object({
    requirementId: jobRequirementIdSchema,
    factIds: z.array(sourceProfileFactIdSchema).min(1).max(sourceReferenceMaximumCount),
  })).max(resumeClaimMaximumCount),
  requirements: z.array(z.object({
    id: jobRequirementIdSchema,
    classification: z.enum(jobRequirementClassifications),
    value: z.string().min(1).max(500),
  })).max(resumeClaimMaximumCount),
  verifiedFacts: z.array(z.object({
    id: sourceProfileFactIdSchema,
    kind: z.enum(sourceProfileFactKinds),
    value: z.string().min(1).max(500),
  })).max(500),
})

const validationFeedbackSchema = z.object({
  code: z.enum([
    'invalid-fact-reference',
    'missing-segment-provenance',
    'unsupported-number-or-date',
    'unsupported-meaning',
  ]),
  segmentIndex: z.number().int().min(0).optional(),
})

export const resumeClaimWritingRequestSchema = z.discriminatedUnion('operation', [
  resumeClaimWritingInputsSchema.extend({ operation: z.literal('write') }),
  resumeClaimWritingInputsSchema.extend({
    operation: z.literal('reformulate'),
    claim: proposedResumeClaimSchema,
    feedback: z.array(validationFeedbackSchema).max(resumeClaimSegmentMaximumCount),
    request: z.string().trim().min(1).max(500).optional(),
  }),
])

export const resumeClaimWritingResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: proposedResumeClaimsSchema }),
  z.object({
    ok: z.literal(false),
    error: z.object({ type: z.literal('resume-claim-writing-unavailable') }),
  }),
])

export const resumeClaimValidationRequestSchema = z.object({
  claim: proposedResumeClaimSchema.extend({ id: resumeClaimIdSchema }),
  verifiedFacts: resumeClaimWritingInputsSchema.shape.verifiedFacts,
})

export const resumeClaimValidationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: z.boolean() }),
  z.object({
    ok: z.literal(false),
    error: z.object({ type: z.literal('resume-claim-validation-unavailable') }),
  }),
])

export const storedTailoredResumeSchema = z.object({
  claims: z.array(proposedResumeClaimSchema.extend({ id: resumeClaimIdSchema }))
    .max(resumeClaimMaximumCount),
  exclusions: z.array(z.object({
    reason: z.literal('unsupported-after-regeneration'),
  })).max(resumeClaimMaximumCount),
})

export function hasOnlyResumeClaimInputReferences({
  claims,
  inputs,
}: Readonly<{
  claims: readonly ProposedResumeClaim[]
  inputs: ResumeClaimWritingInputs
}>) {
  const verifiedFactIds = new Set(inputs.verifiedFacts.map(({ id }) => id))
  return claims.every((claim) => claim.segments.every((segment) =>
    new Set(segment.factIds).size === segment.factIds.length
    && segment.factIds.every((factId) => verifiedFactIds.has(factId))))
}
