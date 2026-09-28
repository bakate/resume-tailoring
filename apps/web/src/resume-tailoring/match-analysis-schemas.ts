import type {
  JobRequirementId,
  MatchInputs,
  ProposedMatchAnalysis,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  jobRequirementClassifications,
  jobRequirementMaximumCount,
  requirementCoverages,
  sourceProfileFactKinds,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

const jobRequirementIdSchema = z.templateLiteral(['job-requirement-', z.string().min(1)])
const sourceProfileFactIdSchema = z.templateLiteral(['source-fact-', z.string().min(1)])
export const sourceProfileFactMaximumCount = 500

const proposedFactMatchSchema = z.object({
  factId: sourceProfileFactIdSchema,
  factTerm: z.string().min(2).max(100),
  relationship: z.enum(['exact', 'controlled']),
  requirementTerm: z.string().min(2).max(100),
})

const proposedMatchEvidenceSchema = z.object({
  coverage: z.enum(requirementCoverages),
  requirementId: jobRequirementIdSchema,
  factMatches: z.array(proposedFactMatchSchema).min(1).max(sourceProfileFactMaximumCount),
})

export const extractedMatchEvidenceSchema = z.object({
  evidence: z.array(proposedMatchEvidenceSchema).max(jobRequirementMaximumCount),
  improvementOpportunities: z.array(z.string().min(1).max(300)).max(3),
  relevantFactIds: z.array(sourceProfileFactIdSchema).max(sourceProfileFactMaximumCount),
})

const storedMatchEvidenceSchema = z.object({
  coverage: z.enum(requirementCoverages).default('covered'),
  requirementId: jobRequirementIdSchema,
  factIds: z.array(sourceProfileFactIdSchema).min(1).max(sourceProfileFactMaximumCount),
})

export const storedMatchAnalysisSchema = z.object({
  evidence: z.array(storedMatchEvidenceSchema).max(jobRequirementMaximumCount),
  improvementOpportunities: z.array(z.string().min(1).max(300)).max(3).default([]),
  relevantFactIds: z.array(sourceProfileFactIdSchema).max(sourceProfileFactMaximumCount),
})

export const matchAnalysisSuccessSchema = z.object({
  ok: z.literal(true),
  value: extractedMatchEvidenceSchema,
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
    classification: z.enum(jobRequirementClassifications),
    value: z.string().min(1).max(500),
  })).max(jobRequirementMaximumCount),
  verifiedFacts: z.array(z.object({
    id: sourceProfileFactIdSchema,
    kind: z.enum(sourceProfileFactKinds),
    value: z.string().min(1).max(500),
  })).max(sourceProfileFactMaximumCount),
})

export function hasOnlyMatchInputReferences({
  analysis,
  requirements,
  verifiedFacts,
}: Readonly<{
  analysis: ProposedMatchAnalysis
  requirements: MatchInputs['requirements']
  verifiedFacts: MatchInputs['verifiedFacts']
}>) {
  const requirementIds = new Set(requirements.map(({ id }) => id))
  const verifiedFactIds = new Set(verifiedFacts.map(({ id }) => id))
  const referencedRequirementIds = new Set<JobRequirementId>()
  const relevantFactIds = new Set(analysis.relevantFactIds)
  if (relevantFactIds.size !== analysis.relevantFactIds.length
    || analysis.relevantFactIds.some((factId) => !verifiedFactIds.has(factId))) return false
  return analysis.evidence.every((item) => {
    if (referencedRequirementIds.has(item.requirementId)) return false
    referencedRequirementIds.add(item.requirementId)
    return requirementIds.has(item.requirementId)
      && new Set(item.factMatches.map(({ factId }) => factId)).size === item.factMatches.length
      && item.factMatches.every(({ factId }) => relevantFactIds.has(factId))
  })
}
