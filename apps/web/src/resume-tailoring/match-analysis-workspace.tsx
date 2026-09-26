import type {
  JobRequirement,
  MatchAnalysis,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import type { Localization } from '../localization/localization'
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
    <section className="match-analysis-workspace" aria-labelledby="match-analysis-title">
      <h2 id="match-analysis-title">{localization.translate('matchAnalysis.title')}</h2>
      {candidateSession.view.status === 'ready'
        && candidateSession.view.matchAnalysis !== undefined
        ? <MatchAnalysisResult {...{
            analysis: candidateSession.view.matchAnalysis,
            localization,
            requirements: jobPosting.requirements,
            verifiedFacts: sourceProfile.facts.filter((fact) => fact.status === 'verified'),
          }} />
        : <button className="primary-action compact-action"
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
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const factById = new Map(verifiedFacts.map((fact) => [fact.id, fact]))
  return (
    <div className="match-analysis-grid">
      <MatchScoreSummary {...{ analysis, localization }} />
      <EvidencePanel {...{ analysis, factById, localization, requirementById }} />
      <GapAnalysisPanel {...{ analysis, localization, requirementById }} />
    </div>
  )
}

function MatchScoreSummary({ analysis, localization }: Readonly<{
  analysis: MatchAnalysis
  localization: Localization
}>) {
  return <div className="source-profile-card match-score-card">
    <h3>{localization.translate('matchAnalysis.score')}</h3>
    <strong className="match-score">{analysis.matchScore}%</strong>
    {analysis.warning === null ? null : (
      <p className="match-warning" role="status">
        {localization.translate('matchAnalysis.lowScoreWarning')}
      </p>
    )}
    <p>{localization.translate(
      analysis.generationEligibility === 'eligible'
        ? 'matchAnalysis.eligible'
        : 'matchAnalysis.denied',
    )}</p>
  </div>
}

type EvidencePanelProps = Readonly<{
  analysis: MatchAnalysis
  factById: ReadonlyMap<SourceProfileFact['id'], SourceProfileFact>
  localization: Localization
  requirementById: ReadonlyMap<JobRequirement['id'], JobRequirement>
}>

function EvidencePanel(props: EvidencePanelProps) {
  const { analysis, factById, localization, requirementById } = props
  return <div className="source-profile-card">
    <h3>{localization.translate('matchAnalysis.evidenceTitle')}</h3>
    {analysis.evidence.length === 0
      ? <p>{localization.translate('matchAnalysis.evidenceNone')}</p>
      : <ul className="match-evidence-list">
          {analysis.evidence.map((evidence) => (
            <li key={evidence.requirementId}>
              <strong>{requirementById.get(evidence.requirementId)?.value}</strong>
              <ul>
                {evidence.factIds.map((factId) => (
                  <li key={factId}>{factById.get(factId)?.value}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>}
  </div>
}

function GapAnalysisPanel({
  analysis,
  localization,
  requirementById,
}: Pick<EvidencePanelProps, 'analysis' | 'localization' | 'requirementById'>) {
  const uncoveredIds = analysis.gapAnalysis.uncoveredRequiredRequirementIds
  return <div className="source-profile-card gap-analysis-card">
    <h3>{localization.translate('matchAnalysis.gapTitle')}</h3>
    {uncoveredIds.length === 0
      ? <p>{localization.translate('matchAnalysis.gapNone')}</p>
      : <ul>
          {uncoveredIds.map((requirementId) => (
            <li key={requirementId}>{requirementById.get(requirementId)?.value}</li>
          ))}
        </ul>}
  </div>
}
