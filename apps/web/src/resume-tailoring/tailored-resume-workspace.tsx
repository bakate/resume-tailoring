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
    <section className="tailored-resume-workspace" aria-labelledby="tailored-resume-title">
      <h2 id="tailored-resume-title">{localization.translate('resumeClaims.title')}</h2>
      {view.tailoredResume === undefined
        ? <GenerationAction {...{ candidateSession, localization }} />
        : <>
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

function GenerationAction({ candidateSession, localization }: WorkspaceProps) {
  return (
    <div className="source-profile-card">
      <p>{localization.translate('resumeClaims.description')}</p>
      <button className="primary-action compact-action"
        disabled={candidateSession.view.status !== 'ready'
          || candidateSession.view.matchAnalysis?.generationEligibility !== 'eligible'}
        onClick={() => void candidateSession.generateResumeClaims()} type="button">
        {localization.translate('resumeClaims.generate')}
      </button>
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
    <div className="resume-claim-list">
      {exclusions === 0 ? null : (
        <p className="match-warning" role="status">
          {localization.translate('resumeClaims.excluded')}
        </p>
      )}
      {claims.length === 0
        ? <p>{localization.translate('resumeClaims.empty')}</p>
        : claims.map((claim, claimIndex) => (
            <ResumeClaimCard key={claim.id} {...{
              candidateSession,
              claim,
              claimIndex,
              claims,
              localization,
            }} />
          ))}
    </div>
  )
}

function ResumeClaimCard({
  candidateSession,
  claim,
  claimIndex,
  claims,
  localization,
}: ResumeClaimCardProps) {
  return (
    <article className="source-profile-card resume-claim-card">
      <p className="resume-claim-text">
        {formatResumeClaimText({ segments: claim.segments })}
      </p>
      <ClaimActions {...{ candidateSession, claim, claimIndex, claims, localization }} />
      <ReformulationForm {...{ candidateSession, claim, localization }} />
      <p className="claim-editing-note">{localization.translate('resumeClaims.noFreeEdit')}</p>
    </article>
  )
}

function ClaimActions(props: ResumeClaimCardProps) {
  const { candidateSession, claim, localization } = props
  return (
    <div className="resume-claim-actions">
      <MoveClaimButton {...props} direction="up" />
      <MoveClaimButton {...props} direction="down" />
      <button onClick={() => void candidateSession.removeResumeClaim({ claimId: claim.id })}
        type="button">
        {localization.translate('resumeClaims.remove')}
      </button>
    </div>
  )
}

function MoveClaimButton(props: ResumeClaimCardProps & Readonly<{ direction: 'up' | 'down' }>) {
  const { candidateSession, claim, claimIndex, claims, direction, localization } = props
  const disabled = direction === 'up' ? claimIndex === 0 : claimIndex === claims.length - 1
  return (
    <button disabled={disabled}
      onClick={() => void candidateSession.moveResumeClaim({ claimId: claim.id, direction })}
      type="button">
      {localization.translate(direction === 'up' ? 'resumeClaims.moveUp' : 'resumeClaims.moveDown')}
    </button>
  )
}

function ReformulationForm({ candidateSession, claim, localization }: WorkspaceProps & Readonly<{
  claim: ResumeClaim
}>) {
  const [reformulationRequest, setReformulationRequest] = useState('')
  return (
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
        <button disabled={reformulationRequest.trim().length === 0} type="submit">
          {localization.translate('resumeClaims.reformulate')}
        </button>
    </form>
  )
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
