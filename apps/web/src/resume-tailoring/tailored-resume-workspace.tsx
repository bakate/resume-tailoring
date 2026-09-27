import type { ResumeClaim } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { formatResumeClaimText as formatClaim } from '@resume-tailoring/application/tailored-resume-document'
import { useState } from 'react'

import type { Localization } from '../localization/localization'
import { TailoredResumePreview } from './tailored-resume-preview'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>

type ResumeClaimCardProps = WorkspaceProps & Readonly<{
  claim: ResumeClaim
  claimIndex: number
  claims: readonly ResumeClaim[]
}>
type ResumeClaimReformulator = Pick<CandidateSessionController, 'reformulateResumeClaim'>

export function formatResumeClaimText({ segments }: Readonly<{
  segments: ResumeClaim['segments']
}>) {
  return formatClaim({ segments })
}

export function TailoredResumeWorkspace({ candidateSession, localization }: WorkspaceProps) {
  const { view } = candidateSession
  if (view.status !== 'ready' || view.matchAnalysis === undefined) return null
  return (
    <section aria-busy={candidateSession.pendingOperation === 'generate-resume-claims'
      || candidateSession.pendingOperation === 'reformulate-resume-claim'}
      className="tailored-resume-workspace" aria-labelledby="tailored-resume-title">
      <h2 id="tailored-resume-title" tabIndex={-1}>{localization.translate('resumeClaims.title')}</h2>
      {view.tailoredResume === undefined
        ? <GenerationAction {...{ candidateSession, localization }} />
        : <>
            <TailoredResumeFlowNavigation localization={localization} />
            <CuratedClaims {...{
              candidateSession,
              claims: view.tailoredResume.claims,
              exclusions: view.tailoredResume.exclusions.length,
              localization,
            }} />
            <TailoredResumePreview {...{ candidateSession, localization }} />
          </>}
    </section>
  )
}

function TailoredResumeFlowNavigation({ localization }: Readonly<{
  localization: Localization
}>) {
  return (
    <nav aria-label={localization.translate('resumeClaims.flowNavigation')}
      className="tailored-resume-flow-navigation">
      <a href="#resume-claims-list-title">
        {localization.translate('resumeClaims.collectionTitle')}
      </a>
      <a href="#resume-preview-title">{localization.translate('resumePreview.title')}</a>
      <a href="#resume-photo-title">{localization.translate('resumePreview.photoSection')}</a>
      <a href="#resume-outcome-title">{localization.translate('resumePreview.outcomeSection')}</a>
      <a href="#resume-export-title">{localization.translate('resumePreview.exportSection')}</a>
    </nav>
  )
}

function GenerationAction({ candidateSession, localization }: WorkspaceProps) {
  const isEligible = candidateSession.view.status === 'ready'
    && candidateSession.view.matchAnalysis?.generationEligibility === 'eligible'
  return (
    <div className="source-profile-card">
      <p>{localization.translate('resumeClaims.description')}</p>
      {isEligible ? (
        <button className="primary-action compact-action"
          disabled={candidateSession.pendingOperation !== null}
          onClick={() => void candidateSession.generateResumeClaims()} type="button">
          {localization.translate('resumeClaims.generate')}
        </button>
      ) : <p className="match-warning">{localization.translate('matchAnalysis.denied')}</p>}
    </div>
  )
}

function CuratedClaims({
  candidateSession,
  claims,
  exclusions,
  localization,
}: WorkspaceProps & Readonly<{
  claims: readonly ResumeClaim[]
  exclusions: number
}>) {
  return (
    <section aria-labelledby="resume-claims-list-title">
      <h3 id="resume-claims-list-title" tabIndex={-1}>
        {localization.translate('resumeClaims.collectionTitle')}
      </h3>
      {exclusions === 0 ? null : (
        <p className="match-warning" role="status">
          {localization.translate('resumeClaims.excluded')}
        </p>
      )}
      <p className="claim-editing-note">{localization.translate('resumeClaims.noFreeEdit')}</p>
      {claims.length === 0
        ? <p>{localization.translate('resumeClaims.empty')}</p>
        : <ol aria-labelledby="resume-claims-list-title" className="resume-claim-list">
          {claims.map((claim, claimIndex) => (
            <ResumeClaimCard key={claim.id} {...{
              candidateSession,
              claim,
              claimIndex,
              claims,
              localization,
            }} />
          ))}
        </ol>}
    </section>
  )
}

