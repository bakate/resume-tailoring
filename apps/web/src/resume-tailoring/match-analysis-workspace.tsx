import type {
  JobRequirement,
  MatchAnalysis,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

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
  const { jobPosting, sourceProfile } = matchInputs
  return (
    <section aria-busy={candidateSession.pendingOperation === 'analyze-match'}
      className="match-analysis-workspace" aria-labelledby="match-analysis-title">
      <h2 id="match-analysis-title" tabIndex={-1}>{localization.translate('matchAnalysis.title')}</h2>
      {candidateSession.view.status === 'ready'
        && candidateSession.view.matchAnalysis !== undefined
        ? <MatchAnalysisResult {...{
            analysis: candidateSession.view.matchAnalysis,
            localization,
            requirements: jobPosting.requirements,
            verifiedFacts: sourceProfile.facts.filter((fact) => fact.status === 'verified'),
          }} />
        : <button className="primary-action compact-action"
            disabled={candidateSession.pendingOperation !== null}
            onClick={() => void candidateSession.analyzeMatch()} type="button">
            {localization.translate('matchAnalysis.action')}
          </button>}
    </section>
  )
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

function MatchAnalysisResult({
  analysis,
  localization,
  requirements,
  verifiedFacts,
}: Readonly<{
  analysis: MatchAnalysis
  localization: Localization
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>) {
  const coveredRequirementIds = new Set(analysis.evidence.map((evidence) => evidence.requirementId))
  const uncoveredRequiredRequirements = requirements.filter((requirement) =>
    requirement.classification === 'required' && !coveredRequirementIds.has(requirement.id))
  return <div className="match-analysis-grid">
    <MatchAnalysisSummary {...{
      analysis,
      coveredRequirementIds,
      localization,
      requirements,
      uncoveredRequiredRequirements,
    }} />
    <MatchEvidencePanel {...{ analysis, localization, requirements, verifiedFacts }} />
  </div>
}

function MatchAnalysisSummary({
  analysis,
  coveredRequirementIds,
  localization,
  requirements,
  uncoveredRequiredRequirements,
}: Readonly<{
  analysis: MatchAnalysis
  coveredRequirementIds: ReadonlySet<JobRequirement['id']>
  localization: Localization
  requirements: readonly JobRequirement[]
  uncoveredRequiredRequirements: readonly JobRequirement[]
}>) {
  const requiredCoverage = readCoverageCount({
    classification: 'required', coveredRequirementIds, requirements,
  })
  const preferredCoverage = readCoverageCount({
    classification: 'preferred', coveredRequirementIds, requirements,
  })
  return <section className="source-profile-card match-score-card match-analysis-summary"
    aria-labelledby="match-analysis-summary-title">
    <h3 id="match-analysis-summary-title" tabIndex={-1}>
      {localization.translate('matchAnalysis.summaryTitle')}
    </h3>
    <p className="match-score-label">{localization.translate('matchAnalysis.score')}</p>
    <strong className="match-score">{analysis.matchScore}%</strong>
    <p className="match-eligibility">
      {localization.translate(analysis.generationEligibility === 'eligible'
        ? 'matchAnalysis.eligibleLabel'
        : 'matchAnalysis.deniedLabel')}
    </p>
    {analysis.warning === null ? null : (
      <p className="match-warning" role="status">
        {localization.translate('matchAnalysis.lowScoreWarning')}
      </p>
    )}
    <p className="match-eligibility-description">{localization.translate(
      analysis.generationEligibility === 'eligible'
        ? 'matchAnalysis.eligible'
        : 'matchAnalysis.denied',
    )}</p>
    <dl className="match-coverage-counts">
      <CoverageCount label={localization.translate('matchAnalysis.requiredCoverage')}
        {...requiredCoverage} />
      <CoverageCount label={localization.translate('matchAnalysis.preferredCoverage')}
        {...preferredCoverage} />
    </dl>
    <section className="match-gap-summary" aria-labelledby="match-gap-title">
      <h4 id="match-gap-title">{localization.translate('matchAnalysis.gapTitle')}</h4>
      {uncoveredRequiredRequirements.length === 0
        ? <p>{localization.translate('matchAnalysis.gapNone')}</p>
        : <ul>{uncoveredRequiredRequirements.map((requirement) => (
          <li key={requirement.id}>{requirement.value}</li>
        ))}</ul>}
    </section>
  </section>
}

function readCoverageCount({ classification, coveredRequirementIds, requirements }: Readonly<{
  classification: JobRequirement['classification']
  coveredRequirementIds: ReadonlySet<JobRequirement['id']>
  requirements: readonly JobRequirement[]
}>) {
  const classifiedRequirements = requirements.filter((requirement) =>
    requirement.classification === classification)
  return {
    covered: classifiedRequirements.filter((requirement) =>
      coveredRequirementIds.has(requirement.id)).length,
    total: classifiedRequirements.length,
  }
}

function CoverageCount({ covered, label, total }: Readonly<{
  covered: number
  label: string
  total: number
}>) {
  return <div>
    <dt>{label}</dt>
    <dd>{`${String(covered)} / ${String(total)}`}</dd>
  </div>
}

function MatchEvidencePanel({
  analysis,
  localization,
  requirements,
  verifiedFacts,
}: Readonly<{
  analysis: MatchAnalysis
  localization: Localization
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>) {
  const factById = new Map(verifiedFacts.map((fact) => [fact.id, fact]))
  const evidenceByRequirementId = new Map(
    analysis.evidence.map((evidence) => [evidence.requirementId, evidence]),
  )
  const requirementGroups = groupJobRequirements({ requirements })
    .map((group) => ({
      ...group,
      requirements: group.requirements.filter((requirement) =>
        evidenceByRequirementId.has(requirement.id)),
    }))
    .filter((group) => group.requirements.length > 0)
  return <section className="source-profile-card match-evidence-panel"
    aria-labelledby="match-evidence-title">
    <h3 id="match-evidence-title">{localization.translate('matchAnalysis.evidenceTitle')}</h3>
    {analysis.evidence.length === 0
      ? <p>{localization.translate('matchAnalysis.evidenceNone')}</p>
      : <ul className="match-evidence-list">{requirementGroups.map((group) => (
        <MatchEvidenceGroup key={group.groupId} {...{
          evidenceByRequirementId, factById, group, localization,
        }} />
      ))}</ul>}
  </section>
}

type EvidenceGroupProps = Readonly<{
  evidenceByRequirementId: ReadonlyMap<JobRequirement['id'], MatchAnalysis['evidence'][number]>
  factById: ReadonlyMap<SourceProfileFact['id'], SourceProfileFact>
  group: JobRequirementGroup
  localization: Localization
}>

function MatchEvidenceGroup({
  evidenceByRequirementId,
  factById,
  group,
  localization,
}: EvidenceGroupProps) {
  const summary = group.requirements.map((requirement) => requirement.value).join(', ')
  return <li className="match-evidence-group">
    <details>
      <summary>{summary}</summary>
      <p className="source-excerpt">
        <strong>{localization.translate('jobPosting.sourceExcerpt')}</strong>
        <span>{group.sourceExcerpt}</span>
      </p>
      <ul>{group.requirements.map((requirement) => {
        const evidence = evidenceByRequirementId.get(requirement.id)
        if (evidence === undefined) return null
        return <li key={requirement.id}>
          <strong>{requirement.value}</strong>
          <ul>{evidence.factIds.map((factId) => (
            <li key={factId}>{factById.get(factId)?.value}</li>
          ))}</ul>
        </li>
      })}</ul>
    </details>
  </li>
}
