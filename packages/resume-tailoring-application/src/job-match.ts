import {
  analyzeResumeMatch,
} from '@resume-tailoring/matching-engine'
import type {
  CandidateFact as EngineCandidateFact,
  MatchAnalysis as EngineMatchAnalysis,
  ProposedAdjacentEvidence,
  ProposedMatchEvidence,
  ProposedRelevantFact,
} from '@resume-tailoring/matching-engine'
import { validateRelevantFactProposals } from '@resume-tailoring/matching-engine'
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
  adjacentEvidence: readonly ProposedAdjacentEvidence[]
  evidence: readonly ProposedMatchEvidence[]
  relevance: readonly ProposedRelevantFact[]
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

export const profileEnrichmentFactKinds = [
  'certification',
  'education',
  'experience',
  'language',
  'project',
  'skill',
] as const

export type ProfileEnrichmentFactKind = typeof profileEnrichmentFactKinds[number]

export type JobMatchFailure =
  | JobPostingDocumentFailure
  | 'job-posting-extraction-unavailable'
  | 'match-evidence-unavailable'
  | 'processing-consent-required'

type CreateJobMatchRequest = Readonly<{
  candidateFacts: readonly CandidateFact[]
  document: JobPostingDocument
  jobPostingDocumentReader: JobPostingDocumentReader
  jobPostingExtractor: JobPostingExtractor
  matchEvidenceMatcher: MatchEvidenceMatcher
}>

type CreateJobMatchResult = Promise<Readonly<{ ok: true; value: JobMatch }> | Readonly<{
  ok: false
  error: JobMatchFailure
}>>

