import type {
  JobRequirement,
  MatchEvidence,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  jobRequirementClassifications,
  jobRequirementMaximumCount,
  sourceProfileFactKinds,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

const jobRequirementIdSchema = z.templateLiteral(['job-requirement-', z.string().min(1)])
const sourceProfileFactIdSchema = z.templateLiteral(['source-fact-', z.string().min(1)])
export const sourceProfileFactMaximumCount = 500

const matchEvidenceSchema = z.object({
  requirementId: jobRequirementIdSchema,
  factIds: z.array(sourceProfileFactIdSchema).min(1).max(sourceProfileFactMaximumCount),
})

export const extractedMatchEvidenceSchema = z.object({
  evidence: z.array(matchEvidenceSchema).max(jobRequirementMaximumCount),
})

export const storedMatchAnalysisSchema = extractedMatchEvidenceSchema

export const matchAnalysisSuccessSchema = z.object({
  ok: z.literal(true),
  value: z.array(matchEvidenceSchema).max(jobRequirementMaximumCount),
})

export const matchAnalysisResultSchema = z.discriminatedUnion('ok', [
  matchAnalysisSuccessSchema,
  z.object({
    ok: z.literal(false),
    error: z.object({ type: z.literal('match-analysis-unavailable') }),
  }),
])

export const matchAnalysisRequestSchema = z.object({
  requirements: z.array(z.object({
    id: jobRequirementIdSchema,
    groupId: z.templateLiteral(['job-requirement-group-', z.string().min(1)]),
    classification: z.enum(jobRequirementClassifications),
    sourceExcerpt: z.string().min(1).max(2_000),
    value: z.string().min(1).max(500),
  })).max(jobRequirementMaximumCount),
  verifiedFacts: z.array(z.object({
    id: sourceProfileFactIdSchema,
    kind: z.enum(sourceProfileFactKinds),
    propositionKey: z.templateLiteral(['proposition-', z.string().min(1)]),
    status: z.literal('verified'),
    supersedesFactId: sourceProfileFactIdSchema.optional(),
    value: z.string().min(1).max(500),
  })).max(sourceProfileFactMaximumCount),
})

export function hasOnlyMatchInputReferences({
  evidence,
  requirements,
  verifiedFacts,
}: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>) {
  const requirementIds = new Set(requirements.map(({ id }) => id))
  const verifiedFactIds = new Set(verifiedFacts.map(({ id }) => id))
  const referencedRequirementIds = new Set<string>()
  return evidence.every((item) => {
    if (referencedRequirementIds.has(item.requirementId)) return false
    referencedRequirementIds.add(item.requirementId)
    return requirementIds.has(item.requirementId)
      && new Set(item.factIds).size === item.factIds.length
      && item.factIds.every((factId) => verifiedFactIds.has(factId))
  })
}
