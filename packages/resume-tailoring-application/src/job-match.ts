import {
  analyzeResumeMatch,
} from '@resume-tailoring/matching-engine'
import type {
  CandidateFact as EngineCandidateFact,
  MatchAnalysis as EngineMatchAnalysis,
  ProposedMatchEvidence,
} from '@resume-tailoring/matching-engine'
import type { CandidateFact } from '@resume-tailoring/domain/source-intake'
import type {
  JobMatch,
  JobRequirement,
  JobRequirementId,
  PracticalConstraint,
  TargetRole,
} from '@resume-tailoring/domain/job-match'

export type {
  JobMatch,
  JobRequirement,
  PracticalConstraint,
  TargetRole,
} from '@resume-tailoring/domain/job-match'
export {
  capabilityDimensions,
  matchBands,
  requirementCoverages,
  requirementImportances,
} from '@resume-tailoring/domain/job-match'

export type JobPostingDocument = Readonly<{
  bytes: Uint8Array
  mediaType: string
  name: string
}>

export type JobPostingDocumentFailure =
  | 'empty-job-posting'
  | 'invalid-job-posting'
  | 'oversized-job-posting'
  | 'scanned-job-posting'
  | 'unsupported-job-posting'
  | 'unreadable-job-posting'

export type JobPostingDocumentReader = Readonly<{
  read: (document: JobPostingDocument) => Promise<
    | Readonly<{ ok: true; value: Readonly<{ text: string }> }>
    | Readonly<{ ok: false; error: JobPostingDocumentFailure }>
  >
}>

export type ExtractedJobPosting = Readonly<{
  practicalConstraints: readonly PracticalConstraint[]
  requirements: readonly JobRequirement[]
  targetRole: TargetRole | null
}>

export type JobPostingExtractor = Readonly<{
  extract: (request: Readonly<{ jobPostingContent: string }>) => Promise<
    | Readonly<{ ok: true; value: ExtractedJobPosting }>
    | Readonly<{ ok: false; error: 'job-posting-extraction-unavailable' }>
  >
}>

export type MatchEvidenceProposal = Readonly<{
  evidence: readonly ProposedMatchEvidence[]
  relevantFactIds: readonly string[]
}>

export type MatchEvidenceMatcher = Readonly<{
  match: (request: Readonly<{
    candidateFacts: readonly EngineCandidateFact[]
    requirements: readonly JobRequirement[]
  }>) => Promise<
    | Readonly<{ ok: true; value: MatchEvidenceProposal }>
    | Readonly<{ ok: false; error: 'match-evidence-unavailable' }>
  >
}>

export type JobMatchFailure =
  | JobPostingDocumentFailure
  | 'job-posting-extraction-unavailable'
  | 'match-evidence-unavailable'
  | 'processing-consent-required'

export async function createJobMatch({
  candidateFacts,
  document,
  jobPostingDocumentReader,
  jobPostingExtractor,
  matchEvidenceMatcher,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  document: JobPostingDocument
  jobPostingDocumentReader: JobPostingDocumentReader
  jobPostingExtractor: JobPostingExtractor
  matchEvidenceMatcher: MatchEvidenceMatcher
}>): Promise<Readonly<{ ok: true; value: JobMatch }> | Readonly<{
  ok: false
  error: JobMatchFailure
}>> {
  if (document.bytes.byteLength > maximumJobPostingBytes) return oversizedResult
  const contentResult = await jobPostingDocumentReader.read(document)
  if (!contentResult.ok) return contentResult
  const content = contentResult.value.text.trim()
  if (content.length === 0) return emptyResult
  if (content.length > maximumJobPostingCharacters) return oversizedResult
  return extractAndAnalyzeJobMatch({
    candidateFacts, content, document, jobPostingExtractor, matchEvidenceMatcher,
  })
}

async function extractAndAnalyzeJobMatch({
  candidateFacts, content, document, jobPostingExtractor, matchEvidenceMatcher,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  content: string
  document: JobPostingDocument
  jobPostingExtractor: JobPostingExtractor
  matchEvidenceMatcher: MatchEvidenceMatcher
}>) {
  const extractionResult = await jobPostingExtractor.extract({ jobPostingContent: content })
  if (!extractionResult.ok) return extractionResult
  if (!hasSourceBackedExtraction({ content, extraction: extractionResult.value })) {
    return extractionUnavailableResult
  }
  return analyzeExtractedJobPosting({
    candidateFacts, content, document, extraction: extractionResult.value, matchEvidenceMatcher,
  })
}

async function analyzeExtractedJobPosting({
  candidateFacts, content, document, extraction, matchEvidenceMatcher,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  content: string
  document: JobPostingDocument
  extraction: ExtractedJobPosting
  matchEvidenceMatcher: MatchEvidenceMatcher
}>) {
  const engineFacts = mapCandidateFacts({ candidateFacts })
  const proposalResult = await matchEvidenceMatcher.match({
    candidateFacts: engineFacts,
    requirements: extraction.requirements,
  })
  if (!proposalResult.ok) return proposalResult
  const analysisResult = analyzeResumeMatch({
    candidateFacts: engineFacts,
    proposedEvidence: proposalResult.value.evidence,
    relevantFactIds: proposalResult.value.relevantFactIds,
    requirements: extraction.requirements,
  })
  if (!analysisResult.ok) return matchEvidenceUnavailableResult
  return { ok: true, value: buildJobMatch({
    analysis: analysisResult.value, content, document, extraction,
  }) } as const
}

