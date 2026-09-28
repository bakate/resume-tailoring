import type {
  JobRequirement,
  MatchAnalysis,
  PracticalConstraint,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { readMatchBand } from '@resume-tailoring/application/match-analysis'

import type { Localization } from '../localization/localization'
import { groupJobRequirements } from './job-requirement-groups'
import type { JobRequirementGroup } from './job-requirement-groups'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>

export function MatchAnalysisWorkspace({ candidateSession, localization }: WorkspaceProps) {
  const matchInputs = readMatchInputs({ candidateSession })
  if (matchInputs === null) return null
  return <section aria-busy={candidateSession.pendingOperation === 'analyze-match'}
    className="match-analysis-workspace" aria-labelledby="match-analysis-title">
    <h2 id="match-analysis-title" tabIndex={-1}>{localization.translate('matchAnalysis.title')}</h2>
    <MatchAnalysisContent {...{ candidateSession, localization, matchInputs }} />
  </section>
}

function readMatchInputs({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const { view } = candidateSession
  if (view.status !== 'ready'
    || view.jobPosting?.status !== 'reviewing-requirements'
    || view.sourceProfile?.status !== 'reviewing-facts') return null
  return { jobPosting: view.jobPosting, sourceProfile: view.sourceProfile }
}

type MatchAnalysisContentProps = WorkspaceProps & Readonly<{
  matchInputs: NonNullable<ReturnType<typeof readMatchInputs>>
}>

function MatchAnalysisContent({
  candidateSession, localization, matchInputs,
}: MatchAnalysisContentProps) {
  const analysis = candidateSession.view.status === 'ready'
    ? candidateSession.view.matchAnalysis : undefined
  if (analysis === undefined) return <AnalyzeMatchAction {...{ candidateSession, localization }} />
  const { jobPosting, sourceProfile } = matchInputs
  return <MatchAnalysisResult {...{
    analysis, candidateSession, localization, practicalConstraints: jobPosting.practicalConstraints,
    requirements: jobPosting.requirements,
    verifiedFacts: sourceProfile.facts.filter((fact) => fact.status === 'verified'),
  }} />
}

function AnalyzeMatchAction({ candidateSession, localization }: WorkspaceProps) {
  return <button className="primary-action compact-action"
    disabled={candidateSession.pendingOperation !== null}
    onClick={() => void candidateSession.analyzeMatch()} type="button">
    {localization.translate('matchAnalysis.action')}
  </button>
}

type MatchAnalysisResultProps = Readonly<{
  analysis: MatchAnalysis
  candidateSession: CandidateSessionController
  localization: Localization
  practicalConstraints: readonly PracticalConstraint[]
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>

function MatchAnalysisResult({
  analysis, candidateSession, localization, practicalConstraints, requirements, verifiedFacts,
}: MatchAnalysisResultProps) {
  const summary = createMatchAnalysisSummary({ analysis, requirements })
  return <div className="match-analysis-grid">
    <MatchAnalysisSummary {...{
      analysis, candidateSession, localization, practicalConstraints, requirements, ...summary,
    }} />
    <MatchEvidencePanel {...{ analysis, localization, requirements, verifiedFacts }} />
  </div>
}

function createMatchAnalysisSummary({ analysis, requirements }: Readonly<{
  analysis: MatchAnalysis
  requirements: readonly JobRequirement[]
}>) {
  const coveredRequirementIds = readCoverageIds({ analysis, coverage: 'covered' })
  const partiallyCoveredRequirementIds = readCoverageIds({
    analysis, coverage: 'partially-covered',
  })
  const priorityGaps = createPriorityGaps({ analysis, requirements })
  const strengthRequirements = requirements.filter((requirement) =>
    coveredRequirementIds.has(requirement.id)).slice(0, 3)
  return { coveredRequirementIds, partiallyCoveredRequirementIds, priorityGaps,
    strengthRequirements }
}

function readCoverageIds({ analysis, coverage }: Readonly<{
  analysis: MatchAnalysis
  coverage: MatchAnalysis['evidence'][number]['coverage']
}>) {
  return new Set(analysis.evidence.filter((evidence) => evidence.coverage === coverage)
    .map((evidence) => evidence.requirementId))
}

function createPriorityGaps({ analysis, requirements }: Readonly<{
  analysis: MatchAnalysis
  requirements: readonly JobRequirement[]
}>): GapSummaryItem[] {
  const partialIds = new Set(analysis.gapAnalysis.partiallyCoveredRequiredRequirementIds)
  const uncoveredIds = new Set(analysis.gapAnalysis.uncoveredRequiredRequirementIds)
  return requirements.flatMap((requirement) => {
    const gap = createGapSummaryItem({ partialIds, requirement, uncoveredIds })
    return gap === null ? [] : [gap]
  })
}

function createGapSummaryItem({ partialIds, requirement, uncoveredIds }: Readonly<{
  partialIds: ReadonlySet<JobRequirement['id']>
  requirement: JobRequirement
  uncoveredIds: ReadonlySet<JobRequirement['id']>
}>): GapSummaryItem | null {
  if (partialIds.has(requirement.id)) return { coverage: 'partially-covered', requirement }
  return uncoveredIds.has(requirement.id) ? { coverage: 'uncovered', requirement } : null
}

type MatchAnalysisSummaryProps = Readonly<{
  analysis: MatchAnalysis
  candidateSession: CandidateSessionController
  coveredRequirementIds: ReadonlySet<JobRequirement['id']>
  localization: Localization
  partiallyCoveredRequirementIds: ReadonlySet<JobRequirement['id']>
  practicalConstraints: readonly PracticalConstraint[]
  priorityGaps: readonly GapSummaryItem[]
  requirements: readonly JobRequirement[]
  strengthRequirements: readonly JobRequirement[]
}>

function MatchAnalysisSummary({
  analysis, candidateSession, coveredRequirementIds, localization,
  partiallyCoveredRequirementIds, practicalConstraints, priorityGaps,
  requirements, strengthRequirements,
}: MatchAnalysisSummaryProps) {
  const coverageCounts = createCoverageCounts({
    coveredRequirementIds, partiallyCoveredRequirementIds, requirements,
  })
  return <section className="source-profile-card match-score-card match-analysis-summary"
    aria-labelledby="match-analysis-summary-title">
    <MatchAnalysisSummaryTitle localization={localization} />
    <MatchDecision {...{ analysis, candidateSession, localization }} />
    <CoverageSummary localization={localization} {...coverageCounts} />
    <AnalysisSupportingDetails {...{
      analysis, localization, practicalConstraints, priorityGaps, strengthRequirements,
    }} />
  </section>
}

function MatchAnalysisSummaryTitle({ localization }: Readonly<{ localization: Localization }>) {
  return <h3 id="match-analysis-summary-title" tabIndex={-1}>
    {localization.translate('matchAnalysis.summaryTitle')}
  </h3>
}

function createCoverageCounts({
  coveredRequirementIds, partiallyCoveredRequirementIds, requirements,
}: Pick<MatchAnalysisSummaryProps,
  'coveredRequirementIds' | 'partiallyCoveredRequirementIds' | 'requirements'>) {
  return {
    preferredCoverage: readCoverageCount({
      classification: 'preferred', coveredRequirementIds, partiallyCoveredRequirementIds, requirements,
    }),
    requiredCoverage: readCoverageCount({
      classification: 'required', coveredRequirementIds, partiallyCoveredRequirementIds, requirements,
    }),
  }
}

type AnalysisSupportingDetailsProps = Readonly<{
  analysis: MatchAnalysis
  localization: Localization
  practicalConstraints: readonly PracticalConstraint[]
  priorityGaps: readonly GapSummaryItem[]
  strengthRequirements: readonly JobRequirement[]
}>

function AnalysisSupportingDetails({
  analysis, localization, practicalConstraints, priorityGaps, strengthRequirements,
}: AnalysisSupportingDetailsProps) {
  return <>
    <GapSummary {...{ localization, priorityGaps }} />
    <RequirementList items={strengthRequirements} localization={localization}
      emptyKey="matchAnalysis.strengthNone" titleKey="matchAnalysis.strengthTitle" />
    <RequirementList items={practicalConstraints} localization={localization}
      emptyKey="matchAnalysis.practicalConstraintsNone"
      titleKey="matchAnalysis.practicalConstraints" />
    <ImprovementOpportunities {...{ analysis, localization }} />
  </>
}

type MatchDecisionProps = Readonly<{
  analysis: MatchAnalysis
  candidateSession: CandidateSessionController
  localization: Localization
}>

function MatchDecision({ analysis, candidateSession, localization }: MatchDecisionProps) {
  const eligibilityKey = analysis.generationEligibility === 'eligible'
    ? 'matchAnalysis.eligible' as const : 'matchAnalysis.denied' as const
  const eligibilityLabelKey = analysis.generationEligibility === 'eligible'
    ? 'matchAnalysis.eligibleLabel' as const : 'matchAnalysis.deniedLabel' as const
  return <>
    <p className="match-score-label">{localization.translate('matchAnalysis.score')}</p>
    <strong className="match-score">{analysis.matchScore}%</strong>
    <p className="match-eligibility">{localization.translate(
      `matchAnalysis.band.${readMatchBand(analysis)}`,
    )}</p>
    <p className="match-eligibility">{localization.translate(eligibilityLabelKey)}</p>
    <LowScoreWarning {...{ analysis, localization }} />
    <p className="match-eligibility-description">{localization.translate(eligibilityKey)}</p>
    <GenerationAction {...{ analysis, candidateSession, localization }} />
  </>
}

function LowScoreWarning({ analysis, localization }: Readonly<{
  analysis: MatchAnalysis
  localization: Localization
}>) {
  if (analysis.warning === null) return null
  return <p className="match-warning" role="status">
    {localization.translate('matchAnalysis.lowScoreWarning')}
  </p>
}

function GenerationAction({ analysis, candidateSession, localization }: Readonly<{
  analysis: MatchAnalysis
  candidateSession: CandidateSessionController
  localization: Localization
}>) {
  if (analysis.generationEligibility !== 'eligible') return null
  return <button className="primary-action compact-action"
    disabled={candidateSession.pendingOperation !== null}
    onClick={() => void candidateSession.generateResumeClaims()} type="button">
    {localization.translate('resumeClaims.generate')}
  </button>
}

type CoverageCountValue = ReturnType<typeof readCoverageCount>

function CoverageSummary({ localization, preferredCoverage, requiredCoverage }: Readonly<{
  localization: Localization
  preferredCoverage: CoverageCountValue
  requiredCoverage: CoverageCountValue
}>) {
  const partialLabel = localization.translate('matchAnalysis.partialShort')
  return <dl className="match-coverage-counts">
    <CoverageCount label={localization.translate('matchAnalysis.requiredCoverage')}
      {...{ partialLabel, ...requiredCoverage }} />
    <CoverageCount label={localization.translate('matchAnalysis.preferredCoverage')}
      {...{ partialLabel, ...preferredCoverage }} />
  </dl>
}

function GapSummary({ localization, priorityGaps }: Readonly<{
  localization: Localization
  priorityGaps: readonly GapSummaryItem[]
}>) {
  return <section className="match-gap-summary" aria-labelledby="match-gap-title">
    <h4 id="match-gap-title">{localization.translate('matchAnalysis.gapTitle')}</h4>
    {priorityGaps.length === 0
      ? <p>{localization.translate('matchAnalysis.gapNone')}</p>
      : <ul>{priorityGaps.slice(0, 3).map(({ coverage, requirement }) => (
        <li key={requirement.id}><span>{requirement.value}</span>
          <span>{readCoverageLabel({ coverage, localization })}</span></li>
      ))}</ul>}
  </section>
}

function readCoverageLabel({ coverage, localization }: Readonly<{
  coverage: GapSummaryItem['coverage']
  localization: Localization
}>) {
  return localization.translate(coverage === 'partially-covered'
    ? 'matchAnalysis.coverage.partial' : 'matchAnalysis.coverage.uncovered')
}

function RequirementList({ emptyKey, items, localization, titleKey }: Readonly<{
  emptyKey: 'matchAnalysis.strengthNone' | 'matchAnalysis.practicalConstraintsNone'
  items: readonly Readonly<{ sourceExcerpt: string; value: string }>[]
  localization: Localization
  titleKey: 'matchAnalysis.strengthTitle' | 'matchAnalysis.practicalConstraints'
}>) {
  return <section>
    <h4>{localization.translate(titleKey)}</h4>
    {items.length === 0 ? <p>{localization.translate(emptyKey)}</p> : <ul>{items.map((item) =>
      <li key={`${item.sourceExcerpt}:${item.value}`}>{item.value}</li>)}</ul>}
  </section>
}

type GapSummaryItem = Readonly<{
  coverage: 'partially-covered' | 'uncovered'
  requirement: JobRequirement
}>

function ImprovementOpportunities({ analysis, localization }: Readonly<{
  analysis: MatchAnalysis
  localization: Localization
}>) {
  return <section>
    <h4>{localization.translate('matchAnalysis.improvementTitle')}</h4>
    {analysis.improvementOpportunities.length === 0
      ? <p>{localization.translate('matchAnalysis.improvementNone')}</p>
      : <ul>{analysis.improvementOpportunities.map((opportunity) =>
        <li key={opportunity}>{opportunity}</li>)}</ul>}
  </section>
}

function readCoverageCount({
  classification,
  coveredRequirementIds,
  partiallyCoveredRequirementIds,
  requirements,
}: Readonly<{
  classification: JobRequirement['classification']
  coveredRequirementIds: ReadonlySet<JobRequirement['id']>
  partiallyCoveredRequirementIds: ReadonlySet<JobRequirement['id']>
  requirements: readonly JobRequirement[]
}>) {
  const classifiedRequirements = requirements.filter((requirement) =>
    requirement.classification === classification)
  return {
    covered: classifiedRequirements.filter((requirement) =>
      coveredRequirementIds.has(requirement.id)).length,
    partiallyCovered: classifiedRequirements.filter((requirement) =>
      partiallyCoveredRequirementIds.has(requirement.id)).length,
    total: classifiedRequirements.length,
  }
}

function CoverageCount({ covered, label, partialLabel, partiallyCovered, total }: Readonly<{
  covered: number
  label: string
  partialLabel: string
  partiallyCovered: number
  total: number
}>) {
  return <div>
    <dt>{label}</dt>
    <dd>{`${String(covered)} + ${String(partiallyCovered)} ${partialLabel} / ${String(total)}`}</dd>
  </div>
}

type MatchEvidencePanelProps = Readonly<{
  analysis: MatchAnalysis
  localization: Localization
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>

function MatchEvidencePanel({
  analysis, localization, requirements, verifiedFacts,
}: MatchEvidencePanelProps) {
  const factById = new Map(verifiedFacts.map((fact) => [fact.id, fact]))
  const evidenceByRequirementId = new Map(
    analysis.evidence.map((evidence) => [evidence.requirementId, evidence]),
  )
  const requirementGroups = createEvidenceGroups({ evidenceByRequirementId, requirements })
  return <section className="source-profile-card match-evidence-panel"
    aria-labelledby="match-evidence-title">
    <h3 id="match-evidence-title">{localization.translate('matchAnalysis.evidenceTitle')}</h3>
    <MatchEvidenceDetails {...{
      analysis, evidenceByRequirementId, factById, localization, requirementGroups,
    }} />
  </section>
}

function createEvidenceGroups({ evidenceByRequirementId, requirements }: Readonly<{
  evidenceByRequirementId: EvidenceGroupProps['evidenceByRequirementId']
  requirements: readonly JobRequirement[]
}>) {
  return groupJobRequirements({ requirements })
    .map((group) => ({
      ...group,
      requirements: group.requirements.filter((requirement) =>
        evidenceByRequirementId.has(requirement.id)),
    }))
    .filter((group) => group.requirements.length > 0)
}

function MatchEvidenceDetails({
  analysis, evidenceByRequirementId, factById, localization, requirementGroups,
}: Readonly<{
  analysis: MatchAnalysis
  evidenceByRequirementId: EvidenceGroupProps['evidenceByRequirementId']
  factById: EvidenceGroupProps['factById']
  localization: Localization
  requirementGroups: readonly JobRequirementGroup[]
}>) {
  if (analysis.evidence.length === 0) {
    return <p>{localization.translate('matchAnalysis.evidenceNone')}</p>
  }
  return <details><summary>{localization.translate('matchAnalysis.showDetails')}</summary>
    <ul className="match-evidence-list">{requirementGroups.map((group) => (
      <MatchEvidenceGroup key={group.groupId} {...{
        evidenceByRequirementId, factById, group, localization,
      }} />
    ))}</ul>
  </details>
}

type EvidenceGroupProps = Readonly<{
  evidenceByRequirementId: ReadonlyMap<JobRequirement['id'], MatchAnalysis['evidence'][number]>
  factById: ReadonlyMap<SourceProfileFact['id'], SourceProfileFact>
  group: JobRequirementGroup
  localization: Localization
}>

function MatchEvidenceGroup(props: EvidenceGroupProps) {
  const { evidenceByRequirementId, factById, group, localization } = props
  const summary = group.requirements.map((requirement) => requirement.value).join(', ')
  return <li className="match-evidence-group">
    <details>
      <summary>{summary}</summary>
      <p className="source-excerpt">
        <strong>{localization.translate('jobPosting.sourceExcerpt')}</strong>
        <span>{group.sourceExcerpt}</span>
      </p>
      <ul>{group.requirements.map((requirement) => (
        <MatchEvidenceItem key={requirement.id} {...{
          evidence: evidenceByRequirementId.get(requirement.id), factById, localization, requirement,
        }} />
      ))}</ul>
    </details>
  </li>
}

function MatchEvidenceItem({ evidence, factById, localization, requirement }: Readonly<{
  evidence: MatchAnalysis['evidence'][number] | undefined
  factById: EvidenceGroupProps['factById']
  localization: Localization
  requirement: JobRequirement
}>) {
  if (evidence === undefined) return null
  const coverageKey = evidence.coverage === 'partially-covered'
    ? 'matchAnalysis.coverage.partial' as const : 'matchAnalysis.coverage.covered' as const
  return <li>
    <strong>{requirement.value}</strong>
    <span>{localization.translate(coverageKey)}</span>
    <ul>{evidence.factIds.map((factId) => (
      <li key={factId}>{factById.get(factId)?.value}</li>
    ))}</ul>
  </li>
}