function ResumeClaimCard({
  candidateSession,
  claim,
  claimIndex,
  claims,
  localization,
}: ResumeClaimCardProps) {
  const claimLabel = createResumeClaimLabel({ claimIndex, localization })
  return (
    <li>
      <article aria-label={claimLabel} className="source-profile-card resume-claim-card">
        <span className="resume-claim-position">{claimLabel}</span>
        <p className="resume-claim-text">
          {formatResumeClaimText({ segments: claim.segments })}
        </p>
        <ClaimActions {...{ candidateSession, claim, claimIndex, claims, localization }} />
        <ReformulationForm {...{ candidateSession, claim, claimIndex, localization }} />
      </article>
    </li>
  )
}

function ClaimActions(props: ResumeClaimCardProps) {
  const { candidateSession, claim, localization } = props
  return (
    <div className="resume-claim-actions">
      <MoveClaimButton {...props} direction="up" />
      <MoveClaimButton {...props} direction="down" />
      <button aria-label={createClaimActionLabel({
        action: localization.translate('resumeClaims.remove'),
        claimIndex: props.claimIndex,
        localization,
      })} disabled={candidateSession.pendingOperation !== null}
        onClick={() => void candidateSession.removeResumeClaim({ claimId: claim.id })}
        type="button">
        {localization.translate('resumeClaims.remove')}
      </button>
    </div>
  )
}

function MoveClaimButton(props: ResumeClaimCardProps & Readonly<{ direction: 'up' | 'down' }>) {
  const { candidateSession, claim, claimIndex, claims, direction, localization } = props
  const reachedBoundary = direction === 'up' ? claimIndex === 0 : claimIndex === claims.length - 1
  return (
    <button aria-label={createClaimActionLabel({
      action: localization.translate(direction === 'up'
        ? 'resumeClaims.moveUp' : 'resumeClaims.moveDown'),
      claimIndex,
      localization,
    })} disabled={reachedBoundary || candidateSession.pendingOperation !== null}
      onClick={() => void candidateSession.moveResumeClaim({ claimId: claim.id, direction })}
      type="button">
      {localization.translate(direction === 'up' ? 'resumeClaims.moveUp' : 'resumeClaims.moveDown')}
    </button>
  )
}

function ReformulationForm({
  candidateSession,
  claim,
  claimIndex,
  localization,
}: WorkspaceProps & Readonly<{ claim: ResumeClaim; claimIndex: number }>) {
  const [reformulationRequest, setReformulationRequest] = useState('')
  return (
    <details className="reformulation-disclosure">
      <summary>{createClaimActionLabel({
        action: localization.translate('resumeClaims.reformulationLabel'),
        claimIndex,
        localization,
      })}</summary>
      <form className="reformulation-form" onSubmit={(event) => {
        event.preventDefault()
        void submitReformulation({
          candidateSession,
          claim,
          clearRequest: () => { setReformulationRequest('') },
          reformulationRequest,
        })
      }}>
        <label htmlFor={`reformulate-${claim.id}`}>
          {localization.translate('resumeClaims.reformulationLabel')}
        </label>
        <input id={`reformulate-${claim.id}`} value={reformulationRequest}
          onChange={(event) => {
            setReformulationRequest(event.target.value)
          }} />
        <button disabled={candidateSession.pendingOperation !== null
          || reformulationRequest.trim().length === 0} type="submit">
          {localization.translate('resumeClaims.reformulate')}
        </button>
      </form>
    </details>
  )
}

function createClaimActionLabel({ action, claimIndex, localization }: Readonly<{
  action: string
  claimIndex: number
  localization: Localization
}>) {
  return `${action} — ${createResumeClaimLabel({ claimIndex, localization })}`
}

function createResumeClaimLabel({ claimIndex, localization }: Readonly<{
  claimIndex: number
  localization: Localization
}>) {
  return `${localization.translate('resumeClaims.claimLabel')} ${String(claimIndex + 1)}`
}

export async function submitReformulation({
  candidateSession,
  claim,
  clearRequest,
  reformulationRequest,
}: Readonly<{
  candidateSession: ResumeClaimReformulator
  claim: ResumeClaim
  clearRequest: () => void
  reformulationRequest: string
}>) {
  const result = await candidateSession.reformulateResumeClaim({
    claimId: claim.id,
    request: reformulationRequest,
  })
  if (result.ok) clearRequest()
  return result
}