export async function createJobMatch({
  candidateFacts,
  document,
  jobPostingDocumentReader,
  jobPostingExtractor,
  matchEvidenceMatcher,
}: CreateJobMatchRequest): CreateJobMatchResult {
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

export async function refreshJobMatch({
  candidateFacts,
  jobMatch,
  matchEvidenceMatcher,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  jobMatch: JobMatch
  matchEvidenceMatcher: MatchEvidenceMatcher
}>): CreateJobMatchResult {
  const analysisResult = await analyzeCandidateFacts({
    candidateFacts,
    matchEvidenceMatcher,
    requirements: jobMatch.requirements,
  })
  if (!analysisResult.ok) return analysisResult
  return { ok: true, value: {
    ...jobMatch,
    analysis: mapMatchAnalysis({ analysis: analysisResult.value }),
    priorityGapRequirementIds: readPriorityGapRequirementIds({ analysis: analysisResult.value }),
    strengthRequirementIds: readStrengthRequirementIds({ analysis: analysisResult.value }),
  } }
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
  const extraction = readSourceBackedExtraction({ content, extraction: extractionResult.value })
  if (extraction === null) return extractionUnavailableResult
  return analyzeExtractedJobPosting({
    candidateFacts, content, document, extraction, matchEvidenceMatcher,
  })
}

type AnalyzeExtractedJobPostingRequest = Readonly<{
  candidateFacts: readonly CandidateFact[]
  content: string
  document: JobPostingDocument
  extraction: ExtractedJobPosting
  matchEvidenceMatcher: MatchEvidenceMatcher
}>

async function analyzeExtractedJobPosting({
  candidateFacts, content, document, extraction, matchEvidenceMatcher,
}: AnalyzeExtractedJobPostingRequest) {
  const analysisResult = await analyzeCandidateFacts({
    candidateFacts,
    matchEvidenceMatcher,
    requirements: extraction.requirements,
  })
  if (!analysisResult.ok) return analysisResult
  return { ok: true, value: buildJobMatch({
    analysis: analysisResult.value, content, document, extraction,
  }) } as const
}

async function analyzeCandidateFacts({
  candidateFacts,
  matchEvidenceMatcher,
  requirements,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  matchEvidenceMatcher: MatchEvidenceMatcher
  requirements: readonly JobRequirement[]
}>) {
  const engineFacts = mapCandidateFacts({ candidateFacts })
  const proposalResult = await matchEvidenceMatcher.match(
    { candidateFacts: engineFacts, requirements },
  )
  if (!proposalResult.ok) return proposalResult
  const analysisResult = analyzeResumeMatch({
    candidateFacts: engineFacts,
    proposedAdjacentEvidence: proposalResult.value.adjacentEvidence,
    proposedEvidence: proposalResult.value.evidence,
    relevantFactIds: validateRelevantFactProposals({
      candidateFacts: engineFacts, proposals: proposalResult.value.relevance, requirements,
    }),
    requirements,
  })
  if (!analysisResult.ok) return matchEvidenceUnavailableResult
  return analysisResult
}

type BuildJobMatchRequest = Readonly<{
  analysis: EngineMatchAnalysis
  content: string
  document: JobPostingDocument
  extraction: ExtractedJobPosting
}>

function buildJobMatch({ analysis, content, document, extraction }: BuildJobMatchRequest): JobMatch {
  return {
    analysis: mapMatchAnalysis({ analysis }),
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

function mapMatchAnalysis({ analysis }: Readonly<{
  analysis: EngineMatchAnalysis
}>): JobMatch['analysis'] {
  return {
    ...analysis,
    adjacentEvidence: analysis.adjacentEvidence.map((item) => ({
      ...item, requirementId: toRequirementId(item.requirementId),
    })),
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
  }
}

function readStrengthRequirementIds({ analysis }: Readonly<{
  analysis: EngineMatchAnalysis
}>) {
  return analysis.requirementGroups
    .filter(({ coverage }) => coverage !== 'uncovered')
    .toSorted(compareRequirementGroups)
    .flatMap((group) => readEvidencedRequirementId({ analysis, group }))
    .slice(0, summaryItemLimit)
}

function readEvidencedRequirementId({ analysis, group }: Readonly<{
  analysis: EngineMatchAnalysis
  group: EngineMatchAnalysis['requirementGroups'][number]
}>) {
  const requirementId = group.requirementIds.find((candidateId) =>
    analysis.evidence.some((evidence) => evidence.requirementId === candidateId))
  return requirementId === undefined ? [] : [toRequirementId(requirementId)]
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

function readSourceBackedExtraction({ content, extraction }: Readonly<{
  content: string
  extraction: ExtractedJobPosting
}>): ExtractedJobPosting | null {
  if (!hasValidRequirementIds({ requirements: extraction.requirements })) return null
  if (!hasSupportedTargetRole({ content, targetRole: extraction.targetRole })) return null
  if (!extraction.requirements.every((requirement) =>
    hasSourceBackedRequirement({ content, requirement }))) return null
  const requirements = normalizeRequirements({ requirements: extraction.requirements })
  const practicalConstraints = extraction.practicalConstraints.filter((constraint) =>
    hasSourceSupport({ content, excerpt: constraint.sourceExcerpt, value: constraint.value }))
  return requirements.length === 0 ? null : { ...extraction, practicalConstraints, requirements }
}

function hasSourceBackedRequirement({ content, requirement }: Readonly<{
  content: string
  requirement: JobRequirement
}>) {
  const normalizedExcerpt = normalizeSourceText({ value: requirement.sourceExcerpt })
  if (hasNegatedImportance({ value: normalizedExcerpt })) {
    return requirement.sourceExcerpt.length > 0 && content.includes(requirement.sourceExcerpt)
  }
  return hasSourceSupport({
    content, excerpt: requirement.sourceExcerpt, value: requirement.value,
  })
}

function hasValidRequirementIds({ requirements }: Readonly<{
  requirements: readonly JobRequirement[]
}>) {
  return requirements.length > 0
    && new Set(requirements.map(({ id }) => id)).size === requirements.length
}

function hasSupportedTargetRole({ content, targetRole }: Readonly<{
  content: string
  targetRole: TargetRole | null
}>) {
  return targetRole === null || hasSourceSupport({
    content, excerpt: targetRole.sourceExcerpt, value: targetRole.value,
  })
}

function hasSourceSupport({ content, excerpt, value }: Readonly<{
  content: string
  excerpt: string
  value: string
}>) {
  if (excerpt.length === 0 || !content.includes(excerpt)) return false
  const normalizedExcerpt = normalizeSourceText({ value: excerpt })
  const normalizedValue = normalizeSourceText({ value })
  return normalizedValue.length > 0 && normalizedExcerpt.includes(normalizedValue)
    && hasMatchingPolarity({ excerpt: normalizedExcerpt, value: normalizedValue })
}

function normalizeSourceText({ value }: Readonly<{ value: string }>) {
  return value.toLocaleLowerCase('en').normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll(/[^a-z0-9+#]+/gu, ' ').trim()
}

function hasMatchingPolarity({ excerpt, value }: Readonly<{
  excerpt: string
  value: string
}>) {
  return hasNegatedImportance({ value: excerpt }) === hasNegatedImportance({ value })
}

function normalizeRequirements({ requirements }: Readonly<{
  requirements: readonly JobRequirement[]
}>): readonly JobRequirement[] {
  return requirements.filter((requirement) => !hasNegatedImportance({
    value: normalizeSourceText({ value: requirement.sourceExcerpt }),
  })).map((requirement) => ({
    ...requirement,
    capability: normalizeCapability({ requirement }),
    importance: readSourceImportance({
      excerpt: requirement.sourceExcerpt, proposedImportance: requirement.importance,
    }),
    importanceRationale: requirement.sourceExcerpt,
    substitutableGroup: readSourceSubstitutionGroup({ requirement, requirements }),
  }))
}

function normalizeCapability({ requirement }: Readonly<{
  requirement: JobRequirement
}>): JobRequirement['capability'] {
  const { capability, sourceExcerpt, value } = requirement
  return {
    ...capability,
    name: hasSourceSupport({ content: sourceExcerpt, excerpt: sourceExcerpt, value: capability.name })
      ? capability.name : value,
  }
}

function readSourceImportance({ excerpt, proposedImportance }: Readonly<{
  excerpt: string
  proposedImportance: JobRequirement['importance']
}>): JobRequirement['importance'] {
  const normalizedExcerpt = normalizeSourceText({ value: excerpt })
  if (complementaryImportanceTerms.some((term) => includesImportanceTerm({ normalizedExcerpt, term }))) {
    return 'complementary'
  }
  if (criticalImportanceTerms.some((term) => includesImportanceTerm({ normalizedExcerpt, term }))) {
    return 'critical'
  }
  // Without explicit wording, central stays reserved for responsibilities the posting emphasizes.
  return proposedImportance === 'complementary' ? 'complementary' : 'central'
}

// Matches whole words, allowing French agreement endings such as "requise" or "souhaitées".
function includesImportanceTerm({ normalizedExcerpt, term }: Readonly<{
  normalizedExcerpt: string
  term: string
}>) {
  return new RegExp(`(?:^| )${term}(?:e|s|es)?(?= |$)`, 'u').test(normalizedExcerpt)
}

function readSourceSubstitutionGroup({ requirement, requirements }: Readonly<{
  requirement: JobRequirement
  requirements: readonly JobRequirement[]
}>) {
  if (requirement.substitutableGroup === undefined) return undefined
  const group = requirements.filter(({ substitutableGroup }) =>
    substitutableGroup === requirement.substitutableGroup)
  return group.length < 2 ? undefined : `proposal:${requirement.substitutableGroup}`
}

function hasNegatedImportance({ value }: Readonly<{ value: string }>) {
  return negatedImportancePatterns.some((pattern) => pattern.test(value))
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

export const maximumJobPostingBytes = 5 * 1_024 * 1_024
const maximumJobPostingCharacters = 100_000
const summaryItemLimit = 3
const complementaryImportanceTerms = [
  'apprecie', 'atout', 'bonus', 'idealement', 'nice to have', 'optional', 'plus', 'preferred',
  'souhaitable', 'souhaite',
] as const
const criticalImportanceTerms = [
  'critical', 'essential', 'exige', 'imperatif', 'indispensable', 'mandatory', 'must',
  'necessaire', 'obligatoire', 'required', 'requis',
] as const
const negatedImportancePatterns = [
  /\bno\b.{0,80}\b(?:critical|essential|mandatory|required)\b/u,
  /\bnot (?:critical|essential|mandatory|required)\b/u,
  /\b(?:aucun|aucune)\b.{0,80}\b(?:indispensable|necessaire|obligatoire|requis|requise)\b/u,
  /\b(?:n est pas|non|pas) (?:indispensable|necessaire|obligatoire|requis)\b/u,
] as const
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
