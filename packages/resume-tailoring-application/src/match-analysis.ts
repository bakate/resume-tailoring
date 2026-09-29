import {
  analyzeResumeMatch,
  readMatchBand as readEngineMatchBand,
  restoreResumeMatch,
  type MatchAnalysis as EngineMatchAnalysis,
  type MatchRequirement,
} from '@resume-tailoring/matching-engine'
import type {
  JobRequirement,
  JobRequirementId,
  MatchAnalysis,
  MatchEvidence,
  MatchScore,
  SourceProfileFact,
  SourceProfileFactId,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type { ProposedMatchEvidence } from './resume-tailoring-workflow-ports'

export const generationThreshold = 50

export function readMatchBand({ matchScore }: Readonly<{ matchScore: number }>) {
  return readEngineMatchBand({ matchScore })
}

export function createMatchAnalysis({
  improvementOpportunities,
  proposedEvidence,
  relevantFactIds,
  requirements,
  verifiedFacts,
}: Readonly<{
  proposedEvidence: readonly ProposedMatchEvidence[]
  improvementOpportunities: readonly string[]
  relevantFactIds: readonly SourceProfileFactId[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>): MatchAnalysis | null {
  const result = analyzeResumeMatch({
    candidateFacts: verifiedFacts,
    proposedEvidence,
    relevantFactIds,
    requirements: mapRequirements({ requirements }),
  })
  return result.ok ? mapAnalysis({
    analysis: result.value, improvementOpportunities, requirements,
  }) : null
}

export function restoreMatchAnalysis({
  evidence, improvementOpportunities = [], relevantFactIds, requirements, verifiedFacts,
}: Readonly<{
  evidence: readonly MatchEvidence[]
  improvementOpportunities?: readonly string[]
  relevantFactIds: readonly SourceProfileFactId[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>): MatchAnalysis | null {
  const result = restoreResumeMatch({
    candidateFacts: verifiedFacts,
    evidence,
    relevantFactIds,
    requirements: mapRequirements({ requirements }),
  })
  return result.ok ? mapAnalysis({
    analysis: result.value, improvementOpportunities, requirements,
  }) : null
}

function mapRequirements({ requirements }: Readonly<{
  requirements: readonly JobRequirement[]
}>): readonly MatchRequirement[] {
  return requirements.map((requirement) => ({
    capability: { dimension: 'execution', name: requirement.value },
    id: requirement.id,
    importance: requirement.classification === 'required' ? 'central' : 'complementary',
    sourceExcerpt: requirement.sourceExcerpt,
    value: requirement.value,
  }))
}

function mapAnalysis({ analysis, improvementOpportunities, requirements }: Readonly<{
  analysis: EngineMatchAnalysis
  improvementOpportunities: readonly string[]
  requirements: readonly JobRequirement[]
}>): MatchAnalysis {
  const evidence = mapEvidence({ evidence: analysis.evidence })
  return {
    evidence,
    gapAnalysis: createGapAnalysis({ evidence, requirements }),
    generationEligibility: analysis.generationEligibility,
    improvementOpportunities: improvementOpportunities.slice(0, 3),
    matchScore: analysis.matchScore as MatchScore,
    relevantFactIds: analysis.relevantFactIds as readonly SourceProfileFactId[],
    warning: analysis.matchScore < generationThreshold ? 'below-generation-threshold' : null,
  }
}

function mapEvidence({ evidence }: Readonly<{
  evidence: EngineMatchAnalysis['evidence']
}>): readonly MatchEvidence[] {
  return evidence.map((item) => ({
    coverage: item.coverage,
    factIds: item.factIds as readonly SourceProfileFactId[],
    requirementId: item.requirementId as JobRequirementId,
  }))
}

function createGapAnalysis({ evidence, requirements }: Readonly<{
  evidence: readonly MatchEvidence[]
  requirements: readonly JobRequirement[]
}>): MatchAnalysis['gapAnalysis'] {
  const evidenceByRequirementId = new Map(evidence.map((item) => [item.requirementId, item]))
  const requiredRequirements = requirements
    .filter(({ classification }) => classification === 'required')
  return {
    partiallyCoveredRequiredRequirementIds: requiredRequirements
      .filter(({ id }) => evidenceByRequirementId.get(id)?.coverage === 'partially-covered')
      .map(({ id }) => id),
    uncoveredRequiredRequirementIds: requiredRequirements
      .filter(({ id }) => !evidenceByRequirementId.has(id))
      .map(({ id }) => id),
  }
}