function buildJobMatch({ analysis, content, document, extraction }: Readonly<{
  analysis: EngineMatchAnalysis
  content: string
  document: JobPostingDocument
  extraction: ExtractedJobPosting
}>): JobMatch {
  return {
    analysis: {
      ...analysis,
      criticalRequirementReserve: {
        ...analysis.criticalRequirementReserve,
        requirementIds: analysis.criticalRequirementReserve.requirementIds.map(toRequirementId),
      },
      evidence: analysis.evidence.map((item) => ({
        ...item, requirementId: toRequirementId(item.requirementId),
      })),
      requirementGroups: analysis.requirementGroups.map((group) => ({
        ...group, requirementIds: group.requirementIds.map(toRequirementId),
      })),
    },
    jobPosting: {
      kind: readJobPostingKind({ document }),
      name: document.name,
      originalContent: content,
    },
    practicalConstraints: extraction.practicalConstraints,
    priorityGapRequirementIds: readPriorityGapRequirementIds({ analysis }),
    requirements: extraction.requirements,
    strengthRequirementIds: readStrengthRequirementIds({ analysis }),
    targetRole: extraction.targetRole,
  }
}

function readStrengthRequirementIds({ analysis }: Readonly<{
  analysis: EngineMatchAnalysis
}>) {
  return analysis.requirementGroups
    .filter(({ coverage }) => coverage !== 'uncovered')
    .toSorted(compareRequirementGroups)
    .flatMap(({ requirementIds }) => requirementIds.slice(0, 1).map(toRequirementId))
    .slice(0, summaryItemLimit)
}

function readPriorityGapRequirementIds({ analysis }: Readonly<{
  analysis: EngineMatchAnalysis
}>) {
  return analysis.requirementGroups
    .filter(({ coverage }) => coverage !== 'covered')
    .toSorted(compareRequirementGroups)
    .flatMap(({ requirementIds }) => requirementIds.slice(0, 1).map(toRequirementId))
    .slice(0, summaryItemLimit)
}

function compareRequirementGroups(
  leftGroup: EngineMatchAnalysis['requirementGroups'][number],
  rightGroup: EngineMatchAnalysis['requirementGroups'][number],
) {
  return rightGroup.effectiveWeight - leftGroup.effectiveWeight
}

function mapCandidateFacts({ candidateFacts }: Readonly<{
  candidateFacts: readonly CandidateFact[]
}>): readonly EngineCandidateFact[] {
  return candidateFacts.flatMap((candidateFact) => {
    const kind = readCandidateFactKind({ path: candidateFact.path })
    return candidateFact.status === 'attested' && candidateFact.value.trim().length > 0
      && kind !== null
      ? [{ id: candidateFact.id, kind, value: candidateFact.value }]
      : []
  })
}

function readCandidateFactKind({ path }: Readonly<{ path: string }>): EngineCandidateFact['kind'] | null {
  const section = path.split('.')[0]
  if (section === 'certifications') return 'certification'
  if (section === 'education') return 'education'
  if (section === 'experiences') return 'experience'
  if (section === 'languages') return 'language'
  if (section === 'projects') return 'project'
  if (section === 'skills') return 'skill'
  return null
}

function hasSourceBackedExtraction({ content, extraction }: Readonly<{
  content: string
  extraction: ExtractedJobPosting
}>) {
  const excerpts = [
    ...extraction.requirements.map(({ sourceExcerpt }) => sourceExcerpt),
    ...extraction.practicalConstraints.map(({ sourceExcerpt }) => sourceExcerpt),
  ]
  if (extraction.targetRole !== null) {
    excerpts.push(extraction.targetRole.sourceExcerpt)
    if (!extraction.targetRole.sourceExcerpt.includes(extraction.targetRole.value)) return false
  }
  return extraction.requirements.length > 0
    && new Set(extraction.requirements.map(({ id }) => id)).size === extraction.requirements.length
    && excerpts.every((sourceExcerpt) => sourceExcerpt.length > 0 && content.includes(sourceExcerpt))
}

function readJobPostingKind({ document }: Readonly<{ document: JobPostingDocument }>) {
  if (document.mediaType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf')) {
    return 'pdf' as const
  }
  if (document.name === 'pasted-job-posting.txt') return 'pasted-text' as const
  return 'txt' as const
}

function toRequirementId(requirementId: string): JobRequirementId {
  return `job-requirement-${requirementId.replace(/^job-requirement-/u, '')}`
}

const maximumJobPostingBytes = 5 * 1_024 * 1_024
const maximumJobPostingCharacters = 100_000
const summaryItemLimit = 3
const emptyResult = { ok: false, error: 'empty-job-posting' } as const
const oversizedResult = { ok: false, error: 'oversized-job-posting' } as const
const extractionUnavailableResult = {
  ok: false,
  error: 'job-posting-extraction-unavailable',
} as const
const matchEvidenceUnavailableResult = {
  ok: false,
  error: 'match-evidence-unavailable',
} as const
